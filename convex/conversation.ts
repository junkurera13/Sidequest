import {
  actionGeneric,
  mutationGeneric,
  queryGeneric,
  makeFunctionReference,
} from "convex/server";
import { v } from "convex/values";

import {
  generateQuest,
  saveLatestOutcomeForPhone,
} from "../lib/convexFunctions";
import {
  CONVERSATION_MODEL,
  type ClaudeMessageResponse,
} from "../lib/claudeQuest";

// Window for what counts as the user's "active" quest. Anything older is
// treated as historical context — the router won't auto-reference it when
// answering follow-ups unless the user explicitly asks about it.
const ACTIVE_QUEST_WINDOW_MS = 24 * 60 * 60 * 1000;

// We keep short-term conversation context bounded so the prompt stays cheap.
// 20 turns is plenty for a single session and rolls over naturally on long
// gaps via the timestamp index.
const HISTORY_TURNS = 20;

// Static system prompt — cached on every router call. Everything dynamic
// (memory snapshot, active quest, local context) goes in a second
// uncached system block so the cache hit stays high.
const SYSTEM_PROMPT = [
  "you're sidequest. you're a friend over imessage who suggests irl things to do and chats casually about them.",
  "",
  "tone:",
  "- lowercase, short, like a high school friend texting. no caps, no exclamation marks.",
  "- under 15 words per reply unless absolutely necessary. usually under 10.",
  "- no preamble (no 'sure!', 'got it!', 'great question'). just the reply.",
  "- no 'mission/case/dispatch/protocol' cosplay.",
  "",
  "what you do:",
  "- when the user wants something to do, use the make_quest tool to craft a real quest. don't try to suggest places yourself.",
  "- when the user asks about a specific venue (hours, address, what's good there), use look_up_place to check it.",
  "- when the user reports back on a quest (won/lost/skipped, any phrasing), use save_outcome to record it.",
  "- otherwise just reply in text. chitchat is fine. don't force a tool call.",
  "",
  "when calling tools:",
  "- write a SHORT text reply BEFORE the tool call (the user sees it instantly while the tool runs). examples: 'bet, on it', 'lemme check', 'ok one sec'.",
  "- after make_quest returns, write the handoff line that includes the url. example: 'ok rainy crawl cooked: <url>'. vary the wording each time.",
  "- after look_up_place returns, summarize ONLY what the tool told you. don't invent hours/details.",
  "- after save_outcome returns, react naturally to the outcome (hyped for won, chill for lost, no pressure for skipped). if they also asked for something new in the same turn, follow up with make_quest.",
  "",
  "rules that must hold:",
  "- don't invent factual claims about specific venues (hours, prices, what they serve) unless look_up_place told you.",
  "- don't restart the quest pipeline on closing/chitchat messages like 'thats cool' or 'ill let u know'. just reply briefly.",
  "- if you don't know the user's city and they're asking for a new quest, ASK before calling make_quest. one short question.",
  "- never paste a url that wasn't given to you by a tool.",
].join("\n");

const ROUTER_TOOLS = [
  {
    name: "make_quest",
    description:
      "Generate a fresh sidequest for the user — a 3-stop irl thing to do with named real places. " +
      "Use this when the user wants something new to do, not when they're asking about an existing quest. " +
      "Pass a short freeform summary of what they want (vibe, mood, group, budget, time, city if known).",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["vibe_summary"],
      properties: {
        vibe_summary: {
          type: "string",
          description:
            "Short summary capturing what they want, like 'solo, bored, late night, seoul, broke' or 'date night, romantic, paris'.",
        },
      },
    },
  },
  {
    name: "look_up_place",
    description:
      "Search the web for info about a specific real place — hours, address, what's good there, whether it's open right now. " +
      "Use when the user asks about a venue (theirs from a quest or otherwise). Don't use for general 'find me a cafe' questions — that's make_quest.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description:
            "What to look up. Include the venue name and city, e.g. 'Dongmyo Cafe Seoul opening hours'.",
        },
      },
    },
  },
  {
    name: "save_outcome",
    description:
      "Record how the user's most recent quest went. Use when they report back, e.g. 'W', 'L', 'we did it', 'skipped', 'yeah it was fire'. " +
      "Inline reports work too — if they say 'L, give me another', call save_outcome AND make_quest in the same turn.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["outcome"],
      properties: {
        outcome: {
          type: "string",
          enum: ["won", "lost", "skipped"],
          description: "Won = did it and it was good. Lost = tried but it didn't hit. Skipped = didn't go.",
        },
      },
    },
  },
] as const;

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type RouterMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

export const appendMessage = mutationGeneric({
  args: {
    phone: v.string(),
    role: v.union(v.literal("user"), v.literal("agent")),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("conversationMessages", {
      phone: args.phone,
      role: args.role,
      text: args.text,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const listRecentMessages = queryGeneric({
  args: { phone: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? HISTORY_TURNS;
    const rows = await ctx.db
      .query("conversationMessages")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .order("desc")
      .take(limit);
    return rows
      .map((row) => ({
        role: row.role,
        text: row.text,
        createdAt: row.createdAt,
      }))
      .reverse();
  },
});

function formatActiveQuest(quest: {
  title: string;
  brief: string;
  stops: Array<{ name: string; description: string }>;
  budget: string;
  createdAt: number;
  outcome?: string;
}): string {
  const stops = quest.stops
    .map((stop, i) => `  ${i + 1}. ${stop.name} — ${stop.description}`)
    .join("\n");
  const outcomeLine = quest.outcome
    ? `outcome already recorded: ${quest.outcome}`
    : "outcome not yet recorded";
  return [
    `active quest: "${quest.title}"`,
    `brief: ${quest.brief}`,
    `stops:\n${stops}`,
    `budget: ${quest.budget}`,
    outcomeLine,
  ].join("\n");
}

type ActiveQuestRow = {
  title: string;
  brief: string;
  stops: Array<{ name: string; description: string }>;
  budget: string;
  createdAt: number;
  outcome?: string;
};

export const getActiveQuestForPhone = queryGeneric({
  args: { phone: v.string() },
  handler: async (ctx, args): Promise<ActiveQuestRow | null> => {
    const latest = await ctx.db
      .query("quests")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .order("desc")
      .first();
    if (!latest) return null;
    if (Date.now() - latest.createdAt > ACTIVE_QUEST_WINDOW_MS) return null;
    return {
      title: latest.title,
      brief: latest.brief,
      stops: latest.stops,
      budget: latest.budget,
      createdAt: latest.createdAt,
      outcome: latest.outcome,
    };
  },
});

const getActiveQuestForPhoneRef = makeFunctionReference<
  "query",
  { phone: string },
  ActiveQuestRow | null
>("conversation:getActiveQuestForPhone");

export const stepRouter = actionGeneric({
  args: {
    phone: v.string(),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.union(
          v.string(),
          v.array(
            v.union(
              v.object({ type: v.literal("text"), text: v.string() }),
              v.object({
                type: v.literal("tool_use"),
                id: v.string(),
                name: v.string(),
                input: v.any(),
              }),
              v.object({
                type: v.literal("tool_result"),
                tool_use_id: v.string(),
                content: v.string(),
              }),
            ),
          ),
        ),
      }),
    ),
    memorySummary: v.optional(v.string()),
    localContext: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    content: ContentBlock[];
    stopReason: string;
  }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY in Convex environment.");
    }

    const activeQuestRow = await ctx.runQuery(getActiveQuestForPhoneRef, {
      phone: args.phone,
    });

    const dynamicLines: string[] = [];
    if (args.memorySummary?.trim()) {
      dynamicLines.push(`what you know about them: ${args.memorySummary}`);
    } else {
      dynamicLines.push("no prior memory of this user");
    }
    if (args.localContext?.trim()) {
      dynamicLines.push(`local context (use silently): ${args.localContext}`);
    }
    if (args.country) {
      dynamicLines.push(`their phone country: ${args.country}`);
    }
    if (activeQuestRow) {
      dynamicLines.push(formatActiveQuest(activeQuestRow));
    } else {
      dynamicLines.push("no recent quest within the last 24 hours");
    }
    const dynamicContext = dynamicLines.join("\n\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CONVERSATION_MODEL,
        max_tokens: 400,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: dynamicContext,
          },
        ],
        tools: ROUTER_TOOLS,
        messages: args.messages as RouterMessage[],
      }),
    });

    const body = (await response.json()) as ClaudeMessageResponse & {
      stop_reason?: string;
      content?: ContentBlock[];
    };

    if (!response.ok) {
      throw new Error(body.error?.message ?? "Router LLM call failed.");
    }

    return {
      content: body.content ?? [],
      stopReason: body.stop_reason ?? "end_turn",
    };
  },
});

export const executeTool = actionGeneric({
  args: {
    phone: v.string(),
    toolUseId: v.string(),
    toolName: v.string(),
    toolInput: v.any(),
    country: v.optional(v.string()),
    memorySummary: v.optional(v.string()),
    localContext: v.optional(v.string()),
    publicBaseUrl: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ toolUseId: string; content: string }> => {
    try {
      if (args.toolName === "make_quest") {
        const input = args.toolInput as { vibe_summary?: string };
        const vibe = input.vibe_summary?.trim();
        if (!vibe) {
          return {
            toolUseId: args.toolUseId,
            content: "error: vibe_summary is required",
          };
        }
        const quest = await ctx.runAction(generateQuest, {
          request: vibe,
          country: args.country,
          memorySummary: args.memorySummary,
          localContext: args.localContext,
          phone: args.phone,
          source: "imessage",
        });
        const url = new URL(quest.url, args.publicBaseUrl).toString();
        return {
          toolUseId: args.toolUseId,
          content: `quest made. title: "${quest.title}". url: ${url}`,
        };
      }

      if (args.toolName === "look_up_place") {
        const input = args.toolInput as { query?: string };
        const query = input.query?.trim();
        if (!query) {
          return {
            toolUseId: args.toolUseId,
            content: "error: query is required",
          };
        }
        const summary = await lookUpPlace(query);
        return { toolUseId: args.toolUseId, content: summary };
      }

      if (args.toolName === "save_outcome") {
        const input = args.toolInput as {
          outcome?: "won" | "lost" | "skipped";
        };
        const outcome = input.outcome;
        if (!outcome) {
          return {
            toolUseId: args.toolUseId,
            content: "error: outcome is required",
          };
        }
        const saved = await ctx.runMutation(saveLatestOutcomeForPhone, {
          phone: args.phone,
          outcome,
        });
        if (!saved) {
          return {
            toolUseId: args.toolUseId,
            content:
              "no recent quest to attach this outcome to (older than 24h or already recorded)",
          };
        }
        return {
          toolUseId: args.toolUseId,
          content: `saved outcome=${outcome} on quest "${saved.title}"`,
        };
      }

      return {
        toolUseId: args.toolUseId,
        content: `error: unknown tool ${args.toolName}`,
      };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return { toolUseId: args.toolUseId, content: `error: ${message}` };
    }
  },
});

async function lookUpPlace(query: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CONVERSATION_MODEL,
      max_tokens: 300,
      system:
        "you look up specific real-world places using web search. given a query, return a SHORT factual summary: " +
        "current opening hours if available, address/neighborhood, and one line about what they're known for. " +
        "no commentary, no recommendations — just the facts. if you couldn't find reliable info, say so.",
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
      messages: [{ role: "user", content: query }],
    }),
  });

  const body = (await response.json()) as ClaudeMessageResponse;
  if (!response.ok) {
    throw new Error(body.error?.message ?? "look_up_place failed");
  }

  const text = body.content
    ?.filter((block) => block.type === "text" && block.text)
    .map((block) => block.text!.trim())
    .join(" ")
    .trim();

  return text || "couldn't find anything reliable for that query.";
}

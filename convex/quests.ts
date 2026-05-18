import { actionGeneric, mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { nanoid } from "nanoid";

import {
  saveGeneratedQuest as saveGeneratedQuestRef,
  type QuestRecord,
} from "../lib/convexFunctions";
import {
  CONVERSATION_MODEL,
  QUEST_CRAFTING_MODEL,
  extractQuestFromClaudeResponse,
  questTool,
  type ClaudeMessageResponse,
} from "../lib/claudeQuest";

const stopValidator = v.object({
  name: v.string(),
  description: v.string(),
  mapSearch: v.string(),
  estimatedCost: v.string(),
});

const questPayloadArgs = {
  title: v.string(),
  brief: v.string(),
  stops: v.array(stopValidator),
  budget: v.string(),
  inviteText: v.string(),
  backup: v.string(),
};

export const getByShortId = queryGeneric({
  args: { shortId: v.string() },
  handler: async (ctx, args): Promise<QuestRecord | null> => {
    const quest = await ctx.db
      .query("quests")
      .withIndex("by_shortId", (q) => q.eq("shortId", args.shortId))
      .unique();

    if (!quest) {
      return null;
    }

    return {
      shortId: quest.shortId,
      request: quest.request,
      title: quest.title,
      brief: quest.brief,
      stops: quest.stops,
      budget: quest.budget,
      inviteText: quest.inviteText,
      backup: quest.backup,
      createdAt: quest.createdAt,
    };
  },
});

export const saveGeneratedQuest = mutationGeneric({
  args: {
    shortId: v.string(),
    request: v.string(),
    ...questPayloadArgs,
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("quests", {
      ...args,
      createdAt: Date.now(),
    });

    return {
      id: args.shortId,
      url: `/q/${args.shortId}`,
    };
  },
});

export const generateFollowup = actionGeneric({
  args: {
    request: v.string(),
    country: v.optional(v.string()),
    memorySummary: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ question: string }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Missing ANTHROPIC_API_KEY in Convex environment variables.",
      );
    }

    const countryHint = args.country
      ? `their phone area code suggests ${args.country}, but trust their message if it says otherwise`
      : "you don't know what country they're in";

    const memoryBlock = args.memorySummary?.trim()
      ? `what we already know about them: ${args.memorySummary}`
      : "we have no prior memory of this user yet";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CONVERSATION_MODEL,
        max_tokens: 100,
        system:
          "you're sidequest, an imessage agent that suggests irl things to do. " +
          "ask ONE short follow-up text to fill the biggest gap.\n\n" +
          "factors that matter (rough priority):\n" +
          "1. location (city/neighborhood)\n" +
          "2. vibe/mood (chill, party, romantic, adventurous, foodie, outdoor, indoor)\n" +
          "3. budget\n" +
          "4. who they're with (solo, date, friends, family)\n" +
          "5. when / how much time\n" +
          "6. energy level (sit & chat, walk around, active)\n" +
          "7. constraints (dietary, weather, no booze, accessibility)\n\n" +
          "if memory already covers a factor, do NOT re-ask it. pick the most-useful missing one. " +
          "if everything's covered, ask something specific that would sharpen the plan (e.g. 'food first or vibe first?'). " +
          "tone: high school friend over imessage. all lowercase. under 12 words. no preamble. no 'sure!' or 'got it!'. just the question.",
        messages: [
          {
            role: "user",
            content:
              `their msg: "${args.request}"\n` +
              `${memoryBlock}\n` +
              `context: ${countryHint}\n\n` +
              "what's the one followup u'd ask?",
          },
        ],
      }),
    });

    const body = (await response.json()) as ClaudeMessageResponse;

    if (!response.ok) {
      throw new Error(
        body.error?.message ?? "Couldn't generate a follow-up question.",
      );
    }

    const text = body.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text!.trim())
      .join(" ")
      .trim();

    if (!text) {
      throw new Error("Claude returned no follow-up text.");
    }

    return { question: text };
  },
});

export const generate = actionGeneric({
  args: {
    request: v.string(),
    country: v.optional(v.string()),
    memorySummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = args.request.trim();

    if (request.length < 8) {
      throw new Error("need a little more to go on.");
    }

    // Add this in Convex with: npx convex env set ANTHROPIC_API_KEY your_key_here
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Missing ANTHROPIC_API_KEY in Convex environment variables.",
      );
    }

    const model = process.env.ANTHROPIC_QUEST_MODEL ?? QUEST_CRAFTING_MODEL;

    const countryLine = args.country
      ? `the user's phone area code suggests they're in ${args.country} — assume that unless their message or memory says otherwise. `
      : "";

    const memoryBlock = args.memorySummary?.trim()
      ? `what we know about this user: ${args.memorySummary}`
      : "we have no prior memory of this user.";

    const systemPrompt =
      "you are sidequest. you assign real-world things to do to bored people over imessage.\n\n" +
      "TONE: lowercase, short, sounds like a high school friend texting. no caps, no exclamation marks, no corporate energy. " +
      "no 'mission' / 'case file' / 'checkpoint' / 'dispatch' / 'protocol' language. think 'go grab x at y' not 'tactical refueling stop'. " +
      "the title, brief, stop descriptions, inviteText, and backup all need to sound like a friend texting.\n\n" +
      "FACTORS to consider for every plan: location (city/neighborhood), vibe (chill, party, romantic, adventurous, foodie, outdoor, indoor), " +
      "budget, group (solo, date, friends, family), time, duration, energy level, constraints (dietary, weather, etc.). " +
      "use whatever the user said + memory; for unknowns, infer the most reasonable default. " +
      "if memory says the user is on vacation, lean toward 'make the most of being here' — local-only spots, hidden gems, things they wouldn't do at home. " +
      "respect dietary / constraint notes from memory.\n\n" +
      countryLine +
      "ALWAYS use the web_search tool to ground stops in specific real places that currently exist in the user's area. " +
      "prefer spots with recent reviews. after researching, call create_sidequest exactly once to deliver the final plan.";

    const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
      {
        role: "user",
        content:
          `user said: ${request}\n\n` +
          `${memoryBlock}\n\n` +
          "search the web for specific real places that fit. " +
          "then call create_sidequest with the plan: exactly three stops. " +
          "do not write the plan in plain text outside the tool call.",
      },
    ];

    const MAX_RESUMES = 3;
    let body: ClaudeMessageResponse | undefined;

    for (let attempt = 0; attempt <= MAX_RESUMES; attempt++) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 8000,
          system: systemPrompt,
          tools: [
            questTool,
            { type: "web_search_20260209", name: "web_search" },
          ],
          messages,
        }),
      });

      body = (await response.json()) as ClaudeMessageResponse;

      if (!response.ok) {
        throw new Error(
          body.error?.message ?? "Claude quest generation failed.",
        );
      }

      // Server-side web_search loop hit its iteration limit — append the
      // assistant turn and re-send so the server resumes where it left off.
      if (body.stop_reason === "pause_turn" && attempt < MAX_RESUMES) {
        messages.push({ role: "assistant", content: body.content });
        continue;
      }

      break;
    }

    const quest = extractQuestFromClaudeResponse(body!);
    const shortId = nanoid(8);

    return await ctx.runMutation(saveGeneratedQuestRef, {
      ...quest,
      shortId,
      request,
    });
  },
});

import { actionGeneric, mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { nanoid } from "nanoid";

import {
  saveGeneratedQuest as saveGeneratedQuestRef,
  type QuestRecord,
} from "../lib/convexFunctions";
import {
  extractQuestFromClaudeResponse,
  questTool,
  type ClaudeMessageResponse,
} from "../lib/claudeQuest";
import { fetchMessages } from "../lib/llmProvider";

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
      phone: quest.phone,
      initialRequest: quest.initialRequest,
      followupAnswer: quest.followupAnswer,
      source: quest.source,
      title: quest.title,
      brief: quest.brief,
      stops: quest.stops,
      budget: quest.budget,
      inviteText: quest.inviteText,
      backup: quest.backup,
      createdAt: quest.createdAt,
      outcome: quest.outcome,
      outcomeAt: quest.outcomeAt,
    };
  },
});

export const listRecent = queryGeneric({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<QuestRecord[]> => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const quests = await ctx.db.query("quests").order("desc").take(limit);

    return quests.map((quest) => ({
      shortId: quest.shortId,
      request: quest.request,
      phone: quest.phone,
      initialRequest: quest.initialRequest,
      followupAnswer: quest.followupAnswer,
      source: quest.source,
      title: quest.title,
      brief: quest.brief,
      stops: quest.stops,
      budget: quest.budget,
      inviteText: quest.inviteText,
      backup: quest.backup,
      createdAt: quest.createdAt,
      outcome: quest.outcome,
      outcomeAt: quest.outcomeAt,
    }));
  },
});

export const listByPhone = queryGeneric({
  args: { phone: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<QuestRecord[]> => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const quests = await ctx.db
      .query("quests")
      .order("desc")
      .filter((q) => q.eq(q.field("phone"), args.phone))
      .take(limit);

    return quests.map((quest) => ({
      shortId: quest.shortId,
      request: quest.request,
      phone: quest.phone,
      initialRequest: quest.initialRequest,
      followupAnswer: quest.followupAnswer,
      source: quest.source,
      title: quest.title,
      brief: quest.brief,
      stops: quest.stops,
      budget: quest.budget,
      inviteText: quest.inviteText,
      backup: quest.backup,
      createdAt: quest.createdAt,
      outcome: quest.outcome,
      outcomeAt: quest.outcomeAt,
    }));
  },
});

// Time window in which we'll attach a W/L signal to the most recent quest.
// Beyond 48h, an isolated "L" probably isn't about an old sidequest — treat
// the message as a fresh request and ignore the feedback parse.
const OUTCOME_WINDOW_MS = 48 * 60 * 60 * 1000;

export const saveLatestOutcomeForPhone = mutationGeneric({
  args: {
    phone: v.string(),
    outcome: v.union(
      v.literal("won"),
      v.literal("lost"),
      v.literal("skipped"),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ shortId: string; title: string } | null> => {
    const latest = await ctx.db
      .query("quests")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .order("desc")
      .first();

    if (!latest) return null;
    if (latest.outcome) return null;
    if (Date.now() - latest.createdAt > OUTCOME_WINDOW_MS) return null;

    await ctx.db.patch(latest._id, {
      outcome: args.outcome,
      outcomeAt: Date.now(),
    });

    return { shortId: latest.shortId, title: latest.title };
  },
});

export const saveGeneratedQuest = mutationGeneric({
  args: {
    shortId: v.string(),
    request: v.string(),
    phone: v.optional(v.string()),
    initialRequest: v.optional(v.string()),
    followupAnswer: v.optional(v.string()),
    source: v.optional(
      v.union(v.literal("admin"), v.literal("imessage"), v.literal("terminal")),
    ),
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

export const generateAck = actionGeneric({
  args: {
    pendingRequest: v.string(),
    followup: v.string(),
    country: v.optional(v.string()),
    memorySummary: v.optional(v.string()),
    localContext: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ ack: string }> => {
    const memoryBlock = args.memorySummary?.trim()
      ? `what we know about them: ${args.memorySummary}`
      : "no prior memory";

    const countryBlock = args.country
      ? `country: ${args.country}`
      : "country: unknown";

    const localContextLine = args.localContext?.trim()
      ? `local context: ${args.localContext}`
      : "";

    const response = await fetchMessages("conversation", {
      max_tokens: 60,
      system:
        "you're sidequest. the user just told u what they want. u're about to make them a plan but it'll take ~10 sec. " +
        "send ONE quick text to ack what they said and signal u're on it.\n\n" +
        "rules:\n" +
        "- tone: high school friend over imessage. all lowercase. under 12 words. no caps, no exclamation marks.\n" +
        "- react SPECIFICALLY to what they said — vibe, mood, group, time. examples: \"bet, hiking spots incoming\", \"ohh date night, gimme a sec\", \"clubbing edition cooking\", \"chill mode locked in\", \"broke night, no problem\".\n" +
        "- do NOT invent factual claims: weather, news, current events, prices, distances. you don't know any of that.\n" +
        "- do NOT list options or preview what u'll suggest. just ack + say u're on it.\n" +
        "- no preamble. no 'sure!' or 'got it!'. just the text.",
      messages: [
        {
          role: "user",
          content:
            `their initial msg: "${args.pendingRequest}"\n` +
            `their followup answer: "${args.followup}"\n` +
            `${countryBlock}\n` +
            (localContextLine ? `${localContextLine}\n` : "") +
            `${memoryBlock}\n\n` +
            "write the one ack text.",
        },
      ],
    });

    const body = (await response.json()) as ClaudeMessageResponse;

    if (!response.ok) {
      throw new Error(body.error?.message ?? "Couldn't generate ack.");
    }

    const text = body.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text!.trim())
      .join(" ")
      .trim();

    if (!text) {
      throw new Error("Claude returned no ack text.");
    }

    return { ack: text };
  },
});

export const generateHandoff = actionGeneric({
  args: {
    title: v.string(),
    initialRequest: v.optional(v.string()),
    followupAnswer: v.optional(v.string()),
    country: v.optional(v.string()),
    memorySummary: v.optional(v.string()),
    localContext: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ text: string }> => {
    const memoryBlock = args.memorySummary?.trim()
      ? `what we know about them: ${args.memorySummary}`
      : "no prior memory";

    const localContextLine = args.localContext?.trim()
      ? `local context: ${args.localContext}`
      : "";

    const initialLine = args.initialRequest?.trim()
      ? `what they asked for: "${args.initialRequest}"`
      : "";

    const followupLine = args.followupAnswer?.trim()
      ? `their followup: "${args.followupAnswer}"`
      : "";

    const response = await fetchMessages("conversation", {
      max_tokens: 60,
      system:
        "you're sidequest. u just finished making the user a real-world thing to do. " +
        "u're about to send them the link to the mission card. write ONE short text that hands it off. " +
        "the link goes on the next line — DO NOT include it yourself.\n\n" +
        "rules:\n" +
        "- tone: high school friend over imessage. all lowercase. under 10 words. no caps, no exclamation marks.\n" +
        "- vary phrasing each time. don't sound canned or like 'ight here u go' / 'here you go' every time.\n" +
        "- u CAN riff on the quest's theme if it adds energy (e.g. food/cafe/date/late-night/hike) — but DON'T spoil the specific place names.\n" +
        "- do NOT say 'check this out', 'enjoy', 'hope u like it', or 'lmk what u think'.\n" +
        "- no preamble. no 'sure!' or 'got it!'. just the one line.",
      messages: [
        {
          role: "user",
          content:
            `the quest title is: "${args.title}"\n` +
            (initialLine ? `${initialLine}\n` : "") +
            (followupLine ? `${followupLine}\n` : "") +
            (localContextLine ? `${localContextLine}\n` : "") +
            `${memoryBlock}\n\n` +
            "write the one handoff text.",
        },
      ],
    });

    const body = (await response.json()) as ClaudeMessageResponse;

    if (!response.ok) {
      throw new Error(body.error?.message ?? "Couldn't generate handoff.");
    }

    const text = body.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text!.trim())
      .join(" ")
      .trim();

    if (!text) {
      throw new Error("Claude returned no handoff text.");
    }

    return { text };
  },
});

export const generateOutcomeAck = actionGeneric({
  args: {
    outcome: v.union(
      v.literal("won"),
      v.literal("lost"),
      v.literal("skipped"),
    ),
    questTitle: v.optional(v.string()),
    country: v.optional(v.string()),
    memorySummary: v.optional(v.string()),
    localContext: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ text: string }> => {
    const memoryBlock = args.memorySummary?.trim()
      ? `what we know about them: ${args.memorySummary}`
      : "no prior memory";

    const localContextLine = args.localContext?.trim()
      ? `local context: ${args.localContext}`
      : "";

    const titleLine = args.questTitle?.trim()
      ? `the quest was: "${args.questTitle}"`
      : "we don't know what quest they're reacting to";

    const outcomeMeaning =
      args.outcome === "won"
        ? "won = they did the quest and it ruled"
        : args.outcome === "lost"
          ? "lost = they tried it but it didn't hit"
          : "skipped = they didn't go (no judgment, not a fail)";

    const response = await fetchMessages("conversation", {
      max_tokens: 60,
      system:
        "you're sidequest. the user just told u how their last quest went. react like a friend.\n\n" +
        "rules:\n" +
        "- tone: high school friend over imessage. all lowercase. under 14 words. no caps, no exclamation marks.\n" +
        "- match the energy: 'won' = genuinely hyped for them. 'lost' = chill, no pity, vibe is 'next one's gonna hit'. 'skipped' = zero pressure, easy to come back when they're ready.\n" +
        "- u CAN reference the quest theme/title if it lands naturally — but don't recap.\n" +
        "- vary phrasing. don't fall into 'ayy lets gooo' / 'damn ok' / 'all good' every time.\n" +
        "- no preamble. no 'sure!' or 'got it!'. just the reaction.",
      messages: [
        {
          role: "user",
          content:
            `their outcome: ${args.outcome} (${outcomeMeaning})\n` +
            `${titleLine}\n` +
            (localContextLine ? `${localContextLine}\n` : "") +
            `${memoryBlock}\n\n` +
            "write the one reaction text.",
        },
      ],
    });

    const body = (await response.json()) as ClaudeMessageResponse;

    if (!response.ok) {
      throw new Error(body.error?.message ?? "Couldn't generate outcome ack.");
    }

    const text = body.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text!.trim())
      .join(" ")
      .trim();

    if (!text) {
      throw new Error("Claude returned no outcome ack text.");
    }

    return { text };
  },
});

export const generateFollowup = actionGeneric({
  args: {
    request: v.string(),
    country: v.optional(v.string()),
    memorySummary: v.optional(v.string()),
    localContext: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ question: string }> => {
    const countryHint = args.country
      ? `their phone area code suggests ${args.country}, but trust their message if it says otherwise`
      : "you don't know what country they're in";

    const memoryBlock = args.memorySummary?.trim()
      ? `what we already know about them: ${args.memorySummary}`
      : "we have no prior memory of this user yet";

    const localContextLine = args.localContext?.trim()
      ? `local context (use silently, never re-ask): ${args.localContext}`
      : "";

    const response = await fetchMessages("conversation", {
      max_tokens: 100,
      system:
        "you're sidequest, an imessage agent that suggests irl things to do. " +
        "your job RIGHT NOW: ask ONE short follow-up QUESTION. your reply MUST end with a question mark. " +
        "never just ack/vibe (no 'bored szn lets cook' / 'on it' / 'gimme a sec'). always end with a real question.\n\n" +
        "factors that matter (rough priority):\n" +
        "1. location (city/neighborhood)\n" +
        "2. vibe/mood (chill, party, romantic, adventurous, foodie, outdoor, indoor)\n" +
        "3. budget\n" +
        "4. who they're with (solo, date, friends, family)\n" +
        "5. when / how much time\n" +
        "6. energy level (sit & chat, walk around, active)\n" +
        "7. constraints (dietary, weather, no booze, accessibility)\n\n" +
        "if memory already covers a factor, do NOT re-ask it. pick the most-useful missing one. " +
        "if every factor is already covered, ask something that sharpens the plan (e.g. 'food first or drinks first?', 'walk or take the train?', 'down for somewhere new or a usual?'). " +
        "tone: high school friend over imessage. all lowercase. under 14 words. no preamble. no 'sure!' or 'got it!'. just the question.",
      messages: [
        {
          role: "user",
          content:
            `their msg: "${args.request}"\n` +
            `${memoryBlock}\n` +
            `context: ${countryHint}\n` +
            (localContextLine ? `${localContextLine}\n` : "") +
            "\nwhat's the one followup u'd ask?",
        },
      ],
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
    localContext: v.optional(v.string()),
    phone: v.optional(v.string()),
    initialRequest: v.optional(v.string()),
    followupAnswer: v.optional(v.string()),
    source: v.optional(
      v.union(v.literal("admin"), v.literal("imessage"), v.literal("terminal")),
    ),
  },
  handler: async (ctx, args) => {
    const request = args.request.trim();

    if (request.length < 8) {
      throw new Error("need a little more to go on.");
    }

    const countryLine = args.country
      ? `the user's phone area code suggests they're in ${args.country} — assume that unless their message or memory says otherwise. `
      : "";

    const localContextLine = args.localContext?.trim()
      ? `LOCAL CONTEXT (you know this silently — never re-ask, never explicitly mention you know): ${args.localContext}. let it shape your suggestions naturally (e.g. night-mode places if it's late, places open right now, neighborhoods near them).\n\n`
      : "";

    const memoryBlock = args.memorySummary?.trim()
      ? `what we know about this user: ${args.memorySummary}`
      : "we have no prior memory of this user.";

    const systemPrompt =
      "you are sidequest. you assign real-world things to do to bored people over imessage.\n\n" +
      "TONE: lowercase, short, sounds like a high school friend texting. no caps, no exclamation marks, no corporate energy. " +
      "no 'mission' / 'case file' / 'checkpoint' / 'dispatch' / 'protocol' language. think 'go grab x at y' not 'tactical refueling stop'. " +
      "the title, brief, stop descriptions, inviteText, and backup all need to sound like a friend texting.\n\n" +
      "HARD RULES (do not break these — these are why users come to sidequest at all):\n" +
      "- every stop MUST name a specific real place (actual business or venue name).\n" +
      "- NEVER tell the user to 'find a coffee shop' or 'search google maps' or 'look for a bar nearby'. that is the user doing your job. you do the work and name the place.\n" +
      "- mapSearch field for each stop must be the place's specific name + neighborhood/city — not a generic category search.\n" +
      "- if you genuinely can't find a real place via web_search, fall back to your own knowledge of the city and name a real, well-known venue you know exists. never punt to a generic instruction.\n" +
      "- 3 distinct stops. don't repeat the same vibe across all three.\n\n" +
      "FACTORS to consider for every plan: location (city/neighborhood), vibe (chill, party, romantic, adventurous, foodie, outdoor, indoor), " +
      "budget, group (solo, date, friends, family), time, duration, energy level, constraints (dietary, weather, etc.). " +
      "use whatever the user said + memory; for unknowns, infer the most reasonable default. " +
      "if memory says the user is on vacation, lean toward 'make the most of being here' — local-only spots, hidden gems, things they wouldn't do at home. " +
      "respect dietary / constraint notes from memory.\n\n" +
      countryLine +
      localContextLine +
      "use the web_search tool aggressively to ground stops in specific real places with recent reviews. " +
      "after researching, call create_sidequest exactly once to deliver the final plan.";

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
      const response = await fetchMessages("quest", {
        max_tokens: 8000,
        system: systemPrompt,
        tools: [
          questTool,
          { type: "web_search_20260209", name: "web_search" },
        ],
        messages,
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

    // Fallback: if Claude finished without calling create_sidequest (e.g. it
    // wrapped up research as plain text), force the structured tool call.
    const hasQuestToolCall = body!.content?.some(
      (block) => block.type === "tool_use" && block.name === questTool.name,
    );

    if (!hasQuestToolCall) {
      messages.push({ role: "assistant", content: body!.content });
      messages.push({
        role: "user",
        content:
          "you didn't call create_sidequest yet. " +
          "use what you researched and call it now with exactly three stops. " +
          "do not write any text outside the tool call.",
      });

      const fallbackResponse = await fetchMessages("quest", {
        max_tokens: 2000,
        system: systemPrompt,
        tools: [questTool],
        tool_choice: { type: "tool", name: questTool.name },
        messages,
      });

      body = (await fallbackResponse.json()) as ClaudeMessageResponse;

      if (!fallbackResponse.ok) {
        throw new Error(
          body.error?.message ?? "quest fallback call failed.",
        );
      }
    }

    const quest = extractQuestFromClaudeResponse(body!);
    const shortId = nanoid(8);

    const saved = await ctx.runMutation(saveGeneratedQuestRef, {
      ...quest,
      shortId,
      request,
      phone: args.phone,
      initialRequest: args.initialRequest,
      followupAnswer: args.followupAnswer,
      source: args.source,
    });

    return { ...saved, title: quest.title };
  },
});

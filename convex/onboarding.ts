import { actionGeneric } from "convex/server";
import { v } from "convex/values";

import { type ClaudeMessageResponse } from "../lib/claudeQuest";
import { fetchMessages } from "../lib/llmProvider";

export const generateMirrorReaction = actionGeneric({
  args: {
    mirrorAnswer: v.string(),
    userName: v.string(),
  },
  handler: async (_ctx, args): Promise<{ text: string }> => {
    const response = await fetchMessages("conversation", {
      max_tokens: 80,
      system:
        "you're sidequest. you just asked a new user to tell you about a time they had a lot of fun. " +
        "they shared a real memory. react like a friend who's genuinely interested — brief, warm, specific to what they said. " +
        "then ask where they are right now.\n\n" +
        "your reply MUST follow this structure:\n" +
        "[brief warm reaction to their specific memory]. where u at rn? like neighborhood or city is fine.\n\n" +
        "rules:\n" +
        "- the reaction should be under 15 words and reference something specific from their story\n" +
        "- tone: high school friend over imessage. all lowercase. no caps, no exclamation marks.\n" +
        "- don't say 'that sounds fun' or 'cool' or 'nice' — be specific about what they described\n" +
        "- don't say 'saved' or 'got it' or 'noted' — this isn't a transaction\n" +
        "- end by asking where they are. use the exact phrase: where u at rn? like neighborhood or city is fine.",
      messages: [
        {
          role: "user",
          content: `their name is ${args.userName}. they said: "${args.mirrorAnswer}"`,
        },
      ],
    });

    const body = (await response.json()) as ClaudeMessageResponse;

    if (!response.ok) {
      return {
        text: "that's the kinda stuff i wanna send u more of. where u at rn? like neighborhood or city is fine.",
      };
    }

    const text = body.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text!.trim())
      .join(" ")
      .trim();

    if (!text) {
      return {
        text: "that's the kinda stuff i wanna send u more of. where u at rn? like neighborhood or city is fine.",
      };
    }

    return { text };
  },
});

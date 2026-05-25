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
      max_tokens: 4000,
      system:
        "you're sidequest. you just asked a new user to tell you about a time they had a lot of fun. " +
        "they shared a real memory. react like a friend who's genuinely interested — brief, warm, specific to what they said.\n\n" +
        "rules:\n" +
        "- ONLY react to their memory. do NOT ask any follow-up questions. do NOT ask where they are.\n" +
        "- under 15 words. reference something specific from their story.\n" +
        "- tone: high school friend over imessage. all lowercase. no caps, no exclamation marks.\n" +
        "- don't say 'that sounds fun' or 'cool' or 'nice' — be specific about what they described\n" +
        "- don't say 'saved' or 'got it' or 'noted' — this isn't a transaction\n" +
        "- just the reaction. nothing else.",
      messages: [
        {
          role: "user",
          content: `their name is ${args.userName}. they said: "${args.mirrorAnswer}"`,
        },
      ],
    });

    const body = (await response.json()) as ClaudeMessageResponse;

    if (!response.ok) {
      console.error("mirror reaction failed:", response.status, JSON.stringify(body));
      return {
        text: "that's the kinda stuff i wanna send u more of",
      };
    }

    const text = body.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text!.trim())
      .join(" ")
      .trim();

    if (!text) {
      console.error("mirror reaction empty text, body:", JSON.stringify(body));
      return {
        text: "that's the kinda stuff i wanna send u more of",
      };
    }

    return { text };
  },
});

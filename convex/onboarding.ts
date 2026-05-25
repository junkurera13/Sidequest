import { actionGeneric } from "convex/server";
import { v } from "convex/values";

import { type ClaudeMessageResponse } from "../lib/claudeQuest";
import { fetchMessages } from "../lib/llmProvider";

export const generateColdQuestReaction = actionGeneric({
  args: {
    userAnswer: v.string(),
  },
  handler: async (_ctx, args): Promise<{ text: string }> => {
    const response = await fetchMessages("conversation", {
      max_tokens: 120,
      system:
        "you're sidequest. you just asked a brand new user to look around and tell you the weirdest thing they can see. " +
        "they answered. now you need to:\n" +
        "1. react briefly to what they said (acknowledge it, be amused or interested — make them feel heard)\n" +
        "2. then reveal it was pointless and introduce yourself\n\n" +
        "your reply MUST follow this structure:\n" +
        "[brief reaction to their specific answer]. anyway i literally just made u do that for no reason. " +
        "but that's kinda what i do — i'm sidequest. i send u small random things to do in real life. " +
        "some stupid, some actually cool.\n\nwhat's ur name?\n\n" +
        "rules:\n" +
        "- the reaction part should be under 12 words and reference what they actually said\n" +
        "- tone: high school friend over imessage. all lowercase. no caps, no exclamation marks.\n" +
        "- the intro part after the reaction must stay close to the template above. don't rewrite it creatively.\n" +
        "- end with: what's ur name?",
      messages: [
        {
          role: "user",
          content: `they said: "${args.userAnswer}"`,
        },
      ],
    });

    const body = (await response.json()) as ClaudeMessageResponse;

    if (!response.ok) {
      return {
        text:
          "lol i literally just made u do that for no reason. " +
          "but that's kinda what i do — i'm sidequest. " +
          "i send u small random things to do in real life. " +
          "some stupid, some actually cool.\n\nwhat's ur name?",
      };
    }

    const text = body.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text!.trim())
      .join(" ")
      .trim();

    if (!text) {
      return {
        text:
          "lol i literally just made u do that for no reason. " +
          "but that's kinda what i do — i'm sidequest. " +
          "i send u small random things to do in real life. " +
          "some stupid, some actually cool.\n\nwhat's ur name?",
      };
    }

    return { text };
  },
});

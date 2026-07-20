import { actionGeneric } from "convex/server";
import { v } from "convex/values";

import { type ClaudeMessageResponse } from "../lib/claudeQuest";
import { fetchMessages } from "../lib/llmProvider";

export const generateMemoryReflection = actionGeneric({
  args: {
    memoryText: v.string(),
  },
  handler: async (_ctx, args): Promise<{ text: string }> => {
    const response = await fetchMessages("reflection", {
      max_tokens: 4000,
      system:
        "you're sidequest. a new user just trusted you with a real memory they would live again. " +
        "write one brief imessage reply that makes them feel genuinely heard.\n\n" +
        "rules:\n" +
        "- only react to the memory. do not ask a question.\n" +
        "- under 24 words. evoke one or two concrete details from their story.\n" +
        "- respond to the feeling without dissecting or explaining why the memory worked.\n" +
        "- never mention preferences, patterns, familiar versus unfamiliar, analysis, memory, a profile, or a graph.\n" +
        "- warm and natural, not sentimental, clinical, corporate, or slang-heavy.\n" +
        "- don't say 'saved', 'got it', or 'noted' — this isn't a transaction.\n" +
        "- lowercase, no exclamation marks.\n" +
        "- just the reaction. nothing else.",
      messages: [
        {
          role: "user",
          content: `they said:\n${args.memoryText.slice(0, 12000)}`,
        },
      ],
    });

    const body = (await response.json()) as ClaudeMessageResponse;

    if (!response.ok) {
      console.error("memory reflection failed:", response.status, JSON.stringify(body));
      return {
        text: "yeah, i can see why that one stayed with u",
      };
    }

    const text = body.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text!.trim())
      .join(" ")
      .trim();

    if (!text) {
      console.error("memory reflection empty text, body:", JSON.stringify(body));
      return {
        text: "yeah, i can see why that one stayed with u",
      };
    }

    return { text };
  },
});

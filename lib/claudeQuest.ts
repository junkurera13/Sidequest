import { validateQuestPayload, type QuestPayload } from "./quest";

export const CLAUDE_HAIKU_MODEL = "claude-haiku-4-5-20251001";
export const CLAUDE_SONNET_MODEL = "claude-sonnet-4-6";

// Sonnet is the smarter model used for quest crafting. Haiku handles light
// conversational steps like the follow-up question.
export const QUEST_CRAFTING_MODEL = CLAUDE_SONNET_MODEL;
export const CONVERSATION_MODEL = CLAUDE_HAIKU_MODEL;

export const questTool = {
  name: "create_sidequest",
  description:
    "Create one Sidequest mission file from the user's boredom report.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "brief",
      "stops",
      "budget",
      "inviteText",
      "backup",
    ],
    properties: {
      title: { type: "string" },
      brief: { type: "string" },
      stops: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "description", "mapSearch", "estimatedCost"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            mapSearch: { type: "string" },
            estimatedCost: { type: "string" },
          },
        },
      },
      budget: { type: "string" },
      inviteText: { type: "string" },
      backup: { type: "string" },
    },
  },
} as const;

export type ClaudeMessageResponse = {
  content?: Array<{
    type?: string;
    name?: string;
    input?: unknown;
    text?: string;
  }>;
  stop_reason?: string;
  error?: {
    message?: string;
  };
};

export function extractQuestFromClaudeResponse(
  response: ClaudeMessageResponse,
): QuestPayload {
  const toolUse = response.content?.find(
    (content) =>
      content.type === "tool_use" && content.name === questTool.name,
  );

  if (!toolUse) {
    throw new Error("Claude returned no create_sidequest tool call.");
  }

  return validateQuestPayload(toolUse.input);
}

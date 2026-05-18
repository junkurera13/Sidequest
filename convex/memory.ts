import { actionGeneric } from "convex/server";
import { v } from "convex/values";

import {
  CONVERSATION_MODEL,
  type ClaudeMessageResponse,
} from "../lib/claudeQuest";
import { patchUserMemory } from "../lib/convexFunctions";

const memoryTool = {
  name: "update_user_memory",
  description:
    "patch a sidequest user's memory record with new facts inferred from a conversation",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: {
        type: "string",
        description: "user's first name if mentioned",
      },
      homeCity: {
        type: "string",
        description: "the city the user lives in / calls home",
      },
      currentCity: {
        type: "string",
        description:
          "where they are right now if traveling or different from home; omit if same as home",
      },
      onVacation: {
        type: "boolean",
        description: "true if they're traveling / away from home",
      },
      notes: {
        type: "string",
        description:
          "brief facts about preferences, lifestyle, constraints, dietary, group dynamics, partner names, etc. keep under 500 chars total. merge with existing notes — don't restate stale info.",
      },
    },
  },
} as const;

export const updateMemory = actionGeneric({
  args: {
    phone: v.string(),
    conversation: v.string(),
    existingMemory: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Missing ANTHROPIC_API_KEY in Convex environment variables.",
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CONVERSATION_MODEL,
        max_tokens: 600,
        system:
          "you maintain memory for sidequest about one user. " +
          "read the existing memory + new conversation, then call update_user_memory with ONLY the fields that have new or clearer info. " +
          "never invent facts. if a field is unchanged, omit it. " +
          "notes: brief, concrete facts about preferences, lifestyle, constraints. merge with existing notes — keep under 500 chars total. drop stale entries. " +
          "do not output text outside the tool call.",
        tools: [memoryTool],
        tool_choice: { type: "tool", name: memoryTool.name },
        messages: [
          {
            role: "user",
            content:
              `existing memory: ${args.existingMemory || "(empty)"}\n\n` +
              `new conversation:\n${args.conversation}\n\n` +
              "call update_user_memory with only the fields that should change.",
          },
        ],
      }),
    });

    const body = (await response.json()) as ClaudeMessageResponse;

    if (!response.ok) {
      // Don't throw — memory updates shouldn't break the user-facing flow.
      console.error("memory update failed:", body.error?.message);
      return { updated: false };
    }

    const toolUse = body.content?.find(
      (block) =>
        block.type === "tool_use" && block.name === memoryTool.name,
    );

    if (!toolUse || typeof toolUse.input !== "object" || !toolUse.input) {
      return { updated: false };
    }

    const patch = toolUse.input as {
      name?: string;
      homeCity?: string;
      currentCity?: string;
      onVacation?: boolean;
      notes?: string;
    };

    // No fields to update — skip the mutation.
    if (Object.keys(patch).length === 0) {
      return { updated: false };
    }

    await ctx.runMutation(patchUserMemory, {
      phone: args.phone,
      ...patch,
    });

    return { updated: true };
  },
});

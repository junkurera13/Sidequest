import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

import { type ClaudeMessageResponse } from "../lib/claudeQuest";
import { validateExperienceGraph } from "../lib/experienceGraph";
import { fetchMessages } from "../lib/llmProvider";

const MAX_ATTEMPTS = 3;

const experienceGraphTool = {
  name: "record_experience_graph",
  description:
    "Record a bounded, evidence-based graph of the people, experience, emotions, and patterns present in one meaningful memory.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "nodes", "edges"],
    properties: {
      summary: {
        type: "string",
        description:
          "A concise internal summary of why the memory mattered. Never address the user directly.",
      },
      nodes: {
        type: "array",
        minItems: 2,
        maxItems: 18,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "key",
            "kind",
            "label",
            "description",
            "certainty",
            "confidence",
            "evidence",
          ],
          properties: {
            key: {
              type: "string",
              description: "A unique short snake_case key within this graph.",
            },
            kind: {
              type: "string",
              enum: [
                "person",
                "place",
                "activity",
                "setting",
                "emotion",
                "motif",
                "constraint",
                "context",
                "memory",
              ],
            },
            label: { type: "string" },
            description: { type: "string" },
            certainty: { type: "string", enum: ["fact", "hypothesis"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            evidence: {
              type: "string",
              description:
                "A short paraphrase of the source evidence. Do not invent support.",
            },
          },
        },
      },
      edges: {
        type: "array",
        maxItems: 28,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "fromKey",
            "toKey",
            "relationship",
            "description",
            "certainty",
            "confidence",
            "evidence",
          ],
          properties: {
            fromKey: { type: "string" },
            toKey: { type: "string" },
            relationship: {
              type: "string",
              description:
                "A short snake_case relationship such as shared_with, already_loved, enabled_safety, introduced_discovery, or produced_afterglow.",
            },
            description: { type: "string" },
            certainty: { type: "string", enum: ["fact", "hypothesis"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            evidence: {
              type: "string",
              description:
                "A short paraphrase of the source evidence. Do not invent support.",
            },
          },
        },
      },
    },
  },
} as const;

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

export const analyzeMemory = internalAction({
  args: {
    memoryId: v.id("experienceMemories"),
    phone: v.string(),
    rawText: v.string(),
    attempt: v.number(),
  },
  handler: async (ctx, args): Promise<{ status: "complete" | "retrying" | "failed" }> => {
    try {
      const response = await fetchMessages("memory", {
        max_tokens: 8000,
        system:
          "you are the private memory interpreter for sidequest. a person has trusted you with one real experience they loved. " +
          "build a small evidence-based graph that preserves the people, places, activities, atmosphere, emotions, constraints, and deeper relationships inside the memory.\n\n" +
          "this graph is private creative machinery. never write user-facing copy.\n\n" +
          "rules:\n" +
          "- preserve what was actually said. never invent names, demographics, motives, preferences, or facts.\n" +
          "- mark directly supported information as fact. mark interpretations as hypothesis and lower their confidence.\n" +
          "- capture what the presence of other people enabled, not only generic labels like friends or family.\n" +
          "- capture meaningful relationships among people, activity, setting, emotion, and afterglow.\n" +
          "- distinguish a surface detail from a potentially transferable pattern.\n" +
          "- nationality and demographics are weak context, never substitutes for learned personal knowledge.\n" +
          "- avoid clinical language, personality typing, and permanent identity labels.\n" +
          "- every node and edge must include a short evidence paraphrase.\n" +
          "- call record_experience_graph exactly once and output nothing else.",
        tools: [experienceGraphTool],
        tool_choice: { type: "tool", name: experienceGraphTool.name },
        messages: [
          {
            role: "user",
            content: `memory:\n${args.rawText.slice(0, 16000)}`,
          },
        ],
      });

      const body = (await response.json()) as ClaudeMessageResponse;
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Experience graph analysis failed.");
      }

      const toolUse = body.content?.find(
        (block) =>
          block.type === "tool_use" && block.name === experienceGraphTool.name,
      );
      if (!toolUse) throw new Error("Experience graph analysis returned no tool call.");

      const graph = validateExperienceGraph(toolUse.input);
      const saved: null = await ctx.runMutation(
        internal.experienceGraph.saveAnalysis,
        {
          memoryId: args.memoryId,
          ...graph,
        },
      );
      void saved;
      return { status: "complete" };
    } catch (cause) {
      const message = errorMessage(cause);
      if (args.attempt + 1 < MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          2000 * (args.attempt + 1),
          internal.experienceGraphActions.analyzeMemory,
          {
            ...args,
            attempt: args.attempt + 1,
          },
        );
        console.warn(
          `experience graph analysis attempt ${args.attempt + 1} failed: ${message}`,
        );
        return { status: "retrying" };
      }

      const failed: null = await ctx.runMutation(
        internal.experienceGraph.markAnalysisFailed,
        {
          memoryId: args.memoryId,
          error: message,
        },
      );
      void failed;
      console.error("experience graph analysis failed permanently:", message);
      return { status: "failed" };
    }
  },
});

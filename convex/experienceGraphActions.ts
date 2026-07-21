import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

import { type ClaudeMessageResponse } from "../lib/claudeQuest";
import { validateExperienceGraph } from "../lib/experienceGraph";
import {
  EXPERIENCE_CATEGORY_META,
  EXPERIENCE_FAMILIARITIES,
  EXPERIENCE_NODE_CATEGORIES,
  EXPERIENCE_POLARITIES,
  EXPERIENCE_RELATIONS,
} from "../lib/experienceOntology";
import { fetchMessages } from "../lib/llmProvider";

const MAX_ATTEMPTS = 3;

const categoryGuide = EXPERIENCE_NODE_CATEGORIES.map((category) => {
  const definition = EXPERIENCE_CATEGORY_META[category];
  return `- ${category}: ${definition.purpose} Example subtypes: ${definition.subtypeExamples.join(", ")}.`;
}).join("\n");

const experienceGraphTool = {
  name: "record_experience_graph",
  description:
    "Record a bounded, categorized, evidence-based graph of one meaningful human experience.",
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
            "category",
            "subtype",
            "label",
            "description",
            "certainty",
            "confidence",
            "salience",
            "evidence",
          ],
          properties: {
            key: {
              type: "string",
              description: "A unique short snake_case key within this graph.",
            },
            category: {
              type: "string",
              enum: EXPERIENCE_NODE_CATEGORIES,
            },
            subtype: {
              type: "string",
              description:
                "A precise snake_case subtype such as coastal_island, movement, nostalgia, planning_style, or meaningful_memory.",
            },
            label: {
              type: "string",
              description:
                "A concise human noun or noun phrase. Put conclusions in relationships, not sentence-shaped node labels.",
            },
            description: { type: "string" },
            certainty: { type: "string", enum: ["fact", "hypothesis"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            salience: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description:
                "How central this thing appears to be in the person's lived world, based only on explicit emphasis, enduring emotion, recurrence, and meaningful relationships. This is importance, not confidence.",
            },
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
            "relation",
            "description",
            "polarity",
            "familiarity",
            "strength",
            "certainty",
            "confidence",
            "evidence",
          ],
          properties: {
            fromKey: { type: "string" },
            toKey: { type: "string" },
            relation: {
              type: "string",
              enum: EXPERIENCE_RELATIONS,
            },
            description: { type: "string" },
            polarity: { type: "string", enum: EXPERIENCE_POLARITIES },
            familiarity: {
              type: "string",
              enum: EXPERIENCE_FAMILIARITIES,
              description:
                "Whether this relationship was familiar, new, mixed, or not applicable in the described experience.",
            },
            strength: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description:
                "How strongly this relationship appears to have mattered, separate from confidence in the interpretation.",
            },
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
          "build a small evidence-based graph that preserves the moment, people, places, activities, interests, feelings, conditions, and transferable patterns inside the memory.\n\n" +
          "this graph is private creative machinery. never write user-facing copy.\n\n" +
          "node categories:\n" +
          categoryGuide +
          "\n\n" +
          "rules:\n" +
          "- preserve what was actually said. never invent names, demographics, motives, preferences, or facts.\n" +
          "- mark directly supported information as fact. mark interpretations as hypothesis and lower their confidence.\n" +
          "- nodes are things: use concise nouns or noun phrases. relationships carry the verbs and conclusions. pattern nodes are the only intentional exception.\n" +
          "- do not create two nodes for one underlying thing merely to encode a property. for example, use one cycling activity node and express familiarity through an edge.\n" +
          "- use one primary category and one precise snake_case subtype for every node.\n" +
          "- confidence means how sure the interpretation is. strength means how much a relationship mattered. salience means how central a node appears in the person's lived world. never confuse them.\n" +
          "- calibrate salience from evidence: 0.9-1 only for exceptionally emphasized or repeatedly central things; 0.7-0.89 for clearly meaningful things; 0.4-0.69 for supporting details; below 0.4 for incidental context. category must never create a size bias.\n" +
          "- familiarity records the hidden balance of known and new for future composition; never turn it into user-facing analytical language.\n" +
          "- capture what the presence of other people enabled, not only generic labels like friends or family.\n" +
          "- capture meaningful relationships among people, activity, place, condition, feeling, and afterglow.\n" +
          "- distinguish a surface detail from a potentially transferable pattern.\n" +
          "- familiarity is not proficiency. never claim competence, mastery, or identity unless the person explicitly did.\n" +
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

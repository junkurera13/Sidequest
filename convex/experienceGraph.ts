import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import type { ExperienceNodeCategory } from "../lib/experienceOntology";

const certaintyValidator = v.union(
  v.literal("fact"),
  v.literal("hypothesis"),
);

const nodeCategoryValidator = v.union(
  v.literal("experience"),
  v.literal("people"),
  v.literal("place"),
  v.literal("activity"),
  v.literal("interest"),
  v.literal("feeling"),
  v.literal("condition"),
  v.literal("pattern"),
);

const relationValidator = v.union(
  v.literal("lived"),
  v.literal("cares_about"),
  v.literal("shared_with"),
  v.literal("happened_at"),
  v.literal("involved"),
  v.literal("evoked"),
  v.literal("shaped_by"),
  v.literal("supported"),
  v.literal("reflects"),
  v.literal("part_of"),
  v.literal("drawn_to"),
  v.literal("familiar_with"),
  v.literal("curious_about"),
  v.literal("avoids"),
  v.literal("requires"),
  v.literal("reinforces"),
  v.literal("contrasts_with"),
  v.literal("discovered_through"),
);

const polarityValidator = v.union(
  v.literal("positive"),
  v.literal("negative"),
  v.literal("mixed"),
  v.literal("neutral"),
);

const familiarityValidator = v.union(
  v.literal("familiar"),
  v.literal("new"),
  v.literal("mixed"),
  v.literal("not_applicable"),
);

const nodeDraftValidator = v.object({
  key: v.string(),
  category: nodeCategoryValidator,
  subtype: v.string(),
  label: v.string(),
  description: v.string(),
  certainty: certaintyValidator,
  confidence: v.number(),
  evidence: v.string(),
});

const edgeDraftValidator = v.object({
  fromKey: v.string(),
  toKey: v.string(),
  relation: relationValidator,
  description: v.string(),
  polarity: polarityValidator,
  familiarity: familiarityValidator,
  strength: v.number(),
  certainty: certaintyValidator,
  confidence: v.number(),
  evidence: v.string(),
});

function assertConfidence(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Experience graph confidence must be between 0 and 1.");
  }
}

function legacyKindForCategory(category: ExperienceNodeCategory) {
  switch (category) {
    case "experience":
      return "memory" as const;
    case "people":
      return "person" as const;
    case "place":
      return "place" as const;
    case "activity":
      return "activity" as const;
    case "interest":
      return "motif" as const;
    case "feeling":
      return "emotion" as const;
    case "condition":
      return "context" as const;
    case "pattern":
      return "motif" as const;
  }
}

export const captureOnboardingMemory = mutation({
  args: {
    phone: v.string(),
    rawText: v.string(),
  },
  handler: async (ctx, args) => {
    const rawText = args.rawText.trim();
    if (!rawText) throw new Error("The onboarding memory cannot be empty.");

    const memoryId = await ctx.db.insert("experienceMemories", {
      phone: args.phone,
      source: "onboarding",
      rawText,
      status: "pending",
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(
      0,
      internal.experienceGraphActions.analyzeMemory,
      {
        memoryId,
        phone: args.phone,
        rawText,
        attempt: 0,
      },
    );

    return { memoryId };
  },
});

export const saveAnalysis = internalMutation({
  args: {
    memoryId: v.id("experienceMemories"),
    summary: v.string(),
    nodes: v.array(nodeDraftValidator),
    edges: v.array(edgeDraftValidator),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get("experienceMemories", args.memoryId);
    if (!memory) throw new Error("Experience memory not found.");
    if (memory.status === "complete") return null;

    const now = Date.now();
    const nodeIds = new Map<string, Id<"experienceGraphNodes">>();

    for (const node of args.nodes) {
      assertConfidence(node.confidence);
      if (nodeIds.has(node.key)) {
        throw new Error(`Duplicate experience graph node key: ${node.key}`);
      }
      const nodeId = await ctx.db.insert("experienceGraphNodes", {
        phone: memory.phone,
        memoryId: args.memoryId,
        kind: legacyKindForCategory(node.category),
        ...node,
        createdAt: now,
      });
      nodeIds.set(node.key, nodeId);
    }

    for (const edge of args.edges) {
      assertConfidence(edge.confidence);
      assertConfidence(edge.strength);
      const fromNodeId = nodeIds.get(edge.fromKey);
      const toNodeId = nodeIds.get(edge.toKey);
      if (!fromNodeId || !toNodeId) {
        throw new Error("Experience graph edge references an unknown node.");
      }
      await ctx.db.insert("experienceGraphEdges", {
        phone: memory.phone,
        memoryId: args.memoryId,
        fromNodeId,
        toNodeId,
        relation: edge.relation,
        relationship: edge.relation,
        description: edge.description,
        polarity: edge.polarity,
        familiarity: edge.familiarity,
        strength: edge.strength,
        certainty: edge.certainty,
        confidence: edge.confidence,
        evidence: edge.evidence,
        createdAt: now,
      });
    }

    await ctx.db.patch(args.memoryId, {
      status: "complete",
      summary: args.summary,
      error: undefined,
      processedAt: now,
    });
    return null;
  },
});

export const markAnalysisFailed = internalMutation({
  args: {
    memoryId: v.id("experienceMemories"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get("experienceMemories", args.memoryId);
    if (!memory || memory.status === "complete") return null;
    await ctx.db.patch(args.memoryId, {
      status: "failed",
      error: args.error.slice(0, 500),
      processedAt: Date.now(),
    });
    return null;
  },
});

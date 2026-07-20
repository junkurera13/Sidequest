import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const certaintyValidator = v.union(
  v.literal("fact"),
  v.literal("hypothesis"),
);

const nodeKindValidator = v.union(
  v.literal("person"),
  v.literal("place"),
  v.literal("activity"),
  v.literal("setting"),
  v.literal("emotion"),
  v.literal("motif"),
  v.literal("constraint"),
  v.literal("context"),
  v.literal("memory"),
);

const nodeDraftValidator = v.object({
  key: v.string(),
  kind: nodeKindValidator,
  label: v.string(),
  description: v.string(),
  certainty: certaintyValidator,
  confidence: v.number(),
  evidence: v.string(),
});

const edgeDraftValidator = v.object({
  fromKey: v.string(),
  toKey: v.string(),
  relationship: v.string(),
  description: v.string(),
  certainty: certaintyValidator,
  confidence: v.number(),
  evidence: v.string(),
});

function assertConfidence(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Experience graph confidence must be between 0 and 1.");
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
        ...node,
        createdAt: now,
      });
      nodeIds.set(node.key, nodeId);
    }

    for (const edge of args.edges) {
      assertConfidence(edge.confidence);
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
        relationship: edge.relationship,
        description: edge.description,
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

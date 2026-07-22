import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// These tables are intentionally channel infrastructure, not the new human
// profile or experience graph. They let the iMessage edge accept each Photon
// delivery once and preserve a stable external conversation identity while the
// account-owned memory model is designed separately.
export default defineSchema({
  messagingThreads: defineTable({
    provider: v.literal("spectrum"),
    platform: v.literal("imessage"),
    externalSpaceId: v.string(),
    externalParticipantId: v.string(),
    lineId: v.string(),
    createdAt: v.number(),
    lastInboundAt: v.number(),
  }).index("by_provider_and_external_space_id", [
    "provider",
    "externalSpaceId",
  ]),

  messagingDeliveries: defineTable({
    provider: v.literal("spectrum"),
    webhookId: v.string(),
    externalMessageId: v.string(),
    threadId: v.id("messagingThreads"),
    status: v.union(
      v.literal("claimed"),
      v.literal("enqueued"),
      v.literal("retryable"),
    ),
    claimToken: v.string(),
    leaseExpiresAt: v.number(),
    attempts: v.number(),
    receivedAt: v.number(),
    expiresAt: v.number(),
    enqueuedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index("by_webhook_id_and_external_message_id", [
      "webhookId",
      "externalMessageId",
    ])
    .index("by_expires_at", ["expiresAt"]),
});

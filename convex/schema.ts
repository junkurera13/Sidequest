import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const stop = v.object({
  name: v.string(),
  description: v.string(),
  mapSearch: v.string(),
  estimatedCost: v.string(),
});

export default defineSchema({
  quests: defineTable({
    shortId: v.string(),
    request: v.string(),
    phone: v.optional(v.string()),
    initialRequest: v.optional(v.string()),
    followupAnswer: v.optional(v.string()),
    source: v.optional(
      v.union(v.literal("admin"), v.literal("imessage"), v.literal("terminal")),
    ),
    title: v.string(),
    brief: v.string(),
    stops: v.array(stop),
    budget: v.string(),
    inviteText: v.string(),
    backup: v.string(),
    createdAt: v.number(),
    // W/L feedback parsed from the user's first message after a quest drops.
    outcome: v.optional(
      v.union(v.literal("won"), v.literal("lost"), v.literal("skipped")),
    ),
    outcomeAt: v.optional(v.number()),
  }).index("by_shortId", ["shortId"]).index("by_phone", ["phone"]),
  users: defineTable({
    phone: v.string(),
    firstSeenAt: v.number(),
    state: v.optional(
      v.union(v.literal("idle"), v.literal("awaiting_followup")),
    ),
    pendingRequest: v.optional(v.string()),
    country: v.optional(v.string()),
    name: v.optional(v.string()),
    homeCity: v.optional(v.string()),
    currentCity: v.optional(v.string()),
    onVacation: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    memoryUpdatedAt: v.optional(v.number()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    signedUpAt: v.optional(v.number()),
    assignedPhone: v.optional(v.string()),
    onboardingStep: v.optional(
      v.union(
        v.literal("needs_cold_quest"),
        v.literal("awaiting_cold_response"),
        v.literal("awaiting_name"),
        v.literal("awaiting_mirror"),
        v.literal("awaiting_location"),
        v.literal("complete"),
      ),
    ),
    mirrorAnswers: v.optional(
      v.array(
        v.object({
          question: v.string(),
          answer: v.string(),
          askedAt: v.number(),
        }),
      ),
    ),
  }).index("by_phone", ["phone"]),
  // Short-term conversation context so the router LLM can answer follow-up
  // questions about an active quest, hold chitchat, and remember what was
  // already asked. Long-term facts still live in the `users` row via
  // `updateUserMemory`; this table is just the last few turns per phone.
  conversationMessages: defineTable({
    phone: v.string(),
    role: v.union(v.literal("user"), v.literal("agent")),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_phone", ["phone", "createdAt"]),
});

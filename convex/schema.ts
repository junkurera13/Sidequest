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
    // Captured silently at signup via IP geolocation; used to look up current
    // weather at quest time so the agent can recommend indoor/outdoor spots
    // without having to ask.
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    // Set when a user signs up through the /signup form (vs. first-touch
    // via texting the agent directly). assignedPhone is the Photon
    // pool number we deep-link them to.
    signedUpAt: v.optional(v.number()),
    assignedPhone: v.optional(v.string()),
  }).index("by_phone", ["phone"]),
});

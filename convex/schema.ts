import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const stop = v.object({
  name: v.string(),
  description: v.string(),
  mapSearch: v.string(),
  estimatedCost: v.string(),
});

const experienceCertainty = v.union(
  v.literal("fact"),
  v.literal("hypothesis"),
);

const experienceNodeKind = v.union(
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

const experienceNodeCategory = v.union(
  v.literal("experience"),
  v.literal("people"),
  v.literal("place"),
  v.literal("activity"),
  v.literal("interest"),
  v.literal("feeling"),
  v.literal("condition"),
  v.literal("pattern"),
);

const experienceRelation = v.union(
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

const experiencePolarity = v.union(
  v.literal("positive"),
  v.literal("negative"),
  v.literal("mixed"),
  v.literal("neutral"),
);

const experienceFamiliarity = v.union(
  v.literal("familiar"),
  v.literal("new"),
  v.literal("mixed"),
  v.literal("not_applicable"),
);

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
    firstSidequestWindowText: v.optional(v.string()),
    onboardingStep: v.optional(
      v.union(
        v.literal("needs_memory_invite"),
        v.literal("awaiting_memory"),
        v.literal("awaiting_first_window"),
        v.literal("first_quest_ready"),
        // Deprecated pre-renovation states remain valid while old user rows
        // transition safely into the new memory-first onboarding.
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
  experienceMemories: defineTable({
    phone: v.string(),
    source: v.union(v.literal("onboarding"), v.literal("reflection")),
    rawText: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_phone_and_createdAt", ["phone", "createdAt"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),
  experienceGraphNodes: defineTable({
    phone: v.string(),
    memoryId: v.id("experienceMemories"),
    key: v.string(),
    // Canonical ontology fields are optional during the safe transition from
    // the original free-form graph rows. All new analyses write both fields.
    category: v.optional(experienceNodeCategory),
    subtype: v.optional(v.string()),
    kind: experienceNodeKind,
    label: v.string(),
    description: v.string(),
    certainty: experienceCertainty,
    confidence: v.number(),
    evidence: v.string(),
    createdAt: v.number(),
  })
    .index("by_phone_and_createdAt", ["phone", "createdAt"])
    .index("by_memoryId_and_key", ["memoryId", "key"]),
  experienceGraphEdges: defineTable({
    phone: v.string(),
    memoryId: v.id("experienceMemories"),
    fromNodeId: v.id("experienceGraphNodes"),
    toNodeId: v.id("experienceGraphNodes"),
    // `relationship` remains for compatibility with the first stored graph.
    // New rows also carry the structured fields used by future composition.
    relation: v.optional(experienceRelation),
    polarity: v.optional(experiencePolarity),
    familiarity: v.optional(experienceFamiliarity),
    strength: v.optional(v.number()),
    relationship: v.string(),
    description: v.string(),
    certainty: experienceCertainty,
    confidence: v.number(),
    evidence: v.string(),
    createdAt: v.number(),
  })
    .index("by_phone_and_createdAt", ["phone", "createdAt"])
    .index("by_memoryId_and_createdAt", ["memoryId", "createdAt"]),
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

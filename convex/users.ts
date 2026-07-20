import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

type ConversationState = "idle" | "awaiting_followup";

export type OnboardingStep =
  | "needs_memory_invite"
  | "awaiting_memory"
  | "awaiting_first_window"
  | "first_quest_ready"
  // Deprecated pre-renovation steps remain readable during the migration.
  | "needs_cold_quest"
  | "awaiting_cold_response"
  | "awaiting_name"
  | "awaiting_mirror"
  | "awaiting_location"
  | "complete";

export type MirrorAnswer = {
  question: string;
  answer: string;
  askedAt: number;
};

export type UserMemory = {
  name?: string;
  homeCity?: string;
  currentCity?: string;
  onVacation?: boolean;
  notes?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  mirrorAnswers?: MirrorAnswer[];
};

export const upsertByPhone = mutationGeneric({
  args: {
    phone: v.string(),
    country: v.optional(v.string()),
    currentCity: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    assignedPhone: v.optional(v.string()),
    signedUpAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .unique();

    if (existing) {
      const patch: Record<string, unknown> = {};
      if (args.country && existing.country !== args.country) {
        patch.country = args.country;
      }
      if (!existing.state) {
        patch.state = "idle";
      }
      if (args.assignedPhone && !existing.assignedPhone) {
        patch.assignedPhone = args.assignedPhone;
      }
      // Only set signedUpAt the first time — don't overwrite the original
      // signup timestamp.
      if (args.signedUpAt && !existing.signedUpAt) {
        patch.signedUpAt = args.signedUpAt;
      }
      // Only seed currentCity if we don't already have one — avoid clobbering
      // a user-corrected value with a stale IP-derived guess.
      if (args.currentCity && !existing.currentCity) {
        patch.currentCity = args.currentCity;
      }
      if (args.latitude !== undefined && existing.latitude === undefined) {
        patch.latitude = args.latitude;
      }
      if (args.longitude !== undefined && existing.longitude === undefined) {
        patch.longitude = args.longitude;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }

      const memory: UserMemory = {
        name: existing.name,
        homeCity: existing.homeCity,
        currentCity: (patch.currentCity as string | undefined) ?? existing.currentCity,
        onVacation: existing.onVacation,
        notes: existing.notes,
        country: args.country ?? existing.country,
        latitude: (patch.latitude as number | undefined) ?? existing.latitude,
        longitude: (patch.longitude as number | undefined) ?? existing.longitude,
        mirrorAnswers: existing.mirrorAnswers,
      };

      return {
        isNew: false,
        state: (existing.state ?? "idle") as ConversationState,
        pendingRequest: existing.pendingRequest,
        country: args.country ?? existing.country,
        onboardingStep: (existing.onboardingStep ?? "complete") as OnboardingStep,
        memory,
      };
    }

    await ctx.db.insert("users", {
      phone: args.phone,
      firstSeenAt: Date.now(),
      state: "idle",
      country: args.country,
      currentCity: args.currentCity,
      latitude: args.latitude,
      longitude: args.longitude,
      assignedPhone: args.assignedPhone,
      signedUpAt: args.signedUpAt,
      onboardingStep: "needs_memory_invite",
    });

    return {
      isNew: true,
      state: "idle" as ConversationState,
      pendingRequest: undefined,
      country: args.country,
      onboardingStep: "needs_memory_invite" as OnboardingStep,
      memory: {
        country: args.country,
        currentCity: args.currentCity,
        latitude: args.latitude,
        longitude: args.longitude,
      } as UserMemory,
    };
  },
});

export const setAwaitingFollowup = mutationGeneric({
  args: { phone: v.string(), pendingRequest: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      state: "awaiting_followup",
      pendingRequest: args.pendingRequest,
    });
  },
});

export const resetToIdle = mutationGeneric({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      state: "idle",
      pendingRequest: undefined,
    });
  },
});

export type UserProfile = {
  phone: string;
  firstSeenAt: number;
  state?: ConversationState;
  pendingRequest?: string;
  country?: string;
  name?: string;
  homeCity?: string;
  currentCity?: string;
  onVacation?: boolean;
  notes?: string;
  memoryUpdatedAt?: number;
  signedUpAt?: number;
  assignedPhone?: string;
  firstSidequestWindowText?: string;
  latitude?: number;
  longitude?: number;
  onboardingStep?: OnboardingStep;
  mirrorAnswers?: MirrorAnswer[];
};

export const getByPhone = queryGeneric({
  args: { phone: v.string() },
  handler: async (ctx, args): Promise<UserProfile | null> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .unique();

    if (!user) return null;

    return {
      phone: user.phone,
      firstSeenAt: user.firstSeenAt,
      state: user.state,
      pendingRequest: user.pendingRequest,
      country: user.country,
      name: user.name,
      homeCity: user.homeCity,
      currentCity: user.currentCity,
      onVacation: user.onVacation,
      notes: user.notes,
      memoryUpdatedAt: user.memoryUpdatedAt,
      signedUpAt: user.signedUpAt,
      assignedPhone: user.assignedPhone,
      firstSidequestWindowText: user.firstSidequestWindowText,
      latitude: user.latitude,
      longitude: user.longitude,
      onboardingStep: user.onboardingStep,
      mirrorAnswers: user.mirrorAnswers,
    };
  },
});

export const advanceOnboarding = mutationGeneric({
  args: {
    phone: v.string(),
    step: v.union(
      v.literal("needs_memory_invite"),
      v.literal("awaiting_memory"),
      v.literal("awaiting_first_window"),
      v.literal("first_quest_ready"),
      v.literal("needs_cold_quest"),
      v.literal("awaiting_cold_response"),
      v.literal("awaiting_name"),
      v.literal("awaiting_mirror"),
      v.literal("awaiting_location"),
      v.literal("complete"),
    ),
    name: v.optional(v.string()),
    currentCity: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .unique();

    if (!user) throw new Error("User not found");

    const patch: Record<string, unknown> = { onboardingStep: args.step };
    if (args.name !== undefined) patch.name = args.name;
    if (args.currentCity !== undefined) patch.currentCity = args.currentCity;
    if (args.latitude !== undefined) patch.latitude = args.latitude;
    if (args.longitude !== undefined) patch.longitude = args.longitude;

    await ctx.db.patch(user._id, patch);
  },
});

export const recordFirstSidequestWindow = mutationGeneric({
  args: {
    phone: v.string(),
    windowText: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .unique();

    if (!user) throw new Error("User not found");
    const windowText = args.windowText.trim();
    if (!windowText) throw new Error("The first Sidequest window cannot be empty.");

    await ctx.db.patch(user._id, {
      firstSidequestWindowText: windowText,
      onboardingStep: "first_quest_ready",
    });
    return null;
  },
});

// Deprecated. Kept temporarily so old rows and generated clients can migrate
// without a destructive data change. The new flow stores raw experience
// memories in `experienceMemories` instead of appending to this user array.
export const saveMirrorAnswer = mutationGeneric({
  args: {
    phone: v.string(),
    question: v.string(),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .unique();

    if (!user) throw new Error("User not found");

    const existing = user.mirrorAnswers ?? [];
    await ctx.db.patch(user._id, {
      mirrorAnswers: [
        ...existing,
        {
          question: args.question,
          answer: args.answer,
          askedAt: Date.now(),
        },
      ],
    });
  },
});

export const patchMemory = mutationGeneric({
  args: {
    phone: v.string(),
    name: v.optional(v.string()),
    homeCity: v.optional(v.string()),
    currentCity: v.optional(v.string()),
    onVacation: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const patch: Record<string, unknown> = { memoryUpdatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.homeCity !== undefined) patch.homeCity = args.homeCity;
    if (args.currentCity !== undefined) patch.currentCity = args.currentCity;
    if (args.onVacation !== undefined) patch.onVacation = args.onVacation;
    if (args.notes !== undefined) patch.notes = args.notes;

    await ctx.db.patch(user._id, patch);
  },
});

import { mutationGeneric } from "convex/server";
import { v } from "convex/values";

type ConversationState = "idle" | "awaiting_followup";

export type UserMemory = {
  name?: string;
  homeCity?: string;
  currentCity?: string;
  onVacation?: boolean;
  notes?: string;
  country?: string;
};

export const upsertByPhone = mutationGeneric({
  args: {
    phone: v.string(),
    country: v.optional(v.string()),
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
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }

      const memory: UserMemory = {
        name: existing.name,
        homeCity: existing.homeCity,
        currentCity: existing.currentCity,
        onVacation: existing.onVacation,
        notes: existing.notes,
        country: args.country ?? existing.country,
      };

      return {
        isNew: false,
        state: (existing.state ?? "idle") as ConversationState,
        pendingRequest: existing.pendingRequest,
        country: args.country ?? existing.country,
        memory,
      };
    }

    await ctx.db.insert("users", {
      phone: args.phone,
      firstSeenAt: Date.now(),
      state: "idle",
      country: args.country,
      assignedPhone: args.assignedPhone,
      signedUpAt: args.signedUpAt,
    });

    return {
      isNew: true,
      state: "idle" as ConversationState,
      pendingRequest: undefined,
      country: args.country,
      memory: { country: args.country } as UserMemory,
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

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  cleanDisplayName,
  cleanOptionalLabel,
  normalizeName,
  requireCurrentAccount,
} from "./lib/auth";

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const account = await requireCurrentAccount(ctx);
    return await ctx.db
      .query("personReferences")
      .withIndex("by_owner_account_id", (queryBuilder) =>
        queryBuilder.eq("ownerAccountId", account._id),
      )
      .order("desc")
      .take(100);
  },
});

export const create = mutation({
  args: {
    displayName: v.string(),
    relationship: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await requireCurrentAccount(ctx);
    const displayName = cleanDisplayName(args.displayName);
    const relationship = cleanOptionalLabel(args.relationship);
    const now = Date.now();

    return await ctx.db.insert("personReferences", {
      ownerAccountId: account._id,
      displayName,
      normalizedName: normalizeName(displayName),
      relationship,
      source: "manual",
      createdAt: now,
      updatedAt: now,
    });
  },
});

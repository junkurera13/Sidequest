import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireCurrentAccount } from "./lib/auth";

function cleanTitle(value: string) {
  const title = value.trim().replace(/\s+/g, " ");
  if (title.length < 1 || title.length > 120) {
    throw new Error("Experience names must be between 1 and 120 characters");
  }
  return title;
}

async function requireConnectionMember(
  ctx: QueryCtx | MutationCtx,
  connectionId: Id<"connections">,
) {
  const account = await requireCurrentAccount(ctx);
  const connection = await ctx.db.get(connectionId);
  if (
    connection === null ||
    (connection.accountAId !== account._id &&
      connection.accountBId !== account._id)
  ) {
    throw new Error("Connection not found");
  }
  return account;
}

export const listForConnection = query({
  args: { connectionId: v.id("connections") },
  handler: async (ctx, args) => {
    await requireConnectionMember(ctx, args.connectionId);
    return await ctx.db
      .query("sharedExperiences")
      .withIndex("by_connection_id_and_created_at", (queryBuilder) =>
        queryBuilder.eq("connectionId", args.connectionId),
      )
      .order("desc")
      .take(100);
  },
});

export const remember = mutation({
  args: {
    connectionId: v.id("connections"),
    title: v.string(),
    occurredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const account = await requireConnectionMember(ctx, args.connectionId);
    const now = Date.now();
    return await ctx.db.insert("sharedExperiences", {
      connectionId: args.connectionId,
      createdByAccountId: account._id,
      title: cleanTitle(args.title),
      occurredAt: args.occurredAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

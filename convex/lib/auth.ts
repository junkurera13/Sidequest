import type { MutationCtx, QueryCtx } from "../_generated/server";

type AuthenticatedCtx = Pick<QueryCtx | MutationCtx, "auth" | "db">;

export async function requireIdentity(ctx: AuthenticatedCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Not authenticated");
  }

  return identity;
}

export async function findCurrentAccount(ctx: AuthenticatedCtx) {
  const identity = await requireIdentity(ctx);
  const account = await ctx.db
    .query("accounts")
    .withIndex("by_token_identifier", (query) =>
      query.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  return { account, identity };
}

export async function requireCurrentAccount(ctx: AuthenticatedCtx) {
  const { account } = await findCurrentAccount(ctx);
  if (account === null) {
    throw new Error("Account has not been initialized");
  }

  return account;
}

export function cleanDisplayName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 80) {
    throw new Error("Names must be between 1 and 80 characters");
  }
  return name;
}

export function cleanOptionalLabel(value: string | undefined) {
  if (value === undefined) return undefined;
  const label = value.trim().replace(/\s+/g, " ");
  if (label.length === 0) return undefined;
  if (label.length > 80) {
    throw new Error("Labels must be 80 characters or fewer");
  }
  return label;
}

export function normalizeName(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().trim();
}

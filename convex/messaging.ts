import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  mutation,
  type MutationCtx,
} from "./_generated/server";

const DELIVERY_LEASE_MS = 20_000;
const DELIVERY_RETENTION_MS = 48 * 60 * 60 * 1_000;
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

type SpectrumEnvelope = {
  event: "messages";
  space: {
    id: string;
    platform: string;
    type: "dm" | "group";
    phone: string;
  };
  message: {
    id: string;
    timestamp: string;
    sender: { id: string };
  };
};

type ClaimResult =
  | {
      accepted: true;
      claimToken: string;
      deliveryId: Id<"messagingDeliveries">;
    }
  | { accepted: false; reason: "already-claimed" | "already-enqueued" };

function stringField(value: unknown, name: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid Spectrum webhook ${name}.`);
  }
  return value;
}

function parseSpectrumEnvelope(rawBody: string): SpectrumEnvelope {
  const value = JSON.parse(rawBody) as unknown;
  if (!value || typeof value !== "object") {
    throw new Error("Invalid Spectrum webhook body.");
  }

  const body = value as Record<string, unknown>;
  if (body.event !== "messages") {
    throw new Error("Unsupported Spectrum webhook event.");
  }

  const rawSpace = body.space;
  const rawMessage = body.message;
  if (!rawSpace || typeof rawSpace !== "object") {
    throw new Error("Invalid Spectrum webhook space.");
  }
  if (!rawMessage || typeof rawMessage !== "object") {
    throw new Error("Invalid Spectrum webhook message.");
  }

  const space = rawSpace as Record<string, unknown>;
  const message = rawMessage as Record<string, unknown>;
  const sender = message.sender;
  if (!sender || typeof sender !== "object") {
    throw new Error("Invalid Spectrum webhook sender.");
  }

  const platform = stringField(space.platform, "platform").toLowerCase();
  if (platform !== "imessage") {
    throw new Error("Unsupported Spectrum webhook platform.");
  }
  if (space.type !== "dm" && space.type !== "group") {
    throw new Error("Invalid Spectrum webhook space type.");
  }

  return {
    event: "messages",
    space: {
      id: stringField(space.id, "space id"),
      platform: "imessage",
      type: space.type,
      phone: stringField(space.phone, "line id"),
    },
    message: {
      id: stringField(message.id, "message id"),
      timestamp: stringField(message.timestamp, "message timestamp"),
      sender: {
        id: stringField(
          (sender as Record<string, unknown>).id,
          "sender id",
        ),
      },
    },
  };
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function verifySpectrumSignature(args: {
  rawBody: string;
  signature: string;
  timestamp: string;
}) {
  const secret = process.env.SPECTRUM_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("SPECTRUM_WEBHOOK_SECRET is not configured in Convex.");
  }

  const signedAt = Number(args.timestamp);
  const now = Math.floor(Date.now() / 1_000);
  if (
    !Number.isFinite(signedAt) ||
    Math.abs(now - signedAt) > SIGNATURE_TOLERANCE_SECONDS
  ) {
    throw new Error("Stale Spectrum webhook signature.");
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`v0:${args.timestamp}:${args.rawBody}`),
  );
  const expected = `v0=${bytesToHex(digest)}`;

  if (!constantTimeEqual(expected, args.signature)) {
    throw new Error("Invalid Spectrum webhook signature.");
  }
}

async function upsertThread(
  ctx: MutationCtx,
  args: {
    externalParticipantId: string;
    externalSpaceId: string;
    lineId: string;
    receivedAt: number;
  },
) {
  const existing = await ctx.db
    .query("messagingThreads")
    .withIndex("by_provider_and_external_space_id", (query) =>
      query
        .eq("provider", "spectrum")
        .eq("externalSpaceId", args.externalSpaceId),
    )
    .unique();

  if (existing) {
    await ctx.db.patch("messagingThreads", existing._id, {
      externalParticipantId: args.externalParticipantId,
      lineId: args.lineId,
      lastInboundAt: args.receivedAt,
    });
    return existing._id;
  }

  return await ctx.db.insert("messagingThreads", {
    provider: "spectrum",
    platform: "imessage",
    externalSpaceId: args.externalSpaceId,
    externalParticipantId: args.externalParticipantId,
    lineId: args.lineId,
    createdAt: args.receivedAt,
    lastInboundAt: args.receivedAt,
  });
}

export const claimDelivery = internalMutation({
  args: {
    webhookId: v.string(),
    externalMessageId: v.string(),
    externalSpaceId: v.string(),
    externalParticipantId: v.string(),
    lineId: v.string(),
    receivedAt: v.number(),
    claimToken: v.string(),
  },
  handler: async (ctx, args): Promise<ClaimResult> => {
    const now = Date.now();
    const existing = await ctx.db
      .query("messagingDeliveries")
      .withIndex("by_webhook_id_and_external_message_id", (query) =>
        query
          .eq("webhookId", args.webhookId)
          .eq("externalMessageId", args.externalMessageId),
      )
      .unique();

    if (existing?.status === "enqueued") {
      return { accepted: false, reason: "already-enqueued" };
    }
    if (existing?.status === "claimed" && existing.leaseExpiresAt > now) {
      return { accepted: false, reason: "already-claimed" };
    }

    const threadId = await upsertThread(ctx, args);
    const delivery = {
      provider: "spectrum" as const,
      webhookId: args.webhookId,
      externalMessageId: args.externalMessageId,
      threadId,
      status: "claimed" as const,
      claimToken: args.claimToken,
      leaseExpiresAt: now + DELIVERY_LEASE_MS,
      attempts: (existing?.attempts ?? 0) + 1,
      receivedAt: args.receivedAt,
      expiresAt: now + DELIVERY_RETENTION_MS,
      lastError: undefined,
      enqueuedAt: undefined,
    };

    if (existing) {
      await ctx.db.patch("messagingDeliveries", existing._id, delivery);
      return {
        accepted: true,
        claimToken: args.claimToken,
        deliveryId: existing._id,
      };
    }

    const deliveryId = await ctx.db.insert("messagingDeliveries", delivery);
    return { accepted: true, claimToken: args.claimToken, deliveryId };
  },
});

export const claimSpectrumDelivery = action({
  args: {
    rawBody: v.string(),
    signature: v.string(),
    timestamp: v.string(),
    webhookId: v.string(),
  },
  handler: async (ctx, args): Promise<ClaimResult> => {
    await verifySpectrumSignature(args);
    const envelope = parseSpectrumEnvelope(args.rawBody);
    const parsedTimestamp = Date.parse(envelope.message.timestamp);

    const result: ClaimResult = await ctx.runMutation(
      internal.messaging.claimDelivery,
      {
        webhookId: args.webhookId,
        externalMessageId: envelope.message.id,
        externalSpaceId: envelope.space.id,
        externalParticipantId: envelope.message.sender.id,
        lineId: envelope.space.phone,
        receivedAt: Number.isFinite(parsedTimestamp)
          ? parsedTimestamp
          : Date.now(),
        claimToken: crypto.randomUUID(),
      },
    );

    return result;
  },
});

export const confirmSpectrumDelivery = mutation({
  args: {
    deliveryId: v.id("messagingDeliveries"),
    claimToken: v.string(),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("messagingDeliveries", args.deliveryId);
    if (!delivery || delivery.claimToken !== args.claimToken) {
      throw new Error("Invalid messaging delivery claim.");
    }

    await ctx.db.patch("messagingDeliveries", delivery._id, {
      status: "enqueued",
      enqueuedAt: Date.now(),
      leaseExpiresAt: Date.now(),
      lastError: undefined,
    });
    return null;
  },
});

export const releaseSpectrumDelivery = mutation({
  args: {
    deliveryId: v.id("messagingDeliveries"),
    claimToken: v.string(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("messagingDeliveries", args.deliveryId);
    if (!delivery || delivery.claimToken !== args.claimToken) {
      return null;
    }

    await ctx.db.patch("messagingDeliveries", delivery._id, {
      status: "retryable",
      leaseExpiresAt: Date.now(),
      lastError: args.error.slice(0, 500),
    });
    return null;
  },
});

export const removeExpiredDeliveries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("messagingDeliveries")
      .withIndex("by_expires_at", (query) => query.lt("expiresAt", Date.now()))
      .take(500);

    for (const delivery of expired) {
      await ctx.db.delete("messagingDeliveries", delivery._id);
    }

    return expired.length;
  },
});

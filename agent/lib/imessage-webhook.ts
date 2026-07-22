import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

const senderSchema = z
  .object({
    id: z.string().min(1),
    platform: z.string().min(1).optional(),
  })
  .passthrough();

const spaceSchema = z
  .object({
    id: z.string().min(1),
    platform: z.string().min(1),
    type: z.enum(["dm", "group"]),
    phone: z.string().min(1),
  })
  .passthrough();

const messageSchema = z
  .object({
    id: z.string().min(1),
    platform: z.string().min(1),
    direction: z.literal("inbound"),
    timestamp: z.string().min(1),
    sender: senderSchema,
    content: z
      .object({
        type: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();

const webhookSchema = z
  .object({
    event: z.literal("messages"),
    space: spaceSchema,
    message: messageSchema,
  })
  .passthrough();

export type SpectrumWebhook = z.infer<typeof webhookSchema>;

export type SignatureVerification =
  | { ok: true }
  | { ok: false; reason: string; status: 400 | 401 };

export function verifySpectrumWebhookSignature(args: {
  rawBody: string;
  secret: string;
  signature: string | null;
  timestamp: string | null;
  now?: number;
}): SignatureVerification {
  if (!args.signature || !args.timestamp) {
    return { ok: false, reason: "missing signature headers", status: 400 };
  }

  const signedAt = Number(args.timestamp);
  const now = Math.floor((args.now ?? Date.now()) / 1_000);
  if (
    !Number.isFinite(signedAt) ||
    Math.abs(now - signedAt) > SIGNATURE_TOLERANCE_SECONDS
  ) {
    return { ok: false, reason: "stale signature", status: 400 };
  }

  const expected = `v0=${createHmac("sha256", args.secret)
    .update(`v0:${args.timestamp}:${args.rawBody}`)
    .digest("hex")}`;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(args.signature);

  if (
    expectedBytes.length !== receivedBytes.length ||
    !timingSafeEqual(expectedBytes, receivedBytes)
  ) {
    return { ok: false, reason: "invalid signature", status: 401 };
  }

  return { ok: true };
}

export function parseSpectrumWebhook(rawBody: string): SpectrumWebhook {
  return webhookSchema.parse(JSON.parse(rawBody));
}

export function imessageContinuationToken(webhook: SpectrumWebhook) {
  return `${webhook.space.phone}|${webhook.space.id}`;
}

export function textFromSpectrumWebhook(webhook: SpectrumWebhook) {
  if (webhook.message.content.type !== "text") return null;
  const text = webhook.message.content.text;
  return typeof text === "string" && text.trim().length > 0
    ? text.trim()
    : null;
}

import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  parseSpectrumWebhook,
  verifySpectrumWebhookSignature,
} from "./imessage-webhook";

const now = Date.UTC(2026, 6, 22, 12, 0, 0);
const timestamp = String(Math.floor(now / 1_000));
const secret = "test-webhook-secret";
const body = JSON.stringify({
  event: "messages",
  space: {
    id: "any;-;+821012345678",
    platform: "iMessage",
    type: "dm",
    phone: "shared",
  },
  message: {
    id: "spc-msg-1",
    platform: "iMessage",
    direction: "inbound",
    timestamp: "2026-07-22T12:00:00.000Z",
    sender: { id: "+821012345678", platform: "iMessage" },
    content: { type: "text", text: "  saturday afternoon  " },
  },
});

function signature(rawBody = body) {
  return `v0=${createHmac("sha256", secret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex")}`;
}

describe("Spectrum iMessage webhook", () => {
  it("accepts a current, correctly signed raw body", () => {
    expect(
      verifySpectrumWebhookSignature({
        rawBody: body,
        secret,
        signature: signature(),
        timestamp,
        now,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects tampering and stale deliveries", () => {
    expect(
      verifySpectrumWebhookSignature({
        rawBody: `${body} `,
        secret,
        signature: signature(),
        timestamp,
        now,
      }),
    ).toMatchObject({ ok: false, status: 401 });

    expect(
      verifySpectrumWebhookSignature({
        rawBody: body,
        secret,
        signature: signature(),
        timestamp,
        now: now + 301_000,
      }),
    ).toMatchObject({ ok: false, status: 400 });
  });

  it("parses a valid direct iMessage delivery", () => {
    const webhook = parseSpectrumWebhook(body);
    expect(webhook.space.type).toBe("dm");
    expect(webhook.message.content).toMatchObject({
      type: "text",
      text: "  saturday afternoon  ",
    });
  });
});

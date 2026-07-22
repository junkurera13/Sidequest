import { ConvexHttpClient } from "convex/browser";
import { defineChannel, POST } from "eve/channels";
import { Spectrum } from "@spectrum-ts/core";
import { imessage } from "@spectrum-ts/imessage";

import { api } from "../../convex/_generated/api";
import {
  imessageContinuationToken,
  parseSpectrumWebhook,
  textFromSpectrumWebhook,
  verifySpectrumWebhookSignature,
  type SpectrumWebhook,
} from "../lib/imessage-webhook";

type IMessageState = {
  lineId: string | null;
  senderId: string | null;
  spaceId: string | null;
  spaceType: "dm" | "group" | null;
};

const initialState: IMessageState = {
  lineId: null,
  senderId: null,
  spaceId: null,
  spaceType: null,
};

let convexClient: ConvexHttpClient | undefined;
let spectrumPromise: ReturnType<typeof Spectrum> | undefined;

function env(primary: string, fallback?: string) {
  return process.env[primary] ?? (fallback ? process.env[fallback] : undefined);
}

function requiredEnv(primary: string, fallback?: string) {
  const value = env(primary, fallback);
  if (!value) {
    const alternatives = fallback ? ` or ${fallback}` : "";
    throw new Error(`Missing ${primary}${alternatives}.`);
  }
  return value;
}

function getConvexClient() {
  convexClient ??= new ConvexHttpClient(
    requiredEnv("NEXT_PUBLIC_CONVEX_URL"),
  );
  return convexClient;
}

function getSpectrum() {
  spectrumPromise ??= Spectrum({
    projectId: requiredEnv("SPECTRUM_PROJECT_ID", "PHOTON_PROJECT_ID"),
    projectSecret: requiredEnv(
      "SPECTRUM_PROJECT_SECRET",
      "PHOTON_PROJECT_SECRET",
    ),
    providers: [imessage.config()],
    options: { logLevel: "warn" },
  });
  return spectrumPromise;
}

async function resolveDirectMessageSpace(state: IMessageState) {
  if (
    state.spaceType !== "dm" ||
    !state.senderId ||
    !state.lineId ||
    !state.spaceId
  ) {
    throw new Error("The iMessage channel is missing its direct-message state.");
  }

  const spectrum = await getSpectrum();
  const platform = imessage(spectrum);
  const route = state.lineId === "shared" ? undefined : { phone: state.lineId };
  return await platform.space.get(state.spaceId, route);
}

async function sendIMessage(state: IMessageState, text: string) {
  const space = await resolveDirectMessageSpace(state);
  await space.send(text);
}

function stateFromWebhook(webhook: SpectrumWebhook): IMessageState {
  return {
    lineId: webhook.space.phone,
    senderId: webhook.message.sender.id,
    spaceId: webhook.space.id,
    spaceType: webhook.space.type,
  };
}

function spectrumAuth(webhook: SpectrumWebhook) {
  return {
    authenticator: "spectrum-webhook",
    issuer: "photon",
    principalId: `imessage:${webhook.message.sender.id}`,
    principalType: "user" as const,
    attributes: {
      channel: "imessage",
      spaceType: webhook.space.type,
    },
  };
}

function errorText(cause: unknown) {
  return cause instanceof Error ? cause.message.slice(0, 500) : String(cause);
}

export default defineChannel({
  kindHint: "imessage",
  state: initialState,
  metadata(state) {
    return {
      surface: "imessage",
      conversationKind: state.spaceType,
    };
  },
  context(state) {
    return {
      state,
      imessage: {
        sendMessage(text: string) {
          return sendIMessage(state, text);
        },
      },
    };
  },
  routes: [
    POST<IMessageState>("/eve/v1/spectrum/webhook", async (request, { send }) => {
      const webhookSecret = process.env.SPECTRUM_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("SPECTRUM_WEBHOOK_SECRET is not configured.");
        return new Response("webhook is not configured", { status: 500 });
      }

      const rawBody = await request.text();
      const signature = request.headers.get("x-spectrum-signature");
      const timestamp = request.headers.get("x-spectrum-timestamp");
      const webhookId = request.headers.get("x-spectrum-webhook-id");
      const verification = verifySpectrumWebhookSignature({
        rawBody,
        secret: webhookSecret,
        signature,
        timestamp,
      });

      if (!verification.ok) {
        return new Response(verification.reason, { status: verification.status });
      }
      if (!webhookId || !timestamp || !signature) {
        return new Response("missing webhook identity", { status: 400 });
      }

      // Spectrum may add new top-level events without a breaking release.
      // Acknowledge events this channel does not understand so a future event
      // cannot exhaust the provider's retry budget.
      try {
        const envelope = JSON.parse(rawBody) as { event?: unknown };
        if (envelope.event !== "messages") {
          return new Response("ok", { status: 200 });
        }
      } catch {
        return new Response("invalid webhook payload", { status: 400 });
      }

      let webhook: SpectrumWebhook;
      try {
        webhook = parseSpectrumWebhook(rawBody);
      } catch (cause) {
        console.error("Invalid Spectrum webhook payload.", cause);
        return new Response("invalid webhook payload", { status: 400 });
      }

      if (
        webhook.space.platform.toLowerCase() !== "imessage" ||
        webhook.message.platform.toLowerCase() !== "imessage"
      ) {
        return new Response("ok", { status: 200 });
      }
      if (webhook.space.type !== "dm") {
        return new Response("ok", { status: 200 });
      }

      const convex = getConvexClient();
      let claim;
      try {
        claim = await convex.action(api.messaging.claimSpectrumDelivery, {
          rawBody,
          signature,
          timestamp,
          webhookId,
        });
      } catch (cause) {
        console.error("Could not durably claim the Spectrum delivery.", cause);
        return new Response("temporarily unavailable", { status: 503 });
      }

      if (!claim.accepted) {
        return new Response("ok", { status: 200 });
      }

      const state = stateFromWebhook(webhook);
      const text = textFromSpectrumWebhook(webhook);

      try {
        if (text) {
          await send(
            {
              message: text,
              context: [
                "This is a private iMessage conversation. Keep frontstage messages calm, brief, natural, and free of technical language.",
              ],
            },
            {
              auth: spectrumAuth(webhook),
              continuationToken: imessageContinuationToken(webhook),
              state,
              title: "iMessage conversation",
            },
          );
        } else if (
          ["attachment", "contact", "group"].includes(
            webhook.message.content.type,
          )
        ) {
          await sendIMessage(
            state,
            "tell me the story behind that in your own words for now. messy is good.",
          );
        }
      } catch (cause) {
        console.error("Could not enqueue the iMessage turn.", cause);
        await convex
          .mutation(api.messaging.releaseSpectrumDelivery, {
            deliveryId: claim.deliveryId,
            claimToken: claim.claimToken,
            error: errorText(cause),
          })
          .catch((releaseCause) =>
            console.error("Could not release the messaging claim.", releaseCause),
          );
        return new Response("temporarily unavailable", { status: 503 });
      }

      // The Eve session is already durably enqueued at this point. If this
      // bookkeeping write fails, acknowledge the webhook anyway so Photon does
      // not retry a message the agent is already handling.
      await convex
        .mutation(api.messaging.confirmSpectrumDelivery, {
          deliveryId: claim.deliveryId,
          claimToken: claim.claimToken,
        })
        .catch((cause) =>
          console.error("Could not confirm the messaging claim.", cause),
        );

      return new Response("ok", { status: 200 });
    }),
  ],
  events: {
    async "message.completed"(event, channel) {
      if (event.finishReason === "tool-calls" || !event.message) return;
      await channel.imessage.sendMessage(event.message);
    },
    async "turn.failed"(_event, channel) {
      await channel.imessage.sendMessage(
        "something got tangled on my side. send that once more.",
      );
    },
    async "session.failed"(_event, channel) {
      await channel.imessage.sendMessage(
        "i lost the thread for a second. start with me again.",
      );
    },
  },
});

import { defineChannel, POST } from "eve/channels";
import {
  parseSpectrumWebhook,
  verifySpectrumWebhookSignature,
} from "../lib/imessage-webhook";

export default defineChannel({
  kindHint: "imessage",
  routes: [
    POST("/eve/v1/spectrum/webhook", async (request) => {
      const webhookSecret = process.env.SPECTRUM_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("SPECTRUM_WEBHOOK_SECRET is not configured.");
        return new Response("webhook is not configured", { status: 500 });
      }

      const rawBody = await request.text();
      const signature = request.headers.get("x-spectrum-signature");
      const timestamp = request.headers.get("x-spectrum-timestamp");
      const verification = verifySpectrumWebhookSignature({
        rawBody,
        secret: webhookSecret,
        signature,
        timestamp,
      });

      if (!verification.ok) {
        return new Response(verification.reason, { status: verification.status });
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

      let webhook;
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

      // The new invitation system has not been designed yet. Keep Photon's
      // signed transport alive, but deliberately do not start an Eve session,
      // store the message, or send a reply. This route becomes active only when
      // the new product has an explicit output contract and reveal.
      return new Response("ok", { status: 200 });
    }),
  ],
});

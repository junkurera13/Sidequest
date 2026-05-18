import { ConvexHttpClient } from "convex/browser";
import nextEnv from "@next/env";
import { Spectrum } from "spectrum-ts";
import { terminal } from "spectrum-ts/providers/terminal";

import { handleInboundText } from "../lib/agentHandler";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const publicBaseUrl =
  process.env.SIDEQUEST_PUBLIC_BASE_URL ?? "http://localhost:3000";

// Per-session test identity. Override to simulate a different country or a
// fresh user (memory accumulates against the phone, so changing it gives you
// a clean slate).
const testPhone = process.env.SIDEQUEST_TEST_PHONE ?? "terminal:dev";
const testCountry = process.env.SIDEQUEST_TEST_COUNTRY;

function requiredEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local or export it.`);
  }

  return value;
}

function getTextContent(message: { content: unknown }) {
  const content = message.content as { type?: string; text?: string };

  if (content.type !== "text" || !content.text?.trim()) {
    return null;
  }

  return content.text.trim();
}

async function main() {
  const client = new ConvexHttpClient(
    requiredEnv("NEXT_PUBLIC_CONVEX_URL", convexUrl),
  );

  const app = await Spectrum({
    providers: [terminal.config()],
  });

  const terminalApp = terminal(app);

  console.log(
    `sidequest terminal agent ready. phone=${testPhone}${testCountry ? ` country=${testCountry}` : ""}`,
  );
  console.log("type into the chat window to talk to the agent.\n");

  for await (const [space, message] of terminalApp.messages) {
    const text = getTextContent(message);

    if (!text) {
      continue;
    }

    await handleInboundText({
      client,
      space,
      phone: testPhone,
      text,
      country: testCountry,
      publicBaseUrl,
      onLog: (line) => console.log(line),
    });
  }
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});

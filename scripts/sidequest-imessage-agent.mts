import { ConvexHttpClient } from "convex/browser";
import nextEnv from "@next/env";
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { parsePhoneNumberFromString } from "libphonenumber-js";

import { handleInboundText } from "../lib/agentHandler";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const projectId = process.env.PHOTON_PROJECT_ID ?? process.env.PROJECT_ID;
const projectSecret =
  process.env.PHOTON_PROJECT_SECRET ?? process.env.PROJECT_SECRET;
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const publicBaseUrl = process.env.SIDEQUEST_PUBLIC_BASE_URL;

type IMessageSpaceFields = { type: "dm" | "group"; phone: string };

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

function requiredEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local or export it.`);
  }

  return value;
}

function countryFromPhone(phone: string): string | undefined {
  const parsed = parsePhoneNumberFromString(phone);
  const region = parsed?.country;

  if (!region) {
    return undefined;
  }

  try {
    return COUNTRY_NAMES.of(region) ?? region;
  } catch {
    return region;
  }
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

  const baseUrl = requiredEnv("SIDEQUEST_PUBLIC_BASE_URL", publicBaseUrl);

  const app = await Spectrum({
    projectId: requiredEnv("PHOTON_PROJECT_ID", projectId),
    projectSecret: requiredEnv("PHOTON_PROJECT_SECRET", projectSecret),
    providers: [imessage.config()],
  });

  const iMessageApp = imessage(app);

  console.log("sidequest agent listening.");

  for await (const [space, message] of iMessageApp.messages) {
    const { type, phone } = space as unknown as IMessageSpaceFields;

    if (type !== "dm") {
      continue;
    }

    const text = getTextContent(message);

    if (!text) {
      await space.send("send text bro. cant read that rn.");
      continue;
    }

    const country = countryFromPhone(phone);

    await handleInboundText({
      client,
      space,
      phone,
      text,
      country,
      publicBaseUrl: baseUrl,
      source: "imessage",
      onLog: (line) => console.log(line),
    });
  }
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});

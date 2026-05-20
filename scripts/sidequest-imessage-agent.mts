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
  if (!/^\+\d{6,15}$/.test(phone)) {
    return undefined;
  }

  try {
    const parsed = parsePhoneNumberFromString(phone);
    const region = parsed?.country;

    if (!region) {
      return undefined;
    }

    return COUNTRY_NAMES.of(region) ?? region;
  } catch {
    return undefined;
  }
}

function getTextContent(message: { content: unknown }) {
  const content = message.content as { type?: string; text?: string };

  if (content.type !== "text" || !content.text?.trim()) {
    return null;
  }

  return content.text.trim();
}

// Photon/Spectrum can yield the same inbound iMessage twice when the bridge
// reconnects or retries. We dedup on both message id and (phone + text) within
// a short window because Photon sometimes assigns fresh ids to re-delivered
// messages, in which case id-only dedup misses them. Burning a Sonnet quest
// call per duplicate is expensive, so we err on the side of skipping.
const ID_DEDUP_WINDOW_MS = 5 * 60 * 1000;
const CONTENT_DEDUP_WINDOW_MS = 30 * 1000;
const seenMessageIds = new Map<string, number>();
const seenContent = new Map<string, number>();

function pruneExpired(map: Map<string, number>, windowMs: number) {
  const now = Date.now();
  for (const [key, timestamp] of map) {
    if (now - timestamp > windowMs) {
      map.delete(key);
    }
  }
}

function isDuplicateInbound(args: {
  id: string;
  phone: string;
  text: string;
}): boolean {
  pruneExpired(seenMessageIds, ID_DEDUP_WINDOW_MS);
  pruneExpired(seenContent, CONTENT_DEDUP_WINDOW_MS);

  if (seenMessageIds.has(args.id)) {
    return true;
  }

  const contentKey = `${args.phone}::${args.text}`;
  if (seenContent.has(contentKey)) {
    return true;
  }

  seenMessageIds.set(args.id, Date.now());
  seenContent.set(contentKey, Date.now());
  return false;
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

    console.log(
      `inbound received id=${message.id} type=${type} phone=${phone}`,
    );

    if (type !== "dm") {
      continue;
    }

    const text = getTextContent(message);

    if (!text) {
      await space.send("send text bro. cant read that rn.");
      continue;
    }

    if (isDuplicateInbound({ id: message.id, phone, text })) {
      console.log(
        `skipping duplicate inbound id=${message.id} phone=${phone} text="${text}"`,
      );
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

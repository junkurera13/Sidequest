import { ConvexHttpClient } from "convex/browser";
import nextEnv from "@next/env";
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { parsePhoneNumberFromString } from "libphonenumber-js";

import {
  generateFollowupQuestion,
  generateQuest,
  resetUserToIdle,
  setUserAwaitingFollowup,
  updateUserMemory,
  upsertUserByPhone,
  type UserMemory,
} from "../lib/convexFunctions";

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

function absoluteQuestUrl(path: string) {
  const baseUrl = requiredEnv("SIDEQUEST_PUBLIC_BASE_URL", publicBaseUrl);
  return new URL(path, baseUrl).toString();
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

function formatMemory(memory: UserMemory): string {
  const parts: string[] = [];
  if (memory.name) parts.push(`name: ${memory.name}`);
  if (memory.homeCity) parts.push(`home: ${memory.homeCity}`);
  if (memory.currentCity && memory.currentCity !== memory.homeCity) {
    parts.push(
      `currently in: ${memory.currentCity}${memory.onVacation ? " (on vacation)" : ""}`,
    );
  } else if (memory.onVacation) {
    parts.push("on vacation");
  }
  if (memory.country) parts.push(`country: ${memory.country}`);
  if (memory.notes) parts.push(`notes: ${memory.notes}`);
  return parts.join("; ");
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

    const user = await client.mutation(upsertUserByPhone, {
      phone,
      country,
    });

    const memorySummary = formatMemory(user.memory);

    console.log(
      `[${phone}] (${country ?? "unknown"}) state=${user.state} mem="${memorySummary || "empty"}": ${text}`,
    );

    await space.responding(async () => {
      try {
        if (user.state === "awaiting_followup" && user.pendingRequest) {
          const combined = `${user.pendingRequest}\n\nfollowup answer: ${text}`;

          const quest = await client.action(generateQuest, {
            request: combined,
            country: user.country,
            memorySummary,
          });
          const questUrl = absoluteQuestUrl(quest.url);

          await client.mutation(resetUserToIdle, { phone });
          await space.send(`ight here u go:\n\n${questUrl}`);

          // Update memory from the full exchange. Fire-and-forget — don't
          // block the reply or fail the conversation on memory errors.
          void client
            .action(updateUserMemory, {
              phone,
              conversation: `user (initial): ${user.pendingRequest}\nuser (followup): ${text}`,
              existingMemory: memorySummary,
            })
            .catch((cause) => console.error("memory update error:", cause));
          return;
        }

        const { question } = await client.action(generateFollowupQuestion, {
          request: text,
          country,
          memorySummary,
        });

        await client.mutation(setUserAwaitingFollowup, {
          phone,
          pendingRequest: text,
        });

        const greeting = user.isNew ? "yo im sidequest. " : "";
        await space.send(`${greeting}${question}`);

        // Update memory based on this first message.
        void client
          .action(updateUserMemory, {
            phone,
            conversation: `user: ${text}`,
            existingMemory: memorySummary,
          })
          .catch((cause) => console.error("memory update error:", cause));
      } catch (cause) {
        const errorMessage =
          cause instanceof Error
            ? cause.message
            : "shit broke. try again in a sec.";

        console.error(errorMessage);
        await space.send(`shit broke: ${errorMessage}`);
      }
    });
  }
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});

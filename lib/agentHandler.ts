import type { ConvexHttpClient } from "convex/browser";
import type { Space } from "spectrum-ts";

import {
  generateFollowupQuestion,
  generateQuest,
  generateQuestAck,
  resetUserToIdle,
  resolveCurrentLocation,
  saveLatestOutcomeForPhone,
  setUserAwaitingFollowup,
  updateUserMemory,
  upsertUserByPhone,
  type UserMemory,
  type QuestSource,
} from "./convexFunctions";
import { ackForOutcome, parseFeedback } from "./feedbackParser";
import { buildLocalContext } from "./timezones";
import { fetchCurrentWeather, formatWeather } from "./weather";

export function formatMemory(memory: UserMemory): string {
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

export type AgentHandlerParams = {
  client: ConvexHttpClient;
  space: Space;
  phone: string;
  text: string;
  country?: string;
  publicBaseUrl: string;
  source: QuestSource;
  onLog?: (line: string) => void;
};

function absoluteUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl).toString();
}

export async function handleInboundText(params: AgentHandlerParams) {
  const {
    client,
    space,
    phone,
    text,
    country,
    publicBaseUrl,
    source,
    onLog,
  } = params;

  const user = await client.mutation(upsertUserByPhone, {
    phone,
    country,
  });

  const memorySummary = formatMemory(user.memory);

  onLog?.(
    `[${phone}] (${country ?? "unknown"}) state=${user.state} mem="${memorySummary || "empty"}": ${text}`,
  );

  await space.responding(async () => {
    try {
      // W/L feedback check: if the inbound message looks like outcome
      // feedback (W, L, "did it", "skipped"...), try to attach it to the
      // user's most recent quest. Standalone signals get a brief ack and
      // we stop here; inline signals still let the conversation continue
      // so the user can chain "L, give me something else" into a re-roll.
      const feedback = parseFeedback(text);
      if (feedback && user.state !== "awaiting_followup") {
        const saved = await client.mutation(saveLatestOutcomeForPhone, {
          phone,
          outcome: feedback.outcome,
        });
        if (saved) {
          onLog?.(
            `[${phone}] outcome=${feedback.outcome} saved on ${saved.shortId}`,
          );
          if (feedback.isStandalone) {
            await space.send(ackForOutcome(feedback.outcome));
            return;
          }
        }
      }

      const isFollowup =
        user.state === "awaiting_followup" && !!user.pendingRequest;

      // Resolve the user's *current-turn* location from their message before
      // looking up weather. On the followup turn we combine both turns so
      // "yo im bored" + "tokyo, broke" still resolves to Tokyo. Falls back
      // to the IP-derived coords stored at signup when nothing can be pulled
      // out of the text.
      const resolveText = isFollowup
        ? `${user.pendingRequest}\n\n${text}`
        : text;

      let resolvedCity: string | undefined = user.memory.currentCity;
      let weatherLat = user.memory.latitude;
      let weatherLon = user.memory.longitude;
      try {
        const resolved = await client.action(resolveCurrentLocation, {
          text: resolveText,
        });
        if (resolved.city) resolvedCity = resolved.city;
        if (
          typeof resolved.latitude === "number" &&
          typeof resolved.longitude === "number"
        ) {
          weatherLat = resolved.latitude;
          weatherLon = resolved.longitude;
        }
      } catch (cause) {
        onLog?.(`location resolve failed: ${cause}`);
      }

      let weatherPhrase: string | undefined;
      if (typeof weatherLat === "number" && typeof weatherLon === "number") {
        try {
          const weather = await fetchCurrentWeather(weatherLat, weatherLon);
          if (weather) weatherPhrase = formatWeather(weather);
        } catch (cause) {
          onLog?.(`weather fetch failed: ${cause}`);
        }
      }

      const localContext = buildLocalContext({
        phone,
        city: resolvedCity,
        weather: weatherPhrase,
      });

      onLog?.(`[${phone}] local="${localContext ?? "none"}"`);

      if (isFollowup && user.pendingRequest) {
        const combined = `${user.pendingRequest}\n\nfollowup answer: ${text}`;

        // Sonnet + web search runs in parallel with the quick Haiku ack.
        const questPromise = client.action(generateQuest, {
          request: combined,
          country: user.country,
          memorySummary,
          localContext,
          phone,
          initialRequest: user.pendingRequest,
          followupAnswer: text,
          source,
        });

        try {
          const { ack } = await client.action(generateQuestAck, {
            pendingRequest: user.pendingRequest,
            followup: text,
            country: user.country,
            memorySummary,
            localContext,
          });
          await space.send(ack);
        } catch (cause) {
          onLog?.(`ack generation failed: ${cause}`);
        }

        const quest = await questPromise;
        const questUrl = absoluteUrl(publicBaseUrl, quest.url);

        await client.mutation(resetUserToIdle, { phone });
        await space.send(`ight here u go:\n\n${questUrl}`);

        void client
          .action(updateUserMemory, {
            phone,
            conversation: `user (initial): ${user.pendingRequest}\nuser (followup): ${text}`,
            existingMemory: memorySummary,
          })
          .catch((cause) => onLog?.(`memory update error: ${cause}`));
        return;
      }

      const { question } = await client.action(generateFollowupQuestion, {
        request: text,
        country,
        memorySummary,
        localContext,
      });

      await client.mutation(setUserAwaitingFollowup, {
        phone,
        pendingRequest: text,
      });

      const greeting = user.isNew ? "yo im sidequest. " : "";
      await space.send(`${greeting}${question}`);

      void client
        .action(updateUserMemory, {
          phone,
          conversation: `user: ${text}`,
          existingMemory: memorySummary,
        })
        .catch((cause) => onLog?.(`memory update error: ${cause}`));
    } catch (cause) {
      const errorMessage =
        cause instanceof Error
          ? cause.message
          : "shit broke. try again in a sec.";

      onLog?.(`handler error: ${errorMessage}`);
      await space.send(`shit broke: ${errorMessage}`);
    }
  });
}

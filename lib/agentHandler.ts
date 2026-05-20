import type { ConvexHttpClient } from "convex/browser";
import type { Space } from "spectrum-ts";

import {
  generateFollowupQuestion,
  generateOutcomeAck,
  generateQuest,
  generateQuestAck,
  generateQuestHandoff,
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

function hasRealPhoneIdentity(phone: string) {
  return /^\+\d{6,15}$/.test(phone);
}

function locationQuestion() {
  return "where u at rn?";
}

function titleCaseLocation(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function inferLocationReply(text: string) {
  const cleaned = text
    .trim()
    .replace(/[?!]+$/g, "")
    .replace(/\brn\b/gi, "")
    .replace(/\bright now\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const lower = cleaned.toLowerCase();

  const knownCity = [
    "seoul",
    "tokyo",
    "new york",
    "london",
    "paris",
    "singapore",
    "bangkok",
    "taipei",
    "hong kong",
  ].find((city) => new RegExp(`\\b${city}\\b`, "i").test(cleaned));

  const stationMatch = lower.match(/\b(?:in|at|near|around)\s+([a-z0-9'\-\s]+?\s+station)\b/);
  if (stationMatch?.[1]) {
    const station = titleCaseLocation(stationMatch[1]);
    return knownCity ? `${station}, ${titleCaseLocation(knownCity)}` : station;
  }

  if (knownCity) {
    return titleCaseLocation(knownCity);
  }

  const directLocation = lower.match(/^(?:i'?m|i am)?\s*(?:in|at|near|around)\s+(.+)$/);
  const candidate = directLocation?.[1] ?? cleaned.split(",")[0];
  const words = candidate.trim().split(/\s+/).filter(Boolean);
  const nonLocationWords = /\b(cheap|budget|solo|friend|friends|date|food|drinks|chill|party|free|won|dollar|tonight|today|tomorrow|bored)\b/i;

  if (words.length > 0 && words.length <= 4 && !nonLocationWords.test(candidate)) {
    return titleCaseLocation(candidate);
  }

  return undefined;
}

function fallbackFollowupQuestion(text: string, country?: string) {
  const lower = text.toLowerCase();

  if (!/(seoul|tokyo|new york|london|paris|city|near|around|in )/.test(lower)) {
    return locationQuestion();
  }

  if (!/(budget|cheap|free|\$|₩|won|solo|friend|date|tonight|today|tomorrow)/.test(lower)) {
    return "what's the budget and who's going?";
  }

  if (country) {
    return "what vibe are we aiming for?";
  }

  return "what city are we operating in?";
}

function userSafeError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause);
  const lower = message.toLowerCase();

  if (
    lower.includes("overloaded") ||
    lower.includes("rate limit") ||
    lower.includes("temporarily")
  ) {
    return "mission desk is overloaded rn. try again in a minute.";
  }

  return "mission desk jammed. try again in a sec.";
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

  // Photon shared-number mode currently identifies the sender as "shared",
  // not as a real phone number. Treat that memory as untrusted because it can
  // mix multiple testers into one fake user profile.
  const canTrustUserMemory = hasRealPhoneIdentity(phone);
  const memory = canTrustUserMemory ? user.memory : {};
  const memorySummary = canTrustUserMemory ? formatMemory(memory) : "";

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
            let ackText: string;
            try {
              const generated = await client.action(generateOutcomeAck, {
                outcome: feedback.outcome,
                questTitle: saved.title,
                country: user.country,
                memorySummary,
              });
              ackText = generated.text;
            } catch (cause) {
              onLog?.(`outcome ack generation failed: ${cause}`);
              ackText = ackForOutcome(feedback.outcome);
            }
            await space.send(ackText);
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

      let resolvedCity: string | undefined = memory.currentCity;
      let weatherLat = memory.latitude;
      let weatherLon = memory.longitude;
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

      if (!resolvedCity && isFollowup) {
        const inferred = inferLocationReply(text);
        if (inferred) {
          resolvedCity = inferred;
          onLog?.(`[${phone}] inferred location="${inferred}"`);
        }
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

        if (!resolvedCity) {
          await client.mutation(setUserAwaitingFollowup, {
            phone,
            pendingRequest: combined,
          });

          let reaskQuestion: string;
          try {
            const generated = await client.action(generateFollowupQuestion, {
              request: combined,
              country: user.country,
              memorySummary,
              localContext,
            });
            reaskQuestion = generated.question;
          } catch (cause) {
            onLog?.(`followup generation failed: ${cause}`);
            reaskQuestion = fallbackFollowupQuestion(combined, user.country);
          }

          await space.send(reaskQuestion);
          return;
        }

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

        let handoff: string;
        try {
          const generated = await client.action(generateQuestHandoff, {
            title: quest.title,
            initialRequest: user.pendingRequest,
            followupAnswer: text,
            country: user.country,
            memorySummary,
            localContext,
          });
          handoff = generated.text;
        } catch (cause) {
          onLog?.(`handoff generation failed: ${cause}`);
          handoff = "ight here u go:";
        }

        await space.send(`${handoff}\n\n${questUrl}`);

        void client
          .action(updateUserMemory, {
            phone,
            conversation: `user (initial): ${user.pendingRequest}\nuser (followup): ${text}`,
            existingMemory: memorySummary,
          })
          .catch((cause) => onLog?.(`memory update error: ${cause}`));
        return;
      }

      let question: string;
      try {
        const generated = await client.action(generateFollowupQuestion, {
          request: text,
          country,
          memorySummary,
          localContext,
        });
        question = generated.question;
      } catch (cause) {
        onLog?.(`followup generation failed: ${cause}`);
        question = fallbackFollowupQuestion(text, country);
      }

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
      const errorMessage = userSafeError(cause);

      onLog?.(`handler error: ${cause}`);
      await space.send(errorMessage);
    }
  });
}

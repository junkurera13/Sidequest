import type { ConvexHttpClient } from "convex/browser";
import type { Space } from "spectrum-ts";

import {
  resolveCurrentLocation,
  updateUserMemory,
  upsertUserByPhone,
  type UserMemory,
  type QuestSource,
} from "./convexFunctions";
import { runConversationLoop } from "./conversationLoop";
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

function hasRealPhoneIdentity(phone: string) {
  return /^\+\d{6,15}$/.test(phone);
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
    onLog,
  } = params;

  const user = await client.mutation(upsertUserByPhone, {
    phone,
    country,
  });

  // Photon shared-number mode collapses multiple testers into a single
  // "shared" identity. We never trust that memory because it cross-pollutes.
  const canTrustUserMemory = hasRealPhoneIdentity(phone);
  const memory = canTrustUserMemory ? user.memory : {};
  const memorySummary = canTrustUserMemory ? formatMemory(memory) : "";

  onLog?.(
    `[${phone}] (${country ?? "unknown"}) mem="${memorySummary || "empty"}": ${text}`,
  );

  await space.responding(async () => {
    try {
      // Pull a city out of the new turn if there is one. The result joins
      // any city already on file. We do this before the router runs so the
      // router sees a fully resolved local context in its system prompt.
      let resolvedCity: string | undefined = memory.currentCity;
      let weatherLat = memory.latitude;
      let weatherLon = memory.longitude;
      try {
        const resolved = await client.action(resolveCurrentLocation, {
          text,
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

      await runConversationLoop({
        client,
        space,
        phone,
        inboundText: text,
        publicBaseUrl,
        country: user.country,
        memorySummary,
        localContext,
        onLog,
      });

      if (canTrustUserMemory) {
        void client
          .action(updateUserMemory, {
            phone,
            conversation: `user: ${text}`,
            existingMemory: memorySummary,
          })
          .catch((cause) => onLog?.(`memory update error: ${cause}`));
      }
    } catch (cause) {
      const errorMessage = userSafeError(cause);

      onLog?.(`handler error: ${cause}`);
      await space.send(errorMessage);
    }
  });
}

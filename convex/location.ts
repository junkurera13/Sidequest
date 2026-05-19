import { actionGeneric } from "convex/server";
import { v } from "convex/values";

import {
  CONVERSATION_MODEL,
  type ClaudeMessageResponse,
} from "../lib/claudeQuest";

type ResolvedLocation = {
  city?: string;
  latitude?: number;
  longitude?: number;
};

// Extracts the user's current location from a single turn's text (if any),
// then geocodes it via Open-Meteo. Used by the agent so weather + spot
// suggestions reflect where the user *is right now*, not where they were
// at signup. Best-effort — returns an empty object if nothing reliable
// can be pulled out.
export const resolveCurrentLocation = actionGeneric({
  args: { text: v.string() },
  handler: async (_ctx, args): Promise<ResolvedLocation> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return {};

    const text = args.text.trim();
    if (text.length < 2) return {};

    let city: string | undefined;
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: CONVERSATION_MODEL,
          max_tokens: 40,
          system:
            "extract the single most-specific location the user is at RIGHT NOW from their message. " +
            "prefer neighborhood + city when both are given (e.g. \"Gangnam, Seoul\"). " +
            "ignore future trips, places they're going next week, places they used to live. " +
            "if no clear current location is mentioned, return null. " +
            "respond with ONLY a JSON object of the shape {\"city\":\"...\"} or {\"city\":null}. no prose, no explanation.",
          messages: [{ role: "user", content: text }],
        }),
      });

      if (!response.ok) return {};
      const body = (await response.json()) as ClaudeMessageResponse;
      const raw = body.content
        ?.filter((block) => block.type === "text" && block.text)
        .map((block) => block.text!.trim())
        .join(" ")
        .trim();
      if (!raw) return {};

      // Tolerate stray prose around the JSON — extract the first {...} blob.
      const match = raw.match(/\{[^}]*\}/);
      if (!match) return {};
      const parsed = JSON.parse(match[0]) as { city?: string | null };
      const candidate = parsed.city?.trim();
      if (candidate && candidate.toLowerCase() !== "null") {
        city = candidate;
      }
    } catch {
      return {};
    }

    if (!city) return {};

    // Open-Meteo geocoder — free, no key, fuzzy on city names.
    try {
      const geoUrl =
        "https://geocoding-api.open-meteo.com/v1/search" +
        `?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
      const geoRes = await fetch(geoUrl);
      if (!geoRes.ok) return { city };
      const geoBody = (await geoRes.json()) as {
        results?: Array<{
          name?: string;
          latitude?: number;
          longitude?: number;
        }>;
      };
      const hit = geoBody.results?.[0];
      if (!hit || typeof hit.latitude !== "number" || typeof hit.longitude !== "number") {
        return { city };
      }
      return {
        city: hit.name ?? city,
        latitude: hit.latitude,
        longitude: hit.longitude,
      };
    } catch {
      return { city };
    }
  },
});

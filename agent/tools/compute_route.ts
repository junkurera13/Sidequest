import { defineTool } from "eve/tools";
import { z } from "zod";

import { readApiError, secondsToMinutes } from "../lib/api";

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const modeSchema = z.enum(["WALK", "BICYCLE", "TRANSIT", "DRIVE", "TWO_WHEELER"]);

export default defineTool({
  description:
    "Verify travel time and distance between two coordinates with Google Routes. Use for every transition whose feasibility matters.",
  inputSchema: z.object({
    origin: locationSchema,
    destination: locationSchema,
    travelMode: modeSchema,
    departureTime: z.string().datetime({ offset: true }).optional(),
    languageCode: z.string().min(2).max(10).default("en"),
  }),
  outputSchema: z.object({
    travelMode: modeSchema,
    durationMinutes: z.number().int().nonnegative(),
    distanceMeters: z.number().int().nonnegative(),
  }),
  async execute({ origin, destination, travelMode, departureTime, languageCode }, ctx) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("compute_route is not configured: GOOGLE_MAPS_API_KEY is missing.");
    }

    const requestBody: Record<string, unknown> = {
      origin: { location: { latLng: origin } },
      destination: { location: { latLng: destination } },
      travelMode,
      computeAlternativeRoutes: false,
      languageCode,
      units: "METRIC",
    };
    if (departureTime && (travelMode === "DRIVE" || travelMode === "TRANSIT")) {
      requestBody.departureTime = departureTime;
    }
    if (travelMode === "DRIVE") requestBody.routingPreference = "TRAFFIC_AWARE";

    const response = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
        },
        body: JSON.stringify(requestBody),
        signal: ctx.abortSignal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `Google Routes failed (${response.status}): ${await readApiError(response)}`,
      );
    }

    const body = (await response.json()) as {
      routes?: Array<{ duration?: string; distanceMeters?: number }>;
    };
    const route = body.routes?.[0];
    const durationMinutes = secondsToMinutes(route?.duration);
    if (!route || durationMinutes === undefined || typeof route.distanceMeters !== "number") {
      throw new Error("Google Routes returned no usable route.");
    }

    return {
      travelMode,
      durationMinutes,
      distanceMeters: Math.round(route.distanceMeters),
    };
  },
});

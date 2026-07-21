import { defineTool } from "eve/tools";
import { z } from "zod";

import { readApiError } from "../lib/api";

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const placeSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  location: locationSchema,
  businessStatus: z.string().nullable(),
  googleMapsUrl: z.string().url().nullable(),
  websiteUrl: z.string().url().nullable(),
  primaryType: z.string().nullable(),
  types: z.array(z.string()),
  rating: z.number().nullable(),
  ratingCount: z.number().int().nullable(),
  priceLevel: z.string().nullable(),
  openNow: z.boolean().nullable(),
  weekdayDescriptions: z.array(z.string()),
});

export default defineTool({
  description:
    "Find and verify real places with Google Places. Use this before relying on a venue's identity, coordinates, address, current status, hours, website, or Maps URL.",
  inputSchema: z.object({
    query: z.string().min(2).max(220),
    location: locationSchema.optional(),
    radiusMeters: z.number().positive().max(50_000).default(5_000),
    openNow: z.boolean().optional(),
    languageCode: z.string().min(2).max(10).default("en"),
    pageSize: z.number().int().min(1).max(10).default(6),
  }),
  outputSchema: z.object({ places: z.array(placeSchema) }),
  async execute({ query, location, radiusMeters, openNow, languageCode, pageSize }, ctx) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("search_places is not configured: GOOGLE_MAPS_API_KEY is missing.");
    }

    const requestBody: Record<string, unknown> = {
      textQuery: query,
      pageSize,
      languageCode,
    };
    if (typeof openNow === "boolean") requestBody.openNow = openNow;
    if (location) {
      requestBody.locationBias = {
        circle: { center: location, radius: radiusMeters },
      };
    }

    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.businessStatus",
          "places.googleMapsUri",
          "places.websiteUri",
          "places.primaryType",
          "places.types",
          "places.rating",
          "places.userRatingCount",
          "places.priceLevel",
          "places.currentOpeningHours",
        ].join(","),
      },
      body: JSON.stringify(requestBody),
      signal: ctx.abortSignal,
    });

    if (!response.ok) {
      throw new Error(
        `Google Places failed (${response.status}): ${await readApiError(response)}`,
      );
    }

    const body = (await response.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        businessStatus?: string;
        googleMapsUri?: string;
        websiteUri?: string;
        primaryType?: string;
        types?: string[];
        rating?: number;
        userRatingCount?: number;
        priceLevel?: string;
        currentOpeningHours?: {
          openNow?: boolean;
          weekdayDescriptions?: string[];
        };
      }>;
    };

    return {
      places: (body.places ?? [])
        .filter(
          (place) =>
            place.id &&
            place.displayName?.text &&
            place.formattedAddress &&
            typeof place.location?.latitude === "number" &&
            typeof place.location?.longitude === "number",
        )
        .map((place) => ({
          id: place.id!,
          name: place.displayName!.text!,
          address: place.formattedAddress!,
          location: {
            latitude: place.location!.latitude!,
            longitude: place.location!.longitude!,
          },
          businessStatus: place.businessStatus ?? null,
          googleMapsUrl: place.googleMapsUri ?? null,
          websiteUrl: place.websiteUri ?? null,
          primaryType: place.primaryType ?? null,
          types: place.types ?? [],
          rating: place.rating ?? null,
          ratingCount: place.userRatingCount ?? null,
          priceLevel: place.priceLevel ?? null,
          openNow: place.currentOpeningHours?.openNow ?? null,
          weekdayDescriptions: place.currentOpeningHours?.weekdayDescriptions ?? [],
        })),
    };
  },
});

import { defineTool } from "eve/tools";
import { z } from "zod";

import { describeWmo } from "../../lib/weather";
import { readApiError } from "../lib/api";

export default defineTool({
  description:
    "Check weather at coordinates for the hour of an experience. Use when weather could affect comfort, safety, transport, or the backup plan.",
  inputSchema: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    dateTime: z.string().datetime({ offset: true }),
  }),
  outputSchema: z.object({
    forecastAvailable: z.boolean(),
    dateTime: z.string(),
    temperatureC: z.number().nullable(),
    description: z.string().nullable(),
    precipitationProbability: z.number().nullable(),
  }),
  async execute({ latitude, longitude, dateTime }, ctx) {
    const requested = new Date(dateTime);
    const startDate = requested.toISOString().slice(0, 10);
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set(
      "hourly",
      "temperature_2m,weather_code,precipitation_probability",
    );
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", startDate);
    url.searchParams.set("timezone", "GMT");

    const response = await fetch(url, { signal: ctx.abortSignal });
    if (!response.ok) {
      throw new Error(`Open-Meteo failed (${response.status}): ${await readApiError(response)}`);
    }

    const body = (await response.json()) as {
      hourly?: {
        time?: string[];
        temperature_2m?: number[];
        weather_code?: number[];
        precipitation_probability?: number[];
      };
    };

    const targetHour = requested.toISOString().slice(0, 13) + ":00";
    const index = body.hourly?.time?.indexOf(targetHour) ?? -1;
    if (index < 0) {
      return {
        forecastAvailable: false,
        dateTime,
        temperatureC: null,
        description: null,
        precipitationProbability: null,
      };
    }

    const temperature = body.hourly?.temperature_2m?.[index];
    const weatherCode = body.hourly?.weather_code?.[index];
    const precipitation = body.hourly?.precipitation_probability?.[index];

    return {
      forecastAvailable: true,
      dateTime,
      temperatureC: typeof temperature === "number" ? Math.round(temperature) : null,
      description: describeWmo(weatherCode) ?? null,
      precipitationProbability: typeof precipitation === "number" ? precipitation : null,
    };
  },
});

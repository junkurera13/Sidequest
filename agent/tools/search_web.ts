import { defineTool } from "eve/tools";
import { z } from "zod";

import { readApiError } from "../lib/api";

const searchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  publishDate: z.string().nullable(),
  excerpts: z.array(z.string()),
});

export default defineTool({
  description:
    "Discover current, unusual, or locally specific experience ingredients on the public web. Use anonymous search terms only—never names, phone numbers, raw memories, or other private data. Use for discovery, not as proof of opening hours, routes, or live availability.",
  inputSchema: z.object({
    objective: z.string().min(10).max(800),
    searchQueries: z.array(z.string().min(2).max(180)).min(1).max(5),
    mode: z.enum(["turbo", "advanced"]).default("turbo"),
  }),
  outputSchema: z.object({
    results: z.array(searchResultSchema),
    warnings: z.array(z.string()),
  }),
  async execute({ objective, searchQueries, mode }, ctx) {
    const apiKey = process.env.PARALLEL_API_KEY;
    if (!apiKey) {
      throw new Error("search_web is not configured: PARALLEL_API_KEY is missing.");
    }

    const response = await fetch("https://api.parallel.ai/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        objective,
        search_queries: searchQueries,
        mode,
      }),
      signal: ctx.abortSignal,
    });

    if (!response.ok) {
      throw new Error(
        `Parallel Search failed (${response.status}): ${await readApiError(response)}`,
      );
    }

    const body = (await response.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        publish_date?: string | null;
        excerpts?: string[];
      }>;
      warnings?: Array<string | { message?: string }> | null;
    };

    return {
      results: (body.results ?? [])
        .filter((result) => result.title && result.url)
        .slice(0, 10)
        .map((result) => ({
          title: result.title!,
          url: result.url!,
          publishDate: result.publish_date ?? null,
          excerpts: (result.excerpts ?? []).slice(0, 3).map((excerpt) => excerpt.slice(0, 900)),
        })),
      warnings: (body.warnings ?? []).map((warning) =>
        typeof warning === "string" ? warning : warning.message ?? "Search warning",
      ),
    };
  },
});

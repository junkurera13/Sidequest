import { defineAgent } from "eve";

export default defineAgent({
  model: "openai/gpt-5.4-mini",
  reasoning: "medium",
  compaction: {
    thresholdPercent: 0.75,
  },
  limits: {
    maxInputTokensPerSession: 300_000,
    maxOutputTokensPerSession: 30_000,
  },
});

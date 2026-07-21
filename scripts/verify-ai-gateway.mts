import { generateText } from "ai";

if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
  throw new Error("No Vercel AI Gateway authentication is available.");
}

const result = await generateText({
  model: "openai/gpt-5.4-mini",
  prompt: "Reply with exactly the single word: connected",
  maxOutputTokens: 16,
});

if (result.text.trim().toLowerCase() !== "connected") {
  throw new Error("AI Gateway responded, but the connection check returned an unexpected result.");
}

console.log("AI Gateway connected.");

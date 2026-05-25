import { describe, expect, it } from "vitest";

import {
  buildMessagesRequest,
  getModelForPurpose,
  stripOpenRouterIncompatibleFields,
} from "./llmProvider";

describe("llm provider config", () => {
  it("uses OpenRouter with Kimi K2.6 when configured", () => {
    const request = buildMessagesRequest({
      provider: "openrouter",
      apiKey: "or-key",
      model: "moonshotai/kimi-k2.6",
      body: {
        model: "ignored",
        max_tokens: 20,
        messages: [{ role: "user", content: "yo" }],
      },
    });

    expect(request.url).toBe("https://openrouter.ai/api/v1/messages");
    expect(request.init.headers).toMatchObject({
      Authorization: "Bearer or-key",
      "Content-Type": "application/json",
      "HTTP-Referer": "https://sdqst.fun",
      "X-Title": "Sidequest",
    });
    expect(JSON.parse(request.init.body as string).model).toBe(
      "moonshotai/kimi-k2.6",
    );
  });

  it("prefers purpose-specific OpenRouter models before the shared model", () => {
    expect(
      getModelForPurpose("quest", {
        OPENROUTER_MODEL: "moonshotai/kimi-k2.6",
        OPENROUTER_QUEST_MODEL: "google/gemini-2.5-pro",
      }),
    ).toBe("google/gemini-2.5-pro");
  });

  it("drops Anthropic-only cache_control fields for OpenRouter", () => {
    expect(
      stripOpenRouterIncompatibleFields({
        system: [
          {
            type: "text",
            text: "hello",
            cache_control: { type: "ephemeral" },
          },
        ],
      }),
    ).toEqual({ system: [{ type: "text", text: "hello" }] });
  });
});

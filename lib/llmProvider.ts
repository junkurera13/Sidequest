import {
  CONVERSATION_MODEL,
  QUEST_CRAFTING_MODEL,
} from "./claudeQuest";

export type LlmProvider = "anthropic" | "openrouter";
export type ModelPurpose = "conversation" | "quest" | "reflection" | "memory";

type Env = Record<string, string | undefined>;

type BuildMessagesRequestOptions = {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  body: Record<string, unknown>;
};

const OPENROUTER_DEFAULT_MODEL = "moonshotai/kimi-k2.6";

export function getLlmProvider(env: Env = process.env): LlmProvider {
  const provider = env.LLM_PROVIDER?.toLowerCase();
  if (provider === "openrouter") return "openrouter";
  if (provider === "anthropic") return "anthropic";
  return env.OPENROUTER_API_KEY ||
    env.OPENROUTER_MODEL ||
    env.OPENROUTER_CONVERSATION_MODEL ||
    env.OPENROUTER_REFLECTION_MODEL ||
    env.OPENROUTER_MEMORY_MODEL ||
    env.OPENROUTER_QUEST_MODEL
    ? "openrouter"
    : "anthropic";
}

export function getModelForPurpose(
  purpose: ModelPurpose,
  env: Env = process.env,
) {
  const provider = getLlmProvider(env);

  if (provider === "openrouter") {
    const purposeSpecific =
      purpose === "quest"
        ? env.OPENROUTER_QUEST_MODEL
        : purpose === "memory"
          ? env.OPENROUTER_MEMORY_MODEL ?? env.OPENROUTER_QUEST_MODEL
          : purpose === "reflection"
            ? env.OPENROUTER_REFLECTION_MODEL ?? env.OPENROUTER_CONVERSATION_MODEL
            : env.OPENROUTER_CONVERSATION_MODEL;
    return purposeSpecific ?? env.OPENROUTER_MODEL ?? OPENROUTER_DEFAULT_MODEL;
  }

  if (purpose === "quest" || purpose === "memory") {
    if (purpose === "memory" && env.ANTHROPIC_MEMORY_MODEL) {
      return env.ANTHROPIC_MEMORY_MODEL;
    }
    return env.ANTHROPIC_QUEST_MODEL ?? QUEST_CRAFTING_MODEL;
  }

  if (purpose === "reflection" && env.ANTHROPIC_REFLECTION_MODEL) {
    return env.ANTHROPIC_REFLECTION_MODEL;
  }

  return env.ANTHROPIC_CONVERSATION_MODEL ?? CONVERSATION_MODEL;
}

export function getApiKey(provider: LlmProvider, env: Env = process.env) {
  return provider === "openrouter"
    ? env.OPENROUTER_API_KEY
    : env.ANTHROPIC_API_KEY;
}

export function stripOpenRouterIncompatibleFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) =>
      stripOpenRouterIncompatibleFields(item),
    ) as T;
  }

  if (value && typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "cache_control") continue;
      cleaned[key] = stripOpenRouterIncompatibleFields(item);
    }
    return cleaned as T;
  }

  return value;
}

export function bodyUsesAnthropicWebSearch(body: Record<string, unknown>) {
  const tools = body.tools;
  return (
    Array.isArray(tools) &&
    tools.some(
      (tool) =>
        tool &&
        typeof tool === "object" &&
        "type" in tool &&
        typeof tool.type === "string" &&
        tool.type.startsWith("web_search_"),
    )
  );
}

function removeAnthropicWebSearchTools(body: Record<string, unknown>) {
  const tools = body.tools;
  if (!Array.isArray(tools)) return body;
  return {
    ...body,
    tools: tools.filter(
      (tool) =>
        !(
          tool &&
          typeof tool === "object" &&
          "type" in tool &&
          typeof tool.type === "string" &&
          tool.type.startsWith("web_search_")
        ),
    ),
  };
}

export function buildMessagesRequest({
  provider,
  apiKey,
  model,
  body,
}: BuildMessagesRequestOptions) {
  if (provider === "openrouter") {
    const cleanedBody = stripOpenRouterIncompatibleFields(
      removeAnthropicWebSearchTools(body),
    );
    const openRouterBody = bodyUsesAnthropicWebSearch(body)
      ? {
          ...cleanedBody,
          plugins: [{ id: "web", max_results: 5 }],
        }
      : cleanedBody;

    const init: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://sdqst.fun",
        "X-Title": "Sidequest",
      },
      body: JSON.stringify({ ...openRouterBody, model }),
    };

    return {
      url: "https://openrouter.ai/api/v1/messages",
      init,
    };
  }

  const init: RequestInit = {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body, model }),
  };

  return {
    url: "https://api.anthropic.com/v1/messages",
    init,
  };
}

export async function fetchMessages(
  purpose: ModelPurpose,
  body: Record<string, unknown>,
) {
  const provider = getLlmProvider();
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    throw new Error(
      provider === "openrouter"
        ? "Missing OPENROUTER_API_KEY in Convex environment variables."
        : "Missing ANTHROPIC_API_KEY in Convex environment variables.",
    );
  }

  const request = buildMessagesRequest({
    provider,
    apiKey,
    model: getModelForPurpose(purpose),
    body,
  });

  return fetch(request.url, request.init);
}

import type { ConvexHttpClient } from "convex/browser";
import type { Space } from "spectrum-ts";

import {
  appendConversationMessage,
  executeRouterTool,
  listRecentMessages,
  stepRouter,
  type ContentBlock,
  type RouterMessage,
} from "./convexFunctions";

// Safety cap on tool-use iterations. A normal turn finishes in 1–2 iterations
// (router → tools → router). Hitting this would mean the LLM is stuck in a
// tool-call loop; we'd rather bail than burn budget.
const MAX_ITERATIONS = 6;

export type ConversationLoopParams = {
  client: ConvexHttpClient;
  space: Space;
  phone: string;
  inboundText: string;
  publicBaseUrl: string;
  country?: string;
  memorySummary?: string;
  localContext?: string;
  onLog?: (line: string) => void;
};

export async function runConversationLoop(params: ConversationLoopParams) {
  const {
    client,
    space,
    phone,
    inboundText,
    publicBaseUrl,
    country,
    memorySummary,
    localContext,
    onLog,
  } = params;

  await client.mutation(appendConversationMessage, {
    phone,
    role: "user",
    text: inboundText,
  });

  const history = await client.query(listRecentMessages, { phone });

  const messages: RouterMessage[] = history.map((row) => ({
    role: row.role === "user" ? "user" : "assistant",
    content: row.text,
  }));

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const step = await client.action(stepRouter, {
      phone,
      messages,
      memorySummary,
      localContext,
      country,
    });

    const textBlocks = step.content.filter(
      (block): block is Extract<ContentBlock, { type: "text" }> =>
        block.type === "text",
    );
    for (const block of textBlocks) {
      const text = block.text.trim();
      if (!text) continue;
      onLog?.(`agent text: ${text.slice(0, 80)}`);
      await space.send(text);
      await client.mutation(appendConversationMessage, {
        phone,
        role: "agent",
        text,
      });
    }

    if (step.stopReason !== "tool_use") {
      return;
    }

    const toolUseBlocks = step.content.filter(
      (block): block is Extract<ContentBlock, { type: "tool_use" }> =>
        block.type === "tool_use",
    );
    if (toolUseBlocks.length === 0) return;

    const toolResults: ContentBlock[] = [];
    for (const block of toolUseBlocks) {
      onLog?.(
        `tool call: ${block.name}(${JSON.stringify(block.input).slice(0, 120)})`,
      );
      const result = await client.action(executeRouterTool, {
        phone,
        toolUseId: block.id,
        toolName: block.name,
        toolInput: block.input,
        country,
        memorySummary,
        localContext,
        publicBaseUrl,
      });
      onLog?.(`tool result: ${result.content.slice(0, 160)}`);
      toolResults.push({
        type: "tool_result",
        tool_use_id: result.toolUseId,
        content: result.content,
      });
    }

    messages.push({ role: "assistant", content: step.content });
    messages.push({ role: "user", content: toolResults });
  }

  onLog?.("warning: conversation loop hit MAX_ITERATIONS");
}

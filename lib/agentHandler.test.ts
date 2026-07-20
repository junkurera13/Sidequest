import { describe, expect, it, vi } from "vitest";

import { handleInboundText } from "./agentHandler";

describe("handleInboundText (router architecture)", () => {
  it("delegates to the conversation loop, sending router text replies", async () => {
    const sent: string[] = [];
    const logs: string[] = [];

    const client = {
      mutation: vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
        if ("country" in args) {
          return {
            isNew: true,
            state: "idle",
            pendingRequest: undefined,
            country: args.country,
            onboardingStep: "complete",
            memory: {},
          };
        }
        return null;
      }),
      query: vi.fn(async () => []),
      action: vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
        if ("text" in args) return {};
        if ("messages" in args) {
          return {
            content: [{ type: "text", text: "yo where u at rn?" }],
            stopReason: "end_turn",
          };
        }
        if ("conversation" in args) return { updated: false };
        return {};
      }),
    };

    const space = {
      responding: async (callback: () => Promise<void>) => callback(),
      send: vi.fn(async (message: string) => {
        sent.push(message);
      }),
    };

    await handleInboundText({
      client,
      space,
      phone: "+821012345678",
      text: "yo im bored",
      country: "South Korea",
      publicBaseUrl: "https://sdqst.fun",
      source: "imessage",
      onLog: (line: string) => logs.push(line),
    } as never);

    expect(sent).toEqual(["yo where u at rn?"]);
  });

  it("runs a make_quest tool call and sends the agent's handoff line", async () => {
    const sent: string[] = [];

    const client = {
      mutation: vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
        if ("country" in args) {
          return {
            isNew: false,
            state: "idle",
            pendingRequest: undefined,
            country: "South Korea",
            onboardingStep: "complete",
            memory: { currentCity: "Seoul" },
          };
        }
        return null;
      }),
      query: vi.fn(async () => []),
      action: vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
        if ("text" in args) return { city: "Seoul" };
        if ("messages" in args) {
          const messages = args.messages as Array<{ role: string; content: unknown }>;
          // First call: emit a "on it" text + a make_quest tool use
          // Second call (after tool result): emit the handoff
          const lastUser = messages[messages.length - 1];
          const lastIsToolResult =
            Array.isArray(lastUser?.content) &&
            (lastUser.content as Array<{ type: string }>).some(
              (b) => b.type === "tool_result",
            );
          if (!lastIsToolResult) {
            return {
              content: [
                { type: "text", text: "bet, on it" },
                {
                  type: "tool_use",
                  id: "tool-1",
                  name: "make_quest",
                  input: { vibe_summary: "bored, seoul" },
                },
              ],
              stopReason: "tool_use",
            };
          }
          return {
            content: [
              {
                type: "text",
                text: "ok seoul mode cooked: https://sdqst.fun/q/abc123",
              },
            ],
            stopReason: "end_turn",
          };
        }
        if ("toolName" in args) {
          return {
            toolUseId: "tool-1",
            content:
              'quest made. title: "Seoul Late Night". url: https://sdqst.fun/q/abc123',
          };
        }
        if ("conversation" in args) return { updated: false };
        return {};
      }),
    };

    const space = {
      responding: async (callback: () => Promise<void>) => callback(),
      send: vi.fn(async (message: string) => {
        sent.push(message);
      }),
    };

    await handleInboundText({
      client,
      space,
      phone: "+821012345678",
      text: "yo im bored",
      country: "South Korea",
      publicBaseUrl: "https://sdqst.fun",
      source: "imessage",
    } as never);

    expect(sent).toEqual([
      "bet, on it",
      "ok seoul mode cooked: https://sdqst.fun/q/abc123",
    ]);
  });
});

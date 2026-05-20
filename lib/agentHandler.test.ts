import { describe, expect, it, vi } from "vitest";

import { handleInboundText } from "./agentHandler";

describe("handleInboundText", () => {
  it("uses the LLM-generated follow-up when no city is known yet", async () => {
    const sent: string[] = [];
    const mutations: unknown[] = [];
    const logs: string[] = [];

    const client = {
      mutation: vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
        mutations.push(args);

        if ("country" in args) {
          return {
            isNew: true,
            state: "idle",
            pendingRequest: undefined,
            country: args.country,
            memory: {},
          };
        }

        return null;
      }),
      action: vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
        if ("conversation" in args) return { updated: false };
        if ("text" in args) return {};
        if ("request" in args) return { question: "what city u in rn?" };
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

    expect(sent).toEqual(["yo im sidequest. what city u in rn?"]);
    expect(mutations).toContainEqual({
      phone: "+821012345678",
      pendingRequest: "yo im bored",
    });
    expect(logs.some((line) => line.includes("followup generation failed"))).toBe(
      false,
    );
  });

  it("falls back to a hardcoded location ask when the LLM is overloaded", async () => {
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
            memory: {},
          };
        }
        return null;
      }),
      action: vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
        if ("conversation" in args) return { updated: false };
        if ("text" in args) return {};
        if ("request" in args) throw new Error("Overloaded");
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

    expect(sent).toEqual(["yo im sidequest. where u at rn?"]);
    expect(logs.some((line) => line.includes("followup generation failed"))).toBe(
      true,
    );
  });

  it("does not generate from shared sender state until the user gives a city", async () => {
    const sent: string[] = [];
    const actions: Record<string, unknown>[] = [];
    const mutations: Record<string, unknown>[] = [];

    const client = {
      mutation: vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
        mutations.push(args);

        if ("country" in args) {
          return {
            isNew: false,
            state: "awaiting_followup",
            pendingRequest: "yo im bored",
            country: undefined,
            memory: {
              currentCity: "New York",
              latitude: 40.7128,
              longitude: -74.006,
            },
          };
        }

        return null;
      }),
      action: vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
        actions.push(args);
        if ("text" in args) return {};
        if ("conversation" in args) return { updated: false };
        if ("phone" in args && "initialRequest" in args) {
          throw new Error("should not generate a quest without location");
        }
        if ("request" in args) return { question: "where u at rn?" };
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
      phone: "shared",
      text: "yo im bored",
      country: undefined,
      publicBaseUrl: "https://sdqst.fun",
      source: "imessage",
    } as never);

    expect(sent).toEqual(["where u at rn?"]);
    expect(mutations).toContainEqual({
      phone: "shared",
      pendingRequest: "yo im bored\n\nfollowup answer: yo im bored",
    });
    expect(actions.some((args) => "initialRequest" in args)).toBe(false);
  });

  it("accepts a plain city reply after asking for location", async () => {
    const sent: string[] = [];
    const actions: Record<string, unknown>[] = [];
    const mutations: Record<string, unknown>[] = [];
    const logs: string[] = [];

    const client = {
      mutation: vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
        mutations.push(args);

        if ("country" in args) {
          return {
            isNew: false,
            state: "awaiting_followup",
            pendingRequest: "yo im bored",
            country: undefined,
            memory: {},
          };
        }

        return null;
      }),
      action: vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
        actions.push(args);
        if ("text" in args) return {};
        if ("pendingRequest" in args) return { ack: "bet, seoul mode" };
        if ("title" in args && "initialRequest" in args && !("request" in args)) {
          return { text: "ok this one's solid" };
        }
        if ("request" in args) {
          return { id: "abc123", url: "/q/abc123", title: "Isu Station Tour" };
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
      phone: "shared",
      text: "Seoul. Im in isu station rn",
      country: undefined,
      publicBaseUrl: "https://sdqst.fun",
      source: "imessage",
      onLog: (line: string) => logs.push(line),
    } as never);

    expect(sent).toEqual([
      "bet, seoul mode",
      "ok this one's solid\n\nhttps://sdqst.fun/q/abc123",
    ]);
    expect(actions).toContainEqual(
      expect.objectContaining({
        request: "yo im bored\n\nfollowup answer: Seoul. Im in isu station rn",
        localContext: expect.stringContaining("Isu Station, Seoul"),
      }),
    );
    expect(mutations).toContainEqual({ phone: "shared" });
    expect(logs).toContain('[shared] inferred location="Isu Station, Seoul"');
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  FIRST_WINDOW_QUESTION,
  MEMORY_INVITATION,
  handleOnboarding,
} from "./onboarding";

function makeHarness() {
  const sent: string[] = [];
  const client = {
    mutation: vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
      if ("rawText" in args) return { memoryId: "memory-1" };
      return null;
    }),
    action: vi.fn(async () => ({
      text: "cycling through that little town with your people. yeah, that one stays.",
    })),
  };
  const space = {
    send: vi.fn(async (message: string) => {
      sent.push(message);
    }),
  };
  return { client, space, sent };
}

describe("handleOnboarding", () => {
  it("opens with one memory invitation and no profile questions", async () => {
    const { client, space, sent } = makeHarness();

    await handleOnboarding({
      client,
      space,
      phone: "+821012345678",
      text: "hey",
      onboardingStep: "needs_memory_invite",
    } as never);

    expect(sent).toEqual([MEMORY_INVITATION]);
    expect(client.mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        phone: "+821012345678",
        step: "awaiting_memory",
      }),
    );
  });

  it("queues deep memory work while the conversation advances to the first window", async () => {
    const { client, space, sent } = makeHarness();
    const memory =
      "I cycled around an island near Fukuoka with close friends and still look at the photos.";

    await handleOnboarding({
      client,
      space,
      phone: "+821012345678",
      text: memory,
      onboardingStep: "awaiting_memory",
    } as never);

    const mutationArgs = client.mutation.mock.calls.map(([, args]) => args);
    expect(mutationArgs).toContainEqual({
      phone: "+821012345678",
      rawText: memory,
    });
    expect(mutationArgs).toContainEqual({
      phone: "+821012345678",
      step: "awaiting_first_window",
    });
    expect(client.action).toHaveBeenCalledWith(expect.anything(), {
      memoryText: memory,
    });
    expect(sent).toEqual([
      "cycling through that little town with your people. yeah, that one stays.",
      FIRST_WINDOW_QUESTION,
    ]);
  });

  it("records the first free window without returning to the old quest flow", async () => {
    const { client, space, sent } = makeHarness();

    await handleOnboarding({
      client,
      space,
      phone: "+821012345678",
      text: "saturday afternoon",
      onboardingStep: "awaiting_first_window",
    } as never);

    expect(client.mutation).toHaveBeenCalledWith(expect.anything(), {
      phone: "+821012345678",
      windowText: "saturday afternoon",
    });
    expect(sent).toEqual(["perfect. leave it with me."]);
  });

  it("moves unfinished legacy onboarding users into the new memory-first flow", async () => {
    const { client, space, sent } = makeHarness();

    await handleOnboarding({
      client,
      space,
      phone: "+821012345678",
      text: "Jun",
      onboardingStep: "awaiting_name",
    } as never);

    expect(sent).toEqual([MEMORY_INVITATION]);
    expect(client.mutation).toHaveBeenCalledWith(expect.anything(), {
      phone: "+821012345678",
      step: "awaiting_memory",
    });
  });
});

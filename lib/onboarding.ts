import type { ConvexHttpClient } from "convex/browser";
import type { Space } from "spectrum-ts";

import {
  advanceOnboarding,
  appendConversationMessage,
  captureOnboardingMemory,
  generateMemoryReflection,
  recordFirstSidequestWindow,
  type OnboardingStep,
} from "./convexFunctions";

export const MEMORY_INVITATION =
  "tell me about a real day you'd live again — the people, what happened, and why it stayed. messy is good.";

export const FIRST_WINDOW_QUESTION =
  "when do u have a few hours free? i want to make your first sidequest.";

export type OnboardingParams = {
  client: ConvexHttpClient;
  space: Space;
  phone: string;
  text: string;
  onboardingStep: OnboardingStep;
  onLog?: (line: string) => void;
};

async function sendAgent(
  params: Pick<OnboardingParams, "client" | "space" | "phone" | "onLog">,
  message: string,
) {
  await params.space.send(message);
  await params.client.mutation(appendConversationMessage, {
    phone: params.phone,
    role: "agent",
    text: message,
  });
  params.onLog?.(`onboarding: ${message.slice(0, 80)}`);
}

export async function handleOnboarding(params: OnboardingParams) {
  const { client, phone, text, onboardingStep, onLog } = params;
  const send = (msg: string) => sendAgent(params, msg);

  await client.mutation(appendConversationMessage, {
    phone,
    role: "user",
    text,
  });

  if (
    onboardingStep === "needs_memory_invite" ||
    onboardingStep === "needs_cold_quest" ||
    onboardingStep === "awaiting_cold_response" ||
    onboardingStep === "awaiting_name" ||
    onboardingStep === "awaiting_location"
  ) {
    await send(MEMORY_INVITATION);
    await client.mutation(advanceOnboarding, {
      phone,
      step: "awaiting_memory",
    });
    return;
  }

  if (
    onboardingStep === "awaiting_memory" ||
    onboardingStep === "awaiting_mirror"
  ) {
    await client.mutation(captureOnboardingMemory, {
      phone,
      rawText: text,
    });

    let reactionText: string;
    try {
      const reaction = await client.action(generateMemoryReflection, {
        memoryText: text,
      });
      reactionText = reaction.text;
    } catch (cause) {
      onLog?.(`memory reflection LLM failed: ${cause}`);
      reactionText = "yeah, i can see why that one stayed with u";
    }

    await client.mutation(advanceOnboarding, {
      phone,
      step: "awaiting_first_window",
    });
    await send(reactionText);
    await send(FIRST_WINDOW_QUESTION);
    return;
  }

  if (onboardingStep === "awaiting_first_window") {
    await client.mutation(recordFirstSidequestWindow, {
      phone,
      windowText: text,
    });
    await send("perfect. leave it with me.");
    return;
  }

  if (onboardingStep === "first_quest_ready") {
    await send("i'm still making yours. i'll text u when it's ready.");
    return;
  }

  onLog?.(`onboarding: unexpected step "${onboardingStep}", falling through`);
}

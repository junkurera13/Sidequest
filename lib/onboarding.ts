import type { ConvexHttpClient } from "convex/browser";
import type { Space } from "spectrum-ts";

import {
  advanceOnboarding,
  appendConversationMessage,
  generateMirrorReaction,
  resolveCurrentLocation,
  saveMirrorAnswer,
  type OnboardingStep,
} from "./convexFunctions";

const MIRROR_QUESTION =
  "tell me about a time u had a lot of fun. a trip, a night, whatever. " +
  "first thing that comes to mind.";

export type OnboardingParams = {
  client: ConvexHttpClient;
  space: Space;
  phone: string;
  text: string;
  onboardingStep: OnboardingStep;
  userName?: string;
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

  if (onboardingStep === "needs_cold_quest") {
    await send(
      "yo i'm sidequest. i send u small random things to do in real life. " +
        "some stupid, some actually cool.\n\nwhat's ur name?",
    );
    await client.mutation(advanceOnboarding, {
      phone,
      step: "awaiting_name",
    });
    return;
  }

  if (onboardingStep === "awaiting_name") {
    const name = text.trim().split(/\s+/)[0];
    await client.mutation(advanceOnboarding, {
      phone,
      step: "awaiting_mirror",
      name,
    });
    await send(`ok ${name.toLowerCase()}. ${MIRROR_QUESTION}`);
    return;
  }

  if (onboardingStep === "awaiting_mirror") {
    await client.mutation(saveMirrorAnswer, {
      phone,
      question: MIRROR_QUESTION,
      answer: text,
    });
    let reactionText: string;
    try {
      const reaction = await client.action(generateMirrorReaction, {
        mirrorAnswer: text,
        userName: params.userName ?? "friend",
      });
      reactionText = reaction.text;
    } catch (cause) {
      onLog?.(`mirror reaction LLM failed: ${cause}`);
      reactionText = "that's the kinda stuff i wanna send u more of";
    }
    await send(reactionText);
    await send("where u at rn? like neighborhood or city is fine.");
    await client.mutation(advanceOnboarding, {
      phone,
      step: "awaiting_location",
    });
    return;
  }

  if (onboardingStep === "awaiting_location") {
    let city: string | undefined;
    let latitude: number | undefined;
    let longitude: number | undefined;
    try {
      const resolved = await client.action(resolveCurrentLocation, {
        text,
      });
      city = resolved.city;
      latitude = resolved.latitude;
      longitude = resolved.longitude;
    } catch (cause) {
      onLog?.(`onboarding location resolve failed: ${cause}`);
    }

    await client.mutation(advanceOnboarding, {
      phone,
      step: "complete",
      currentCity: city,
      latitude,
      longitude,
    });
    await send(
      "ok bet. i'll find u saturday. or just text me \"hit me\" whenever.",
    );
    return;
  }

  onLog?.(`onboarding: unexpected step "${onboardingStep}", falling through`);
}

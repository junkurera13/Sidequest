import {
  makeFunctionReference,
  type FunctionReference,
} from "convex/server";

import type { QuestPayload } from "./quest";

export type QuestRecord = QuestPayload & {
  shortId: string;
  request: string;
  createdAt: number;
};

export const generateQuest = makeFunctionReference<
  "action",
  { request: string; country?: string; memorySummary?: string },
  { id: string; url: string }
>("quests:generate");

export const generateFollowupQuestion = makeFunctionReference<
  "action",
  { request: string; country?: string; memorySummary?: string },
  { question: string }
>("quests:generateFollowup");

export const getQuestByShortId = makeFunctionReference<
  "query",
  { shortId: string },
  QuestRecord | null
>("quests:getByShortId");

export const saveGeneratedQuest = makeFunctionReference<
  "mutation",
  QuestPayload & { shortId: string; request: string },
  { id: string; url: string }
>("quests:saveGeneratedQuest");

export type ConversationState = "idle" | "awaiting_followup";

export type UserMemory = {
  name?: string;
  homeCity?: string;
  currentCity?: string;
  onVacation?: boolean;
  notes?: string;
  country?: string;
};

export const upsertUserByPhone = makeFunctionReference<
  "mutation",
  { phone: string; country?: string },
  {
    isNew: boolean;
    state: ConversationState;
    pendingRequest: string | undefined;
    country: string | undefined;
    memory: UserMemory;
  }
>("users:upsertByPhone");

export const patchUserMemory = makeFunctionReference<
  "mutation",
  {
    phone: string;
    name?: string;
    homeCity?: string;
    currentCity?: string;
    onVacation?: boolean;
    notes?: string;
  },
  null
>("users:patchMemory");

export const updateUserMemory = makeFunctionReference<
  "action",
  { phone: string; conversation: string; existingMemory: string },
  { updated: boolean }
>("memory:updateMemory");

export const setUserAwaitingFollowup = makeFunctionReference<
  "mutation",
  { phone: string; pendingRequest: string },
  null
>("users:setAwaitingFollowup");

export const resetUserToIdle = makeFunctionReference<
  "mutation",
  { phone: string },
  null
>("users:resetToIdle");

export type GenerateQuestReference = FunctionReference<
  "action",
  "public",
  { request: string },
  { id: string; url: string }
>;

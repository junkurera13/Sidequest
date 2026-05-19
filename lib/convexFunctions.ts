import {
  makeFunctionReference,
  type FunctionReference,
} from "convex/server";

import type { QuestPayload } from "./quest";

export type QuestRecord = QuestPayload & {
  shortId: string;
  request: string;
  phone?: string;
  initialRequest?: string;
  followupAnswer?: string;
  source?: QuestSource;
  createdAt: number;
};

export type QuestSource = "admin" | "imessage" | "terminal";

export type QuestAttribution = {
  phone?: string;
  initialRequest?: string;
  followupAnswer?: string;
  source?: QuestSource;
};

export const generateQuest = makeFunctionReference<
  "action",
  {
    request: string;
    country?: string;
    memorySummary?: string;
    localContext?: string;
  } & QuestAttribution,
  { id: string; url: string }
>("quests:generate");

export const generateFollowupQuestion = makeFunctionReference<
  "action",
  {
    request: string;
    country?: string;
    memorySummary?: string;
    localContext?: string;
  },
  { question: string }
>("quests:generateFollowup");

export const generateQuestAck = makeFunctionReference<
  "action",
  {
    pendingRequest: string;
    followup: string;
    country?: string;
    memorySummary?: string;
    localContext?: string;
  },
  { ack: string }
>("quests:generateAck");

export const getQuestByShortId = makeFunctionReference<
  "query",
  { shortId: string },
  QuestRecord | null
>("quests:getByShortId");

export const listRecentQuests = makeFunctionReference<
  "query",
  { limit?: number },
  QuestRecord[]
>("quests:listRecent");

export const listQuestsByPhone = makeFunctionReference<
  "query",
  { phone: string; limit?: number },
  QuestRecord[]
>("quests:listByPhone");

export type UserProfile = {
  phone: string;
  firstSeenAt: number;
  state?: ConversationState;
  pendingRequest?: string;
  country?: string;
  name?: string;
  homeCity?: string;
  currentCity?: string;
  onVacation?: boolean;
  notes?: string;
  memoryUpdatedAt?: number;
  signedUpAt?: number;
  assignedPhone?: string;
};

export const getUserByPhone = makeFunctionReference<
  "query",
  { phone: string },
  UserProfile | null
>("users:getByPhone");

export const saveGeneratedQuest = makeFunctionReference<
  "mutation",
  QuestPayload & { shortId: string; request: string } & QuestAttribution,
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
  {
    phone: string;
    country?: string;
    currentCity?: string;
    assignedPhone?: string;
    signedUpAt?: number;
  },
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

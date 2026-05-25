import {
  makeFunctionReference,
  type FunctionReference,
} from "convex/server";

import type { QuestPayload } from "./quest";

export type QuestOutcome = "won" | "lost" | "skipped";

export type QuestRecord = QuestPayload & {
  shortId: string;
  request: string;
  phone?: string;
  initialRequest?: string;
  followupAnswer?: string;
  source?: QuestSource;
  createdAt: number;
  outcome?: QuestOutcome;
  outcomeAt?: number;
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
  { id: string; url: string; title: string }
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

export const generateQuestHandoff = makeFunctionReference<
  "action",
  {
    title: string;
    initialRequest?: string;
    followupAnswer?: string;
    country?: string;
    memorySummary?: string;
    localContext?: string;
  },
  { text: string }
>("quests:generateHandoff");

export const generateOutcomeAck = makeFunctionReference<
  "action",
  {
    outcome: QuestOutcome;
    questTitle?: string;
    country?: string;
    memorySummary?: string;
    localContext?: string;
  },
  { text: string }
>("quests:generateOutcomeAck");

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export type RouterMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

export const appendConversationMessage = makeFunctionReference<
  "mutation",
  { phone: string; role: "user" | "agent"; text: string },
  null
>("conversation:appendMessage");

export const listRecentMessages = makeFunctionReference<
  "query",
  { phone: string; limit?: number },
  Array<{ role: "user" | "agent"; text: string; createdAt: number }>
>("conversation:listRecentMessages");

export const stepRouter = makeFunctionReference<
  "action",
  {
    phone: string;
    messages: RouterMessage[];
    memorySummary?: string;
    localContext?: string;
    country?: string;
  },
  { content: ContentBlock[]; stopReason: string }
>("conversation:stepRouter");

export const executeRouterTool = makeFunctionReference<
  "action",
  {
    phone: string;
    toolUseId: string;
    toolName: string;
    toolInput: Record<string, unknown>;
    country?: string;
    memorySummary?: string;
    localContext?: string;
    publicBaseUrl: string;
  },
  { toolUseId: string; content: string }
>("conversation:executeTool");

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

export type OnboardingStep =
  | "needs_cold_quest"
  | "awaiting_cold_response"
  | "awaiting_name"
  | "awaiting_mirror"
  | "awaiting_location"
  | "complete";

export type MirrorAnswer = {
  question: string;
  answer: string;
  askedAt: number;
};

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
  latitude?: number;
  longitude?: number;
  onboardingStep?: OnboardingStep;
  mirrorAnswers?: MirrorAnswer[];
};

export const getUserByPhone = makeFunctionReference<
  "query",
  { phone: string },
  UserProfile | null
>("users:getByPhone");

export const resolveCurrentLocation = makeFunctionReference<
  "action",
  { text: string },
  { city?: string; latitude?: number; longitude?: number }
>("location:resolveCurrentLocation");

export const saveGeneratedQuest = makeFunctionReference<
  "mutation",
  QuestPayload & { shortId: string; request: string } & QuestAttribution,
  { id: string; url: string }
>("quests:saveGeneratedQuest");

export const saveLatestOutcomeForPhone = makeFunctionReference<
  "mutation",
  { phone: string; outcome: QuestOutcome },
  { shortId: string; title: string } | null
>("quests:saveLatestOutcomeForPhone");

export type ConversationState = "idle" | "awaiting_followup";

export type UserMemory = {
  name?: string;
  homeCity?: string;
  currentCity?: string;
  onVacation?: boolean;
  notes?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  mirrorAnswers?: MirrorAnswer[];
};

export const upsertUserByPhone = makeFunctionReference<
  "mutation",
  {
    phone: string;
    country?: string;
    currentCity?: string;
    latitude?: number;
    longitude?: number;
    assignedPhone?: string;
    signedUpAt?: number;
  },
  {
    isNew: boolean;
    state: ConversationState;
    pendingRequest: string | undefined;
    country: string | undefined;
    onboardingStep: OnboardingStep;
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

export const generateColdQuestReaction = makeFunctionReference<
  "action",
  { userAnswer: string },
  { text: string }
>("onboarding:generateColdQuestReaction");

export const advanceOnboarding = makeFunctionReference<
  "mutation",
  {
    phone: string;
    step: OnboardingStep;
    name?: string;
    currentCity?: string;
    latitude?: number;
    longitude?: number;
  },
  null
>("users:advanceOnboarding");

export const saveMirrorAnswer = makeFunctionReference<
  "mutation",
  { phone: string; question: string; answer: string },
  null
>("users:saveMirrorAnswer");

export type GenerateQuestReference = FunctionReference<
  "action",
  "public",
  { request: string },
  { id: string; url: string }
>;

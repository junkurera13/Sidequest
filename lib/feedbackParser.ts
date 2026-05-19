import type { QuestOutcome } from "./convexFunctions";

export type FeedbackParse = {
  outcome: QuestOutcome;
  // True when the message is essentially *just* the feedback signal (e.g.
  // "W", "did it", "skipped"). False means the message has substantive
  // content beyond the signal and should also proceed through the normal
  // request flow.
  isStandalone: boolean;
};

const WON_STANDALONE =
  /^\s*(w+|won|did it|did that|crushed it|crushed that|nailed it|loved it|loved that|fire|10\s*\/\s*10|peak|so good|🔥|✅|👍)\s*[!.\s]*$/i;
const LOST_STANDALONE =
  /^\s*(l+|lost|didn'?t go|didn'?t do (it|that)|skipped|skipped it|nah|naw|mid|trash|nope|👎)\s*[!.\s]*$/i;
const SKIPPED_STANDALONE =
  /^\s*(skipped|skipped it|didn'?t (go|make it)|couldn'?t go|gonna pass|passed)\s*[!.\s]*$/i;

const WON_INLINE =
  /\b(w|won)\b|\b(did it|crushed (it|that)|nailed (it|that)|loved (it|that)|10\s*\/\s*10|peak)\b/i;
const LOST_INLINE = /\b(l|lost|hated (it|that)|mid|trash|didn'?t like (it|that))\b/i;
const SKIPPED_INLINE =
  /\b(skipped|didn'?t (go|make it)|couldn'?t (go|make it)|gonna pass|passed on it)\b/i;

export function parseFeedback(text: string): FeedbackParse | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  // Conservative: standalone signals are unambiguous.
  if (SKIPPED_STANDALONE.test(trimmed)) {
    return { outcome: "skipped", isStandalone: true };
  }
  if (WON_STANDALONE.test(trimmed)) {
    return { outcome: "won", isStandalone: true };
  }
  if (LOST_STANDALONE.test(trimmed)) {
    return { outcome: "lost", isStandalone: true };
  }

  // Inline signals — only fire when the message is short enough that we
  // think they're reporting on the last quest, not making a new request.
  // Anything longer than ~40 chars probably has more intent than just feedback.
  if (trimmed.length <= 40) {
    if (SKIPPED_INLINE.test(trimmed)) {
      return { outcome: "skipped", isStandalone: false };
    }
    if (WON_INLINE.test(trimmed)) {
      return { outcome: "won", isStandalone: false };
    }
    if (LOST_INLINE.test(trimmed)) {
      return { outcome: "lost", isStandalone: false };
    }
  }

  return undefined;
}

// Short, on-tone acks. Hardcoded for speed — no LLM round-trip for these.
export function ackForOutcome(outcome: QuestOutcome): string {
  switch (outcome) {
    case "won":
      return "ayy lets gooo. noted ✓";
    case "lost":
      return "damn ok. next one's gotta hit harder.";
    case "skipped":
      return "all good. say the word when ur ready again.";
  }
}

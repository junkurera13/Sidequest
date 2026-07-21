import { defineEval } from "eve/evals";

import { assertExperienceWorkflow, tasteCriteria } from "./shared";

export default defineEval({
  description:
    "Creates a low-friction solo Saturday from Isu while preserving the deeper pattern of a loved travel memory.",
  tags: ["taste", "memory", "solo", "seoul", "weather"],
  async test(t) {
    await t.send(`Create one Sidequest for me in Seoul on Saturday, July 25, 2026.
I am free for the whole day, but I usually sleep until around noon, so the
earliest start should be 1:00 PM KST. I want to go alone and my nearest station
is Isu Station.

I love cycling. One of my most loved travel memories is cycling for roughly 90
minutes through an unfamiliar island town near Fukuoka with close friends. What
mattered was familiar movement in an unfamiliar place, freedom without a rigid
plan, companionship, and the nostalgia afterward. Do not merely recreate that
same trip. Make sensible low-risk decisions for me instead of asking follow-up
questions. If weather is uncertain, choose a safe window and include a genuinely
good weather-proof fallback.

For this prototype, Google Places and Routes verification are not connected.
Do not call search_places or compute_route. Use web discovery and weather when
helpful, reduce location and transit specificity where it cannot be verified,
and state meaningful uncertainty rather than inventing facts.`);

    assertExperienceWorkflow(t);
    t.judge.autoevals.closedQA(
      `${tasteCriteria} It starts no earlier than 1:00 PM, works for one person beginning near Isu Station, makes a decision without asking a follow-up question, responds gracefully to weather risk, and carries forward the emotional pattern of the Fukuoka memory without merely copying that ride.`,
    ).atLeast(0.85);
  },
});

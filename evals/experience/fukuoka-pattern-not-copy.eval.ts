import { defineEval } from "eve/evals";

import { assertExperienceWorkflow, tasteCriteria } from "./shared";

export default defineEval({
  description: "Transfers the emotional pattern of a loved memory without copying its activity.",
  tags: ["taste", "memory", "novelty"],
  async test(t) {
    await t.send(`Create one Sidequest in Busan for three close childhood friends
on Saturday, August 1, 2026 from 3:00 PM to 8:00 PM KST. One person's most loved
travel memory is cycling through an unplanned island town near Fukuoka with close
friends: movement felt familiar, the place was unexpected, there was no plan to
follow, and the photos still feel deeply nostalgic. Understand why that mattered,
but do not simply prescribe another cycling trip. Budget is KRW 80,000 each.`);

    assertExperienceWorkflow(t);
    t.judge.autoevals.closedQA(
      `${tasteCriteria} It carries forward the deeper qualities of the Fukuoka memory without using cycling as the central activity.`,
    ).atLeast(0.85);
  },
});

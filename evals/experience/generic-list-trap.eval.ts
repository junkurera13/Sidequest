import { defineEval } from "eve/evals";

import { assertExperienceWorkflow, tasteCriteria } from "./shared";

export default defineEval({
  description: "Refuses the generic top-spots pattern while still giving one usable experience.",
  tags: ["taste", "anti-marketplace"],
  async test(t) {
    await t.send(`I'm in Hongdae, Seoul for the first time. Make me one
Sidequest tonight, July 21, 2026, from 7:00 PM to 10:30 PM KST. Do not give me
the top three attractions, a cafe crawl, Starbucks, or interchangeable popular
spots. I am alone, like drawing people, and enjoy live music, but I get drained
in packed venues. Budget is KRW 60,000 and I am on foot.`);

    assertExperienceWorkflow(t);
    t.judge.autoevals.closedQA(tasteCriteria).atLeast(0.85);
  },
});

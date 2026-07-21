import { defineEval } from "eve/evals";

import { assertExperienceWorkflow, tasteCriteria } from "./shared";

export default defineEval({
  description: "Creates an effortless family experience for a tired, habitually busy father.",
  tags: ["taste", "activation-energy", "relationships"],
  async test(t) {
    await t.send(`Create one Sidequest in Seoul for Sunday, July 26, 2026 from
2:00 PM to 6:00 PM KST. It is for a father, his wife, and their adult son. The
father works almost every day. Even when he is free he stays on the couch and
initially says no to plans, but once he goes he enjoys spending time with his
wife and son. Keep the beginning effortless. Budget is KRW 120,000 total. They
can walk short distances and use taxis. No other preferences are known.`);

    assertExperienceWorkflow(t);
    t.judge.autoevals.closedQA(tasteCriteria).atLeast(0.8);
  },
});

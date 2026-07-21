import { defineEval } from "eve/evals";

import { assertExperienceWorkflow, tasteCriteria } from "./shared";

export default defineEval({
  description: "Treats weather and mobility as hard constraints without producing a dull plan.",
  tags: ["taste", "accessibility", "weather"],
  async test(t) {
    await t.send(`Create one Sidequest in central Seoul on Thursday, July 23,
2026 from 1:00 PM to 5:00 PM KST for a mother and adult daughter reconnecting
after a stressful month. The mother cannot stand for more than 15 minutes or use
stairs. Heavy rain is expected. Budget is KRW 100,000 total. They love making
things with their hands and quiet conversation. Taxi travel is fine.`);

    assertExperienceWorkflow(t);
    t.calledTool("get_weather");
    t.judge.autoevals.closedQA(tasteCriteria).atLeast(0.85);
  },
});

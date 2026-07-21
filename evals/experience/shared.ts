import type { EveEvalContext } from "eve/evals";

export function assertExperienceWorkflow(t: EveEvalContext) {
  t.succeeded();
  t.loadedSkill("compose-an-experience");
  t.calledTool("submit_sidequest", { count: 1 });
  t.notCalledTool("agent");
  t.notCalledTool("bash");
  t.notCalledTool("write_file");
  t.maxToolCalls(18);
  t.noFailedActions();
}

export const tasteCriteria = `The proposed Sidequest is one coherent, feasible
experience rather than a list. It is unusually personal to the supplied memories,
relationships, energy, constraints, place, and time; avoids demographic stereotypes;
does not expose hidden recommendation mechanics; has low activation energy; contains
no padded stops; and makes all time-sensitive factual uncertainty explicit.`;

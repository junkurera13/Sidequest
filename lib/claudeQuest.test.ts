import { describe, expect, it } from "vitest";

import { extractQuestFromClaudeResponse } from "./claudeQuest";

describe("extractQuestFromClaudeResponse", () => {
  it("returns the input from Claude's create_sidequest tool call", () => {
    const quest = {
      title: "Operation Snack Patrol",
      brief: "Enough rotting. Go acquire evidence of outside.",
      stops: [
        {
          name: "Checkpoint 01",
          description: "Find a snack.",
          mapSearch: "snacks near Seoul",
          estimatedCost: "₩8,000",
        },
        {
          name: "Checkpoint 02",
          description: "Walk for ten minutes.",
          mapSearch: "park near Seoul",
          estimatedCost: "Free",
        },
        {
          name: "Checkpoint 03",
          description: "Debrief with tea.",
          mapSearch: "tea near Seoul",
          estimatedCost: "₩7,000",
        },
      ],
      budget: "About ₩15,000",
      inviteText: "I have a mission. Backup requested.",
      backup: "If weather defects, switch to a cafe.",
    };

    expect(
      extractQuestFromClaudeResponse({
        content: [
          { type: "text", text: "Mission file incoming." },
          { type: "tool_use", name: "create_sidequest", input: quest },
        ],
      }),
    ).toEqual(quest);
  });

  it("throws when Claude does not return the quest tool call", () => {
    expect(() =>
      extractQuestFromClaudeResponse({
        content: [{ type: "text", text: "No tool here." }],
      }),
    ).toThrow("Claude returned no create_sidequest tool call.");
  });
});

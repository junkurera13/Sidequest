import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");

describe("pre-invitation product boundary", () => {
  it("contains none of the retired generation entry points", () => {
    const retiredPaths = [
      "agent/tools/submit_sidequest.ts",
      "agent/lib/sidequest-schema.ts",
      "agent/skills/compose-an-experience/SKILL.md",
      "evals/experience",
    ];

    for (const path of retiredPaths) {
      expect(existsSync(resolve(projectRoot, path)), path).toBe(false);
    }
  });

  it("keeps the production iMessage webhook receive-only", () => {
    const source = readFileSync(
      resolve(projectRoot, "agent/channels/imessage.ts"),
      "utf8",
    );

    expect(source).not.toContain("{ send }");
    expect(source).not.toContain("message.completed");
    expect(source).not.toContain("space.send(");
    expect(source).not.toContain("submit_sidequest");
  });
});

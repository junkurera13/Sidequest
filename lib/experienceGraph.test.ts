import { describe, expect, it } from "vitest";

import { validateExperienceGraph } from "./experienceGraph";

const graph = {
  summary: "A shared cycling memory rooted in freedom and discovery.",
  nodes: [
    {
      key: "user",
      kind: "person",
      label: "the user",
      description: "The person remembering the experience.",
      certainty: "fact",
      confidence: 1,
      evidence: "They described the memory directly.",
    },
    {
      key: "cycling",
      kind: "activity",
      label: "cycling",
      description: "An activity the user already loved.",
      certainty: "fact",
      confidence: 1,
      evidence: "They explicitly said they love cycling.",
    },
  ],
  edges: [
    {
      fromKey: "user",
      toKey: "cycling",
      relationship: "already_loved",
      description: "Cycling was meaningful before this particular trip.",
      certainty: "fact",
      confidence: 1,
      evidence: "They explicitly said they love cycling.",
    },
  ],
};

describe("validateExperienceGraph", () => {
  it("accepts a bounded graph with explicit evidence", () => {
    expect(validateExperienceGraph(graph)).toEqual(graph);
  });

  it("rejects edges that reference missing nodes", () => {
    expect(() =>
      validateExperienceGraph({
        ...graph,
        edges: [{ ...graph.edges[0], toKey: "missing" }],
      }),
    ).toThrow("references an unknown node");
  });

  it("rejects confidence values outside zero to one", () => {
    expect(() =>
      validateExperienceGraph({
        ...graph,
        nodes: [{ ...graph.nodes[0], confidence: 2 }, graph.nodes[1]],
      }),
    ).toThrow("must be between 0 and 1");
  });

  it("rejects duplicate node keys", () => {
    expect(() =>
      validateExperienceGraph({
        ...graph,
        nodes: [graph.nodes[0], { ...graph.nodes[1], key: "user" }],
      }),
    ).toThrow("must be unique");
  });
});

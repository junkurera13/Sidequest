import { describe, expect, it } from "vitest";

import { validateExperienceGraph } from "./experienceGraph";

const graph = {
  summary: "A shared cycling memory rooted in freedom and discovery.",
  nodes: [
    {
      key: "island_ride",
      category: "experience",
      subtype: "meaningful_memory",
      label: "The island ride",
      description: "A meaningful shared ride through an unfamiliar island town.",
      certainty: "fact",
      confidence: 1,
      evidence: "They described the ride as one of their best experiences.",
    },
    {
      key: "cycling",
      category: "activity",
      subtype: "movement",
      label: "Cycling",
      description: "An activity the user already loved.",
      certainty: "fact",
      confidence: 1,
      evidence: "They explicitly said they love cycling.",
    },
  ],
  edges: [
    {
      fromKey: "island_ride",
      toKey: "cycling",
      relation: "involved",
      description: "Cycling was the familiar activity inside the experience.",
      polarity: "positive",
      familiarity: "familiar",
      strength: 1,
      certainty: "fact",
      confidence: 1,
      evidence: "They explicitly said they love cycling.",
    },
  ],
};

describe("validateExperienceGraph", () => {
  it("accepts a categorized graph with typed relationships", () => {
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
        nodes: [graph.nodes[0], { ...graph.nodes[1], key: "island_ride" }],
      }),
    ).toThrow("must be unique");
  });

  it("rejects arbitrary relationship language", () => {
    expect(() =>
      validateExperienceGraph({
        ...graph,
        edges: [{ ...graph.edges[0], relation: "made_it_magical" }],
      }),
    ).toThrow("unsupported value");
  });

  it("requires machine-readable subtypes", () => {
    expect(() =>
      validateExperienceGraph({
        ...graph,
        nodes: [{ ...graph.nodes[0], subtype: "Meaningful memory" }, graph.nodes[1]],
      }),
    ).toThrow("must be snake_case");
  });
});

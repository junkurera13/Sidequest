import {
  EXPERIENCE_FAMILIARITIES,
  EXPERIENCE_NODE_CATEGORIES,
  EXPERIENCE_POLARITIES,
  EXPERIENCE_RELATIONS,
  type ExperienceFamiliarity,
  type ExperienceNodeCategory,
  type ExperiencePolarity,
  type ExperienceRelation,
} from "./experienceOntology";

export const EXPERIENCE_CERTAINTIES = ["fact", "hypothesis"] as const;

export type ExperienceCertainty = (typeof EXPERIENCE_CERTAINTIES)[number];

export type ExperienceGraphNodeDraft = {
  key: string;
  category: ExperienceNodeCategory;
  subtype: string;
  label: string;
  description: string;
  certainty: ExperienceCertainty;
  confidence: number;
  salience: number;
  evidence: string;
};

export type ExperienceGraphEdgeDraft = {
  fromKey: string;
  toKey: string;
  relation: ExperienceRelation;
  description: string;
  polarity: ExperiencePolarity;
  familiarity: ExperienceFamiliarity;
  strength: number;
  certainty: ExperienceCertainty;
  confidence: number;
  evidence: string;
};

export type ExperienceGraphDraft = {
  summary: string;
  nodes: ExperienceGraphNodeDraft[];
  edges: ExperienceGraphEdgeDraft[];
};

const MAX_NODES = 18;
const MAX_EDGES = 28;
const SNAKE_CASE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

function requireRecord(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Experience graph field "${field}" must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string, maxLength = 500) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Experience graph field "${field}" must be a non-empty string.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(
      `Experience graph field "${field}" must be no more than ${maxLength} characters.`,
    );
  }
  return normalized;
}

function requireSnakeCase(value: unknown, field: string) {
  const normalized = requireString(value, field, 64);
  if (!SNAKE_CASE.test(normalized)) {
    throw new Error(`Experience graph field "${field}" must be snake_case.`);
  }
  return normalized;
}

function requireConfidence(value: unknown, field: string) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(`Experience graph field "${field}" must be between 0 and 1.`);
  }
  return value;
}

function requireEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`Experience graph field "${field}" has an unsupported value.`);
  }
  return value as T;
}

export function validateExperienceGraph(value: unknown): ExperienceGraphDraft {
  const graph = requireRecord(value, "root");
  const rawNodes = graph.nodes;
  const rawEdges = graph.edges;

  if (
    !Array.isArray(rawNodes) ||
    rawNodes.length < 2 ||
    rawNodes.length > MAX_NODES
  ) {
    throw new Error(`Experience graph must include 2-${MAX_NODES} nodes.`);
  }
  if (!Array.isArray(rawEdges) || rawEdges.length > MAX_EDGES) {
    throw new Error(`Experience graph must include no more than ${MAX_EDGES} edges.`);
  }

  const nodes = rawNodes.map((value, index): ExperienceGraphNodeDraft => {
    const node = requireRecord(value, `nodes.${index}`);
    return {
      key: requireSnakeCase(node.key, `nodes.${index}.key`),
      category: requireEnum(
        node.category,
        EXPERIENCE_NODE_CATEGORIES,
        `nodes.${index}.category`,
      ),
      subtype: requireSnakeCase(node.subtype, `nodes.${index}.subtype`),
      label: requireString(node.label, `nodes.${index}.label`, 72),
      description: requireString(
        node.description,
        `nodes.${index}.description`,
        420,
      ),
      certainty: requireEnum(
        node.certainty,
        EXPERIENCE_CERTAINTIES,
        `nodes.${index}.certainty`,
      ),
      confidence: requireConfidence(
        node.confidence,
        `nodes.${index}.confidence`,
      ),
      salience: requireConfidence(
        node.salience,
        `nodes.${index}.salience`,
      ),
      evidence: requireString(node.evidence, `nodes.${index}.evidence`, 420),
    };
  });

  const keys = new Set(nodes.map((node) => node.key));
  if (keys.size !== nodes.length) {
    throw new Error("Experience graph node keys must be unique.");
  }

  const edgeKeys = new Set<string>();
  const edges = rawEdges.map((value, index): ExperienceGraphEdgeDraft => {
    const edge = requireRecord(value, `edges.${index}`);
    const fromKey = requireSnakeCase(edge.fromKey, `edges.${index}.fromKey`);
    const toKey = requireSnakeCase(edge.toKey, `edges.${index}.toKey`);
    if (!keys.has(fromKey) || !keys.has(toKey)) {
      throw new Error(`Experience graph edge ${index} references an unknown node.`);
    }
    if (fromKey === toKey) {
      throw new Error(`Experience graph edge ${index} cannot connect a node to itself.`);
    }
    const relation = requireEnum(
      edge.relation,
      EXPERIENCE_RELATIONS,
      `edges.${index}.relation`,
    );
    const edgeKey = `${fromKey}:${relation}:${toKey}`;
    if (edgeKeys.has(edgeKey)) {
      throw new Error("Experience graph edges must be unique.");
    }
    edgeKeys.add(edgeKey);

    return {
      fromKey,
      toKey,
      relation,
      description: requireString(
        edge.description,
        `edges.${index}.description`,
        420,
      ),
      polarity: requireEnum(
        edge.polarity,
        EXPERIENCE_POLARITIES,
        `edges.${index}.polarity`,
      ),
      familiarity: requireEnum(
        edge.familiarity,
        EXPERIENCE_FAMILIARITIES,
        `edges.${index}.familiarity`,
      ),
      strength: requireConfidence(edge.strength, `edges.${index}.strength`),
      certainty: requireEnum(
        edge.certainty,
        EXPERIENCE_CERTAINTIES,
        `edges.${index}.certainty`,
      ),
      confidence: requireConfidence(
        edge.confidence,
        `edges.${index}.confidence`,
      ),
      evidence: requireString(edge.evidence, `edges.${index}.evidence`, 420),
    };
  });

  return {
    summary: requireString(graph.summary, "summary", 700),
    nodes,
    edges,
  };
}

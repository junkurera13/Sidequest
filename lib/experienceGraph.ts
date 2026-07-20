export const EXPERIENCE_NODE_KINDS = [
  "person",
  "place",
  "activity",
  "setting",
  "emotion",
  "motif",
  "constraint",
  "context",
  "memory",
] as const;

export const EXPERIENCE_CERTAINTIES = ["fact", "hypothesis"] as const;

export type ExperienceNodeKind = (typeof EXPERIENCE_NODE_KINDS)[number];
export type ExperienceCertainty = (typeof EXPERIENCE_CERTAINTIES)[number];

export type ExperienceGraphNodeDraft = {
  key: string;
  kind: ExperienceNodeKind;
  label: string;
  description: string;
  certainty: ExperienceCertainty;
  confidence: number;
  evidence: string;
};

export type ExperienceGraphEdgeDraft = {
  fromKey: string;
  toKey: string;
  relationship: string;
  description: string;
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

function requireRecord(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Experience graph field "${field}" must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Experience graph field "${field}" must be a non-empty string.`);
  }
  return value.trim();
}

function requireConfidence(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
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

  if (!Array.isArray(rawNodes) || rawNodes.length < 2 || rawNodes.length > MAX_NODES) {
    throw new Error(`Experience graph must include 2-${MAX_NODES} nodes.`);
  }
  if (!Array.isArray(rawEdges) || rawEdges.length > MAX_EDGES) {
    throw new Error(`Experience graph must include no more than ${MAX_EDGES} edges.`);
  }

  const nodes = rawNodes.map((value, index): ExperienceGraphNodeDraft => {
    const node = requireRecord(value, `nodes.${index}`);
    return {
      key: requireString(node.key, `nodes.${index}.key`),
      kind: requireEnum(node.kind, EXPERIENCE_NODE_KINDS, `nodes.${index}.kind`),
      label: requireString(node.label, `nodes.${index}.label`),
      description: requireString(node.description, `nodes.${index}.description`),
      certainty: requireEnum(
        node.certainty,
        EXPERIENCE_CERTAINTIES,
        `nodes.${index}.certainty`,
      ),
      confidence: requireConfidence(node.confidence, `nodes.${index}.confidence`),
      evidence: requireString(node.evidence, `nodes.${index}.evidence`),
    };
  });

  const keys = new Set(nodes.map((node) => node.key));
  if (keys.size !== nodes.length) {
    throw new Error("Experience graph node keys must be unique.");
  }

  const edges = rawEdges.map((value, index): ExperienceGraphEdgeDraft => {
    const edge = requireRecord(value, `edges.${index}`);
    const fromKey = requireString(edge.fromKey, `edges.${index}.fromKey`);
    const toKey = requireString(edge.toKey, `edges.${index}.toKey`);
    if (!keys.has(fromKey) || !keys.has(toKey)) {
      throw new Error(`Experience graph edge ${index} references an unknown node.`);
    }
    return {
      fromKey,
      toKey,
      relationship: requireString(edge.relationship, `edges.${index}.relationship`),
      description: requireString(edge.description, `edges.${index}.description`),
      certainty: requireEnum(
        edge.certainty,
        EXPERIENCE_CERTAINTIES,
        `edges.${index}.certainty`,
      ),
      confidence: requireConfidence(edge.confidence, `edges.${index}.confidence`),
      evidence: requireString(edge.evidence, `edges.${index}.evidence`),
    };
  });

  return {
    summary: requireString(graph.summary, "summary"),
    nodes,
    edges,
  };
}

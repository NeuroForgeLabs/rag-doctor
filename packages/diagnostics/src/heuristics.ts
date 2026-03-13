import type { DiagnosticFinding, Severity } from "@rag-doctor/types";
import type { RootCause } from "./diagnosis-types.js";

/**
 * Maps a rule ID to its root cause category, confidence level, and
 * the set of recommendations to surface when this rule fires.
 *
 * Entries are ordered by priority: higher-severity rules appear first so that
 * the selection loop picks the most actionable primary cause in tie situations.
 */
export interface HeuristicEntry {
  /** The rule ID this heuristic responds to */
  ruleId: string;
  /** Root cause category produced when the rule fires */
  causeId: string;
  /** Human-readable title for the root cause */
  causeTitle: string;
  /**
   * Confidence assigned to this diagnosis.
   * Matches the rule severity: high-severity rules yield high confidence.
   */
  confidence: "low" | "medium" | "high";
  /** Short explanation shown in the diagnosis summary */
  summary: string;
  /** Ordered list of remediation steps */
  recommendations: string[];
}

/**
 * Static heuristic table mapping rule IDs to diagnosis entries.
 *
 * Adding a new rule → diagnosis mapping only requires a new entry here.
 */
export const HEURISTICS: readonly HeuristicEntry[] = [
  {
    ruleId: "low-retrieval-score",
    causeId: "retrieval-quality-degradation",
    causeTitle: "Retrieval Quality Degradation",
    confidence: "high",
    summary:
      "The trace shows weak retrieval relevance signals, suggesting the retriever returned low-value context for the query.",
    recommendations: [
      "Check embedding model quality and ensure it is aligned with your domain",
      "Verify retriever relevance by inspecting returned chunk content",
      "Increase topK carefully and monitor for context overload",
      "Consider adding a reranker to promote the most relevant results",
    ],
  },
  {
    ruleId: "duplicate-chunks",
    causeId: "duplicate-context-pollution",
    causeTitle: "Duplicate Context Pollution",
    confidence: "medium",
    summary:
      "Near-duplicate chunks were retrieved, introducing repeated context that dilutes signal quality.",
    recommendations: [
      "Deduplicate chunks before prompt assembly using MMR or cosine similarity filtering",
      "Revisit chunking overlap strategy to avoid near-identical segments",
      "Reduce repeated retrieval from the same source document",
    ],
  },
  {
    ruleId: "oversized-chunk",
    causeId: "oversized-chunking-strategy",
    causeTitle: "Oversized Chunking Strategy",
    confidence: "low",
    summary:
      "One or more retrieved chunks exceed the recommended size, which can dilute relevance and inflate token usage.",
    recommendations: [
      "Reduce chunk size to 200–500 tokens using a recursive or semantic splitter",
      "Split documents more aggressively while preserving semantic boundaries",
      "Preserve semantic boundaries while shrinking chunks to improve precision",
    ],
  },
  {
    ruleId: "context-overload",
    causeId: "excessive-context-volume",
    causeTitle: "Excessive Context Volume",
    confidence: "medium",
    summary:
      "Too many chunks were included in the context window, increasing noise and reducing answer quality.",
    recommendations: [
      "Reduce topK to limit the number of retrieved chunks",
      "Add a reranker step to filter out low-signal chunks before prompt assembly",
      "Trim low-signal chunks before assembling the final prompt",
    ],
  },
] as const;

/** Numeric weight for severity — used to rank candidates deterministically. */
const SEVERITY_WEIGHT: Record<Severity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** Numeric weight for confidence — used as a tie-breaker. */
const CONFIDENCE_WEIGHT: Record<"low" | "medium" | "high", number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Looks up the heuristic entry for a given rule ID.
 * Returns undefined if no mapping exists.
 */
export function findHeuristic(ruleId: string): HeuristicEntry | undefined {
  return HEURISTICS.find((h) => h.ruleId === ruleId);
}

/**
 * Scores a candidate root cause against the findings that triggered it.
 * Higher scores represent more actionable / severe diagnoses.
 */
export function scoreCause(
  entry: HeuristicEntry,
  triggeringFindings: DiagnosticFinding[],
): number {
  const maxFindingSeverity = triggeringFindings.reduce<number>(
    (max, f) => Math.max(max, SEVERITY_WEIGHT[f.severity]),
    0,
  );
  return maxFindingSeverity * 10 + CONFIDENCE_WEIGHT[entry.confidence];
}

/**
 * Builds a RootCause from a heuristic entry.
 */
export function buildRootCause(entry: HeuristicEntry): RootCause {
  return {
    id: entry.causeId,
    title: entry.causeTitle,
    confidence: entry.confidence,
    summary: entry.summary,
  };
}

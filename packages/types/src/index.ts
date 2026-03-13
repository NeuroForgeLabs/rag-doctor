/**
 * A single chunk retrieved from a vector store or search index.
 */
export interface RetrievedChunk {
  /** Unique identifier for the chunk */
  id: string;
  /** The raw text content of the chunk */
  text: string;
  /** Relevance score returned by the retrieval system (0–1 range typical) */
  score?: number;
  /** Source document or file reference */
  source?: string;
}

/**
 * A normalized representation of a single RAG pipeline execution.
 */
export interface NormalizedTrace {
  /** The original user query */
  query: string;
  /** All chunks retrieved for the query */
  retrievedChunks: RetrievedChunk[];
  /** The final generated answer, if available */
  finalAnswer?: string;
  /** Optional metadata about the trace (model names, timestamps, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Severity levels for diagnostic findings.
 */
export type Severity = "low" | "medium" | "high";

/**
 * A single diagnostic finding produced by a rule.
 */
export interface DiagnosticFinding {
  /** The rule identifier that produced this finding */
  ruleId: string;
  /** Human-readable rule name */
  ruleName: string;
  /** Severity of the finding */
  severity: Severity;
  /** Short description of the issue found */
  message: string;
  /** Actionable recommendation for resolving the issue */
  recommendation?: string;
  /** Optional structured data related to the finding */
  details?: Record<string, unknown>;
}

/**
 * A diagnostic rule that can be run against a NormalizedTrace.
 */
export interface DiagnosticRule {
  /** Unique rule identifier (e.g. "duplicate-chunks") */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Execute the rule and return zero or more findings */
  run(trace: NormalizedTrace): DiagnosticFinding[];
}

/**
 * Summary of finding counts grouped by severity.
 */
export interface SeveritySummary {
  high: number;
  medium: number;
  low: number;
}

/**
 * The complete result returned by the core analysis engine.
 */
export interface AnalysisResult {
  /** All findings produced by all rules */
  findings: DiagnosticFinding[];
  /** Aggregated counts per severity */
  summary: SeveritySummary;
}

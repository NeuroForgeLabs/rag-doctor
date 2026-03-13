import type { Severity } from "@rag-doctor/types";

/**
 * A single identified root cause for RAG pipeline degradation.
 */
export interface RootCause {
  /** Unique identifier for the root cause category */
  id: string;
  /** Human-readable title */
  title: string;
  /** Confidence level of this diagnosis */
  confidence: "low" | "medium" | "high";
  /** Short prose explanation of why this cause was identified */
  summary: string;
}

/**
 * A piece of evidence linking a diagnostic finding to the diagnosis.
 */
export interface DiagnosisEvidence {
  /** The ruleId of the finding that contributed this evidence */
  findingRuleId: string;
  /** The message from the finding */
  findingMessage: string;
  /** The severity of the finding */
  severity: Severity;
}

/**
 * The complete output of the root cause analyzer.
 */
export interface DiagnosisResult {
  /** The single most likely root cause, or null if no findings exist */
  primaryCause: RootCause | null;
  /** Additional causes that contributed to the diagnosis */
  contributingCauses: RootCause[];
  /** The evidence (findings) used to derive the diagnosis */
  evidence: DiagnosisEvidence[];
  /** Concrete, actionable recommendations for the user */
  recommendations: string[];
}

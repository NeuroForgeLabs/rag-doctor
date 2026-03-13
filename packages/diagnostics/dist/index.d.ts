import { Severity, AnalysisResult } from '@rag-doctor/types';

/**
 * A single identified root cause for RAG pipeline degradation.
 */
interface RootCause {
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
interface DiagnosisEvidence {
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
interface DiagnosisResult {
    /** The single most likely root cause, or null if no findings exist */
    primaryCause: RootCause | null;
    /** Additional causes that contributed to the diagnosis */
    contributingCauses: RootCause[];
    /** The evidence (findings) used to derive the diagnosis */
    evidence: DiagnosisEvidence[];
    /** Concrete, actionable recommendations for the user */
    recommendations: string[];
}

/**
 * Analyzes an AnalysisResult and infers the most likely root cause(s).
 *
 * The analyzer is intentionally pure: it has no I/O, no side effects, and
 * returns a stable result for the same input. It can be safely embedded in
 * any environment.
 *
 * Algorithm:
 * 1. Collect all findings that have a matching heuristic entry.
 * 2. Group matched findings by their cause ID.
 * 3. Score each candidate cause deterministically (severity × confidence).
 * 4. Sort descending by score; highest score becomes primaryCause.
 * 5. Remaining candidates become contributingCauses.
 * 6. Merge all unique recommendations across all matched causes.
 *
 * @example
 * ```ts
 * import { analyzeTrace } from "@rag-doctor/core";
 * import { diagnoseTrace } from "@rag-doctor/diagnostics";
 *
 * const analysisResult = analyzeTrace(normalizedTrace);
 * const diagnosis = diagnoseTrace(analysisResult);
 * console.log(diagnosis.primaryCause?.title);
 * ```
 */
declare function diagnoseTrace(analysisResult: AnalysisResult): DiagnosisResult;

export { type DiagnosisEvidence, type DiagnosisResult, type RootCause, diagnoseTrace };

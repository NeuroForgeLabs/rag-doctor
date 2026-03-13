import { DiagnosticRule, NormalizedTrace, AnalysisResult } from '@rag-doctor/types';
export { AnalysisResult, DiagnosticFinding, DiagnosticRule, NormalizedTrace, RetrievedChunk, Severity, SeveritySummary } from '@rag-doctor/types';

interface AnalyzeOptions {
    /**
     * Override the rule set used for analysis.
     * Defaults to all built-in rules from @rag-doctor/rules.
     */
    rules?: DiagnosticRule[];
    /**
     * When true, suppresses internal console output for embedded / library usage.
     * @default false
     */
    silent?: boolean;
}
/**
 * Runs all diagnostic rules against a normalized trace and aggregates findings.
 *
 * The engine is intentionally free of any CLI, file-system, or I/O concerns.
 * It is safe to use in VS Code extensions, API services, or GitHub Actions.
 *
 * @example
 * ```ts
 * import { analyzeTrace } from "@rag-doctor/core";
 * import { normalizeTrace } from "@rag-doctor/parser";
 *
 * const trace = normalizeTrace(rawJson);
 * const result = analyzeTrace(trace);
 * console.log(result.summary);
 * ```
 */
declare function analyzeTrace(trace: NormalizedTrace, options?: AnalyzeOptions): AnalysisResult;

export { type AnalyzeOptions, analyzeTrace };

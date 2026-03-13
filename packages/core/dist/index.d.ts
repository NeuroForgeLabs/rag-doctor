import { DiagnosticRule, RuleOptions, NormalizedTrace, AnalysisResult } from '@rag-doctor/types';
export { AnalysisResult, DiagnosticFinding, DiagnosticRule, NormalizedTrace, ResolvedAnalysisConfig, RetrievedChunk, RuleOptions, RulePack, Severity, SeveritySummary } from '@rag-doctor/types';
export { RuleConfigurationError } from '@rag-doctor/rules';

interface AnalyzeOptions {
    /**
     * Explicit rule set to run. When provided, `packs` and `ruleOptions` are ignored.
     * Preserves existing behavior from Phase 1/2.
     */
    rules?: DiagnosticRule[];
    /**
     * One or more named rule packs to resolve and run.
     * Built-in packs: "recommended", "strict".
     * When multiple packs are provided, rules are concatenated in order.
     * Ignored when `rules` is explicitly provided.
     */
    packs?: string[];
    /**
     * Per-rule option overrides applied when resolving packs.
     * Keys are rule IDs; values are partial options for that rule.
     * Ignored when `rules` is explicitly provided.
     *
     * @example
     * ```ts
     * analyzeTrace(trace, {
     *   packs: ["recommended"],
     *   ruleOptions: {
     *     "low-retrieval-score": { averageScoreThreshold: 0.6 },
     *     "context-overload": { maxChunkCount: 8 },
     *   },
     * });
     * ```
     */
    ruleOptions?: RuleOptions;
    /**
     * When true, suppresses internal console output for embedded / library usage.
     * @default false
     */
    silent?: boolean;
}
/**
 * Resolves an AnalyzeOptions object into a concrete list of rules to run.
 *
 * Resolution priority:
 * 1. `rules` — explicit list; used as-is, packs/ruleOptions ignored
 * 2. `packs` — named packs resolved (with ruleOptions applied); concatenated
 * 3. (neither) — defaultRules
 *
 * @throws {UnknownPackError} when a pack name is not recognized
 */
declare function resolveRules(options: AnalyzeOptions): DiagnosticRule[];
/**
 * Thrown when an unknown pack name is referenced in AnalyzeOptions.packs.
 */
declare class UnknownPackError extends Error {
    readonly code: "UNKNOWN_PACK_ERROR";
    readonly packName: string;
    constructor(packName: string);
}
/**
 * Runs all diagnostic rules against a normalized trace and aggregates findings.
 *
 * The engine is intentionally free of any CLI, file-system, or I/O concerns.
 * It is safe to use in VS Code extensions, API services, or GitHub Actions.
 *
 * Resolution behavior:
 * - `options.rules` provided → run those rules directly (backward-compatible)
 * - `options.packs` provided → resolve named packs, apply `ruleOptions` overrides
 * - neither → run defaultRules
 *
 * @throws {UnknownPackError} when a referenced pack name does not exist
 * @throws {RuleConfigurationError} when a rule option fails validation
 *
 * @example
 * ```ts
 * // Default behavior (backward compatible)
 * const result = analyzeTrace(trace);
 *
 * // With a named pack
 * const result = analyzeTrace(trace, { packs: ["recommended"] });
 *
 * // With per-rule overrides
 * const result = analyzeTrace(trace, {
 *   packs: ["recommended"],
 *   ruleOptions: { "low-retrieval-score": { averageScoreThreshold: 0.6 } },
 * });
 * ```
 */
declare function analyzeTrace(trace: NormalizedTrace, options?: AnalyzeOptions): AnalysisResult;

export { type AnalyzeOptions, UnknownPackError, analyzeTrace, resolveRules };

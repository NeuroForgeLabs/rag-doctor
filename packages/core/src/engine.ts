import type {
  AnalysisResult,
  DiagnosticFinding,
  DiagnosticRule,
  NormalizedTrace,
  RuleOptions,
  Severity,
  SeveritySummary,
} from "@rag-doctor/types";
import { defaultRules, BUILT_IN_PACKS } from "@rag-doctor/rules";

export interface AnalyzeOptions {
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
export function resolveRules(options: AnalyzeOptions): DiagnosticRule[] {
  if (options.rules !== undefined) {
    return options.rules;
  }

  if (options.packs !== undefined && options.packs.length > 0) {
    const resolved: DiagnosticRule[] = [];
    for (const packName of options.packs) {
      const pack = BUILT_IN_PACKS[packName];
      if (!pack) {
        throw new UnknownPackError(packName);
      }
      resolved.push(...pack.resolve(options.ruleOptions));
    }
    return resolved;
  }

  // Default: use defaultRules (ignores ruleOptions when no pack is specified)
  return defaultRules;
}

/**
 * Thrown when an unknown pack name is referenced in AnalyzeOptions.packs.
 */
export class UnknownPackError extends Error {
  public readonly code = "UNKNOWN_PACK_ERROR" as const;
  public readonly packName: string;

  constructor(packName: string) {
    const available = Object.keys(BUILT_IN_PACKS).join(", ");
    super(
      `Unknown rule pack "${packName}". Available built-in packs: ${available}`,
    );
    this.name = "UnknownPackError";
    this.packName = packName;
  }
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
export function analyzeTrace(
  trace: NormalizedTrace,
  options: AnalyzeOptions = {},
): AnalysisResult {
  const rules = resolveRules(options);

  const findings: DiagnosticFinding[] = [];

  for (const rule of rules) {
    const ruleFindings = rule.run(trace);
    findings.push(...ruleFindings);
  }

  const summary = computeSummary(findings);

  return { findings, summary };
}

/**
 * Computes a severity breakdown from an array of findings.
 */
function computeSummary(findings: DiagnosticFinding[]): SeveritySummary {
  const tally: Record<Severity, number> = { high: 0, medium: 0, low: 0 };

  for (const finding of findings) {
    tally[finding.severity] += 1;
  }

  return tally;
}

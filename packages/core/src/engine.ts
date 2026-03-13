import type {
  AnalysisResult,
  DiagnosticFinding,
  DiagnosticRule,
  NormalizedTrace,
  Severity,
  SeveritySummary,
} from "@rag-doctor/types";
import { defaultRules } from "@rag-doctor/rules";

export interface AnalyzeOptions {
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
export function analyzeTrace(
  trace: NormalizedTrace,
  options: AnalyzeOptions = {},
): AnalysisResult {
  const rules = options.rules ?? defaultRules;

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

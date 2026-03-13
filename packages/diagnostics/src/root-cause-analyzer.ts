import type { AnalysisResult, DiagnosticFinding } from "@rag-doctor/types";
import type { DiagnosisResult, DiagnosisEvidence } from "./diagnosis-types.js";
import { findHeuristic, scoreCause, buildRootCause } from "./heuristics.js";
import type { HeuristicEntry } from "./heuristics.js";

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
export function diagnoseTrace(analysisResult: AnalysisResult): DiagnosisResult {
  const { findings } = analysisResult;

  if (findings.length === 0) {
    return {
      primaryCause: null,
      contributingCauses: [],
      evidence: [],
      recommendations: [],
    };
  }

  // Build evidence list from all findings (matched or not).
  const evidence: DiagnosisEvidence[] = findings.map((f) => ({
    findingRuleId: f.ruleId,
    findingMessage: f.message,
    severity: f.severity,
  }));

  // Build a map from causeId → { entry, triggeringFindings }
  const causeMap = new Map<
    string,
    { entry: HeuristicEntry; triggeringFindings: DiagnosticFinding[] }
  >();

  for (const finding of findings) {
    const entry = findHeuristic(finding.ruleId);
    if (!entry) continue;

    const existing = causeMap.get(entry.causeId);
    if (existing) {
      existing.triggeringFindings.push(finding);
    } else {
      causeMap.set(entry.causeId, {
        entry,
        triggeringFindings: [finding],
      });
    }
  }

  if (causeMap.size === 0) {
    // Findings exist but none mapped to known heuristics.
    return {
      primaryCause: null,
      contributingCauses: [],
      evidence,
      recommendations: [],
    };
  }

  // Score and sort all candidates, highest first. Sort is stable (consistent
  // with insertion order) for equal scores, keeping output deterministic.
  const candidates = [...causeMap.values()].sort(
    (a, b) =>
      scoreCause(b.entry, b.triggeringFindings) -
      scoreCause(a.entry, a.triggeringFindings),
  );

  // causeMap.size > 0, so candidates is non-empty. The guard above ensures
  // this array has at least one element.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const primaryCandidate = candidates[0]!;
  const rest = candidates.slice(1);

  const primaryCause = buildRootCause(primaryCandidate.entry);
  const contributingCauses = rest.map((c) => buildRootCause(c.entry));

  // Merge recommendations: primary cause first, then contributing causes,
  // deduplicating by exact string match while preserving order.
  const seen = new Set<string>();
  const recommendations: string[] = [];

  for (const candidate of candidates) {
    for (const rec of candidate.entry.recommendations) {
      if (!seen.has(rec)) {
        seen.add(rec);
        recommendations.push(rec);
      }
    }
  }

  return {
    primaryCause,
    contributingCauses,
    evidence,
    recommendations,
  };
}

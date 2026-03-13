import type { DiagnosisResult, RootCause } from "@rag-doctor/diagnostics";
import { bold, cyan, dim, green, red, yellow } from "./ansi.js";

export interface DiagnosisReportOptions {
  /**
   * Custom write function for output. Defaults to process.stdout.write.
   * Override this in tests to capture output.
   */
  write?: (line: string) => void;
}

/**
 * Maps confidence to a colored label string.
 */
function colorConfidence(confidence: RootCause["confidence"]): string {
  switch (confidence) {
    case "high":
      return red("[HIGH CONFIDENCE]");
    case "medium":
      return yellow("[MEDIUM CONFIDENCE]");
    case "low":
      return green("[LOW CONFIDENCE]");
  }
}

/**
 * Renders a single root cause block (used for both primary and contributing).
 */
function formatCause(cause: RootCause, label: string, write: (line: string) => void): void {
  write(`${bold(label)}`);
  write(`  ${colorConfidence(cause.confidence)} ${bold(cause.title)}`);
  write("");
  write(`  ${cause.summary}`);
  write("");
}

/**
 * Prints a human-readable diagnosis report to the terminal.
 *
 * This function is intentionally pure — it accepts a write function so it
 * can be used in non-terminal environments (e.g. capturing output in tests).
 *
 * @example
 * ```ts
 * const analysisResult = analyzeTrace(trace);
 * const diagnosis = diagnoseTrace(analysisResult);
 * printDiagnosisReport(diagnosis);
 * ```
 */
export function printDiagnosisReport(
  result: DiagnosisResult,
  options: DiagnosisReportOptions = {},
): void {
  const write = options.write ?? ((line: string) => process.stdout.write(line + "\n"));

  write("");
  write(bold(cyan("  RAG Doctor Diagnosis  ")));
  write("─".repeat(50));
  write("");

  if (!result.primaryCause) {
    write(green("  ✓ No root cause identified. Your RAG pipeline looks healthy!"));
    write("");
    return;
  }

  // Primary root cause
  formatCause(result.primaryCause, "Primary root cause:", write);

  // Contributing causes
  if (result.contributingCauses.length > 0) {
    write(bold("Contributing causes:"));
    write("");
    for (const cause of result.contributingCauses) {
      write(`  ${colorConfidence(cause.confidence)} ${bold(cause.title)}`);
      write(`  ${dim("→")} ${cause.summary}`);
      write("");
    }
  }

  // Evidence
  if (result.evidence.length > 0) {
    write("─".repeat(50));
    write("");
    write(bold("Evidence:"));
    write("");
    for (const ev of result.evidence) {
      const severityLabel =
        ev.severity === "high" ? red("[HIGH]")
        : ev.severity === "medium" ? yellow("[MEDIUM]")
        : green("[LOW]");
      write(`  ${severityLabel} ${ev.findingMessage}`);
    }
    write("");
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    write("─".repeat(50));
    write("");
    write(bold("Recommendations:"));
    write("");
    for (const rec of result.recommendations) {
      write(`  ${dim("→")} ${rec}`);
    }
    write("");
  }
}

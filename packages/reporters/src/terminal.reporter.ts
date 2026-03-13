import type { AnalysisResult, DiagnosticFinding, Severity } from "@rag-doctor/types";
import { bold, cyan, dim, green, red, yellow } from "./ansi.js";

const SEVERITY_LABELS: Record<Severity, string> = {
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

/**
 * Colorizes a severity label for terminal output.
 */
function colorSeverity(severity: Severity): string {
  switch (severity) {
    case "high":
      return red(`[${SEVERITY_LABELS.high}]`);
    case "medium":
      return yellow(`[${SEVERITY_LABELS.medium}]`);
    case "low":
      return green(`[${SEVERITY_LABELS.low}]`);
  }
}

/**
 * Formats a single finding into terminal-friendly lines.
 */
function formatFinding(finding: DiagnosticFinding): string {
  const lines: string[] = [];
  lines.push(`${colorSeverity(finding.severity)} ${bold(finding.message)}`);
  if (finding.recommendation) {
    lines.push(`  ${dim("→")} ${finding.recommendation}`);
  }
  return lines.join("\n");
}

/**
 * Renders the severity summary banner.
 */
function formatSummary(result: AnalysisResult): string {
  const { high, medium, low } = result.summary;
  const total = high + medium + low;

  const lines: string[] = [
    bold(cyan("  RAG Doctor Report  ")),
    "─".repeat(50),
    "",
    `  ${bold("Total findings:")}  ${total}`,
    `  ${red("High")}:            ${high}`,
    `  ${yellow("Medium")}:          ${medium}`,
    `  ${green("Low")}:             ${low}`,
    "",
    "─".repeat(50),
  ];

  return lines.join("\n");
}

export interface TerminalReportOptions {
  /**
   * Custom write function for output. Defaults to process.stdout.write.
   * Override this in tests to capture output.
   */
  write?: (line: string) => void;
}

/**
 * Prints a human-readable diagnostic report to the terminal.
 *
 * This function is intentionally pure — it accepts a write function so it
 * can be used in non-terminal environments (e.g. capturing output in tests).
 *
 * @example
 * ```ts
 * const result = analyzeTrace(trace);
 * printTerminalReport(result);
 * ```
 */
export function printTerminalReport(
  result: AnalysisResult,
  options: TerminalReportOptions = {},
): void {
  const write = options.write ?? ((line: string) => process.stdout.write(line + "\n"));

  write("");
  write(formatSummary(result));
  write("");

  if (result.findings.length === 0) {
    write(green("  ✓ No issues detected. Your RAG pipeline looks healthy!"));
    write("");
    return;
  }

  write(bold("  Findings:"));
  write("");

  const sorted = [...result.findings].sort((a, b) => {
    const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  for (const finding of sorted) {
    write("  " + formatFinding(finding).replace(/\n/g, "\n  "));
    write("");
  }
}

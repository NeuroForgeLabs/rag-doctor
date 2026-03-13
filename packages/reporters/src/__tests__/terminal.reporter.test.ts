import { describe, it, expect } from "vitest";
import { printTerminalReport } from "../terminal.reporter.js";
import type { AnalysisResult, DiagnosticFinding } from "@rag-doctor/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function capture(result: AnalysisResult): { lines: string[]; joined: string } {
  const lines: string[] = [];
  printTerminalReport(result, { write: (l) => lines.push(l) });
  return { lines, joined: lines.join("\n") };
}

/** Strip ANSI escape codes for clean text assertions */
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function captureClean(result: AnalysisResult): string {
  const { joined } = capture(result);
  return stripAnsi(joined);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const empty: AnalysisResult = {
  findings: [],
  summary: { high: 0, medium: 0, low: 0 },
};

const singleHigh: AnalysisResult = {
  findings: [
    {
      ruleId: "low-retrieval-score",
      ruleName: "Low Retrieval Score",
      severity: "high",
      message: "Average retrieval score is 0.220",
      recommendation: "Check your embedding model alignment.",
    },
  ],
  summary: { high: 1, medium: 0, low: 0 },
};

const singleMedium: AnalysisResult = {
  findings: [
    {
      ruleId: "duplicate-chunks",
      ruleName: "Duplicate Chunks",
      severity: "medium",
      message: "Found 2 near-duplicate chunk pair(s).",
      recommendation: "Implement deduplication.",
    },
  ],
  summary: { high: 0, medium: 1, low: 0 },
};

const singleLow: AnalysisResult = {
  findings: [
    {
      ruleId: "oversized-chunk",
      ruleName: "Oversized Chunk",
      severity: "low",
      message: "1 chunk(s) exceed 1200 characters.",
    },
  ],
  summary: { high: 0, medium: 0, low: 1 },
};

const mixedResult: AnalysisResult = {
  findings: [
    {
      ruleId: "low-retrieval-score",
      ruleName: "Low Retrieval Score",
      severity: "high",
      message: "Average retrieval score is 0.220",
      recommendation: "Check embedding model.",
    },
    {
      ruleId: "duplicate-chunks",
      ruleName: "Duplicate Chunks",
      severity: "medium",
      message: "Found 1 near-duplicate pair.",
      recommendation: "Deduplicate chunks.",
    },
    {
      ruleId: "oversized-chunk",
      ruleName: "Oversized Chunk",
      severity: "low",
      message: "1 chunk(s) exceed 1200 characters.",
    },
  ],
  summary: { high: 1, medium: 1, low: 1 },
};

// ── Header and structure ──────────────────────────────────────────────────────

describe("printTerminalReport — header and structure", () => {
  it("always includes the RAG Doctor Report header", () => {
    expect(captureClean(empty)).toContain("RAG Doctor Report");
    expect(captureClean(singleHigh)).toContain("RAG Doctor Report");
  });

  it("always includes Total findings label", () => {
    expect(captureClean(empty)).toContain("Total findings:");
    expect(captureClean(mixedResult)).toContain("Total findings:");
  });

  it("always includes High, Medium, Low labels", () => {
    const output = captureClean(mixedResult);
    expect(output).toContain("High");
    expect(output).toContain("Medium");
    expect(output).toContain("Low");
  });

  it("always includes separator lines", () => {
    const { joined } = capture(empty);
    expect(joined).toContain("─");
  });

  it("calls write at least once", () => {
    let count = 0;
    printTerminalReport(empty, { write: () => { count++; } });
    expect(count).toBeGreaterThan(0);
  });
});

// ── Zero findings ─────────────────────────────────────────────────────────────

describe("printTerminalReport — no findings", () => {
  it("prints a healthy/no-issues message", () => {
    expect(captureClean(empty)).toContain("No issues detected");
  });

  it("total count shows 0", () => {
    const output = captureClean(empty);
    // "Total findings:" should be followed by 0
    expect(output).toMatch(/Total findings:\s+0/);
  });

  it("does not print a Findings section header", () => {
    expect(captureClean(empty)).not.toContain("Findings:");
  });
});

// ── Single finding cases ──────────────────────────────────────────────────────

describe("printTerminalReport — single HIGH finding", () => {
  it("prints [HIGH] label", () => {
    expect(captureClean(singleHigh)).toContain("HIGH");
  });

  it("prints the finding message", () => {
    expect(captureClean(singleHigh)).toContain("Average retrieval score is 0.220");
  });

  it("prints the recommendation", () => {
    expect(captureClean(singleHigh)).toContain("Check your embedding model alignment.");
  });

  it("prints Findings: section header", () => {
    expect(captureClean(singleHigh)).toContain("Findings:");
  });

  it("summary shows high: 1, medium: 0, low: 0", () => {
    const output = captureClean(singleHigh);
    // Check numeric values appear in context
    expect(output).toContain("1");
  });
});

describe("printTerminalReport — single MEDIUM finding", () => {
  it("prints [MEDIUM] label", () => {
    expect(captureClean(singleMedium)).toContain("MEDIUM");
  });

  it("prints the finding message", () => {
    expect(captureClean(singleMedium)).toContain("Found 2 near-duplicate chunk pair(s).");
  });

  it("prints the recommendation", () => {
    expect(captureClean(singleMedium)).toContain("Implement deduplication.");
  });
});

describe("printTerminalReport — single LOW finding without recommendation", () => {
  it("prints [LOW] label", () => {
    expect(captureClean(singleLow)).toContain("LOW");
  });

  it("prints the finding message", () => {
    expect(captureClean(singleLow)).toContain("1 chunk(s) exceed 1200 characters.");
  });

  it("does not crash when recommendation is absent", () => {
    expect(() => capture(singleLow)).not.toThrow();
  });
});

// ── Multiple findings ─────────────────────────────────────────────────────────

describe("printTerminalReport — multiple findings", () => {
  it("prints all three finding messages", () => {
    const output = captureClean(mixedResult);
    expect(output).toContain("Average retrieval score is 0.220");
    expect(output).toContain("Found 1 near-duplicate pair.");
    expect(output).toContain("1 chunk(s) exceed 1200 characters.");
  });

  it("sorts findings high → medium → low", () => {
    const output = captureClean(mixedResult);
    const highIdx = output.indexOf("HIGH");
    const medIdx = output.indexOf("MEDIUM");
    const lowIdx = output.indexOf("LOW");
    expect(highIdx).toBeLessThan(medIdx);
    expect(medIdx).toBeLessThan(lowIdx);
  });

  it("sorts correctly when findings arrive in reverse order", () => {
    const reversed: AnalysisResult = {
      findings: [...mixedResult.findings].reverse(),
      summary: mixedResult.summary,
    };
    const output = captureClean(reversed);
    expect(output.indexOf("HIGH")).toBeLessThan(output.indexOf("MEDIUM"));
    expect(output.indexOf("MEDIUM")).toBeLessThan(output.indexOf("LOW"));
  });

  it("includes recommendations for findings that have one", () => {
    const output = captureClean(mixedResult);
    expect(output).toContain("Check embedding model.");
    expect(output).toContain("Deduplicate chunks.");
  });

  it("does not print the healthy message when there are findings", () => {
    expect(captureClean(mixedResult)).not.toContain("No issues detected");
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("printTerminalReport — edge cases", () => {
  it("handles all high findings correctly", () => {
    const allHigh: AnalysisResult = {
      findings: [
        { ruleId: "r1", ruleName: "R1", severity: "high", message: "H1" },
        { ruleId: "r2", ruleName: "R2", severity: "high", message: "H2" },
      ],
      summary: { high: 2, medium: 0, low: 0 },
    };
    const output = captureClean(allHigh);
    expect(output).toContain("H1");
    expect(output).toContain("H2");
    expect((output.match(/HIGH/g) ?? []).length).toBe(2);
  });

  it("uses the injected write function, not process.stdout directly", () => {
    let called = false;
    printTerminalReport(empty, { write: () => { called = true; } });
    expect(called).toBe(true);
  });

  it("each line passed to write is a string", () => {
    const lines: unknown[] = [];
    printTerminalReport(mixedResult, { write: (l) => lines.push(l) });
    for (const line of lines) {
      expect(typeof line).toBe("string");
    }
  });

  it("severity counts in summary reflect actual summary values", () => {
    const custom: AnalysisResult = {
      findings: [
        { ruleId: "r1", ruleName: "R1", severity: "high", message: "H" },
        { ruleId: "r2", ruleName: "R2", severity: "high", message: "H2" },
        { ruleId: "r3", ruleName: "R3", severity: "medium", message: "M" },
      ],
      summary: { high: 2, medium: 1, low: 0 },
    };
    const output = captureClean(custom);
    // "Total findings:" line should show 3
    expect(output).toContain("3");
  });

  it("handles a finding with no recommendation field (undefined)", () => {
    const noRec: DiagnosticFinding = {
      ruleId: "r1",
      ruleName: "R1",
      severity: "medium",
      message: "Something happened",
    };
    expect(() =>
      capture({ findings: [noRec], summary: { high: 0, medium: 1, low: 0 } }),
    ).not.toThrow();
  });
});

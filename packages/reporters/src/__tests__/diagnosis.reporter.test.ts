import { describe, it, expect } from "vitest";
import { printDiagnosisReport } from "../diagnosis.reporter.js";
import type { DiagnosisResult, RootCause } from "@rag-doctor/diagnostics";

// ── Helpers ───────────────────────────────────────────────────────────────────

function capture(result: DiagnosisResult): { lines: string[]; joined: string } {
  const lines: string[] = [];
  printDiagnosisReport(result, { write: (l) => lines.push(l) });
  return { lines, joined: lines.join("\n") };
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function captureClean(result: DiagnosisResult): string {
  return stripAnsi(capture(result).joined);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const noDiagnosis: DiagnosisResult = {
  primaryCause: null,
  contributingCauses: [],
  evidence: [],
  recommendations: [],
};

const primaryCause: RootCause = {
  id: "retrieval-quality-degradation",
  title: "Retrieval Quality Degradation",
  confidence: "high",
  summary: "The trace shows weak retrieval relevance signals.",
};

const singleDiagnosis: DiagnosisResult = {
  primaryCause,
  contributingCauses: [],
  evidence: [
    {
      findingRuleId: "low-retrieval-score",
      findingMessage: "Average retrieval score is 0.22",
      severity: "high",
    },
  ],
  recommendations: [
    "Check embedding model quality",
    "Consider adding a reranker",
  ],
};

const fullDiagnosis: DiagnosisResult = {
  primaryCause,
  contributingCauses: [
    {
      id: "duplicate-context-pollution",
      title: "Duplicate Context Pollution",
      confidence: "medium",
      summary: "Near-duplicate chunks were retrieved.",
    },
  ],
  evidence: [
    {
      findingRuleId: "low-retrieval-score",
      findingMessage: "Average retrieval score is 0.22",
      severity: "high",
    },
    {
      findingRuleId: "duplicate-chunks",
      findingMessage: "Found 2 near-duplicate pair(s).",
      severity: "medium",
    },
  ],
  recommendations: [
    "Check embedding model quality",
    "Consider adding a reranker",
    "Deduplicate chunks before prompt assembly",
  ],
};

// ── Header ────────────────────────────────────────────────────────────────────

describe("printDiagnosisReport — header", () => {
  it("always includes RAG Doctor Diagnosis title", () => {
    expect(captureClean(noDiagnosis)).toContain("RAG Doctor Diagnosis");
    expect(captureClean(singleDiagnosis)).toContain("RAG Doctor Diagnosis");
  });

  it("always includes a separator line", () => {
    const { joined } = capture(singleDiagnosis);
    expect(joined).toContain("─");
  });

  it("uses the injected write function", () => {
    let called = false;
    printDiagnosisReport(noDiagnosis, { write: () => { called = true; } });
    expect(called).toBe(true);
  });

  it("each line passed to write is a string", () => {
    const lines: unknown[] = [];
    printDiagnosisReport(fullDiagnosis, { write: (l) => lines.push(l) });
    for (const line of lines) {
      expect(typeof line).toBe("string");
    }
  });
});

// ── No diagnosis ──────────────────────────────────────────────────────────────

describe("printDiagnosisReport — no diagnosis (healthy)", () => {
  it("prints a healthy/no-cause message", () => {
    expect(captureClean(noDiagnosis)).toContain("No root cause identified");
  });

  it("does not include Primary root cause section", () => {
    expect(captureClean(noDiagnosis)).not.toContain("Primary root cause");
  });

  it("does not crash", () => {
    expect(() => capture(noDiagnosis)).not.toThrow();
  });
});

// ── Primary cause ─────────────────────────────────────────────────────────────

describe("printDiagnosisReport — primary cause", () => {
  it("prints Primary root cause label", () => {
    expect(captureClean(singleDiagnosis)).toContain("Primary root cause");
  });

  it("prints the cause title", () => {
    expect(captureClean(singleDiagnosis)).toContain("Retrieval Quality Degradation");
  });

  it("prints HIGH CONFIDENCE for high-confidence cause", () => {
    expect(captureClean(singleDiagnosis)).toContain("HIGH CONFIDENCE");
  });

  it("prints the cause summary", () => {
    expect(captureClean(singleDiagnosis)).toContain("weak retrieval relevance signals");
  });

  it("prints MEDIUM CONFIDENCE for medium-confidence cause", () => {
    const medium: DiagnosisResult = {
      primaryCause: {
        id: "duplicate-context-pollution",
        title: "Duplicate Context Pollution",
        confidence: "medium",
        summary: "Near-duplicate chunks.",
      },
      contributingCauses: [],
      evidence: [],
      recommendations: [],
    };
    expect(captureClean(medium)).toContain("MEDIUM CONFIDENCE");
  });

  it("prints LOW CONFIDENCE for low-confidence cause", () => {
    const low: DiagnosisResult = {
      primaryCause: {
        id: "oversized-chunking-strategy",
        title: "Oversized Chunking Strategy",
        confidence: "low",
        summary: "Chunks are too large.",
      },
      contributingCauses: [],
      evidence: [],
      recommendations: [],
    };
    expect(captureClean(low)).toContain("LOW CONFIDENCE");
  });
});

// ── Recommendations ────────────────────────────────────────────────────────────

describe("printDiagnosisReport — recommendations", () => {
  it("prints Recommendations section header", () => {
    expect(captureClean(singleDiagnosis)).toContain("Recommendations");
  });

  it("prints all recommendation items", () => {
    const output = captureClean(singleDiagnosis);
    expect(output).toContain("Check embedding model quality");
    expect(output).toContain("Consider adding a reranker");
  });

  it("does not print Recommendations section when list is empty", () => {
    const noRecs: DiagnosisResult = {
      primaryCause,
      contributingCauses: [],
      evidence: [],
      recommendations: [],
    };
    expect(captureClean(noRecs)).not.toContain("Recommendations:");
  });
});

// ── Evidence ──────────────────────────────────────────────────────────────────

describe("printDiagnosisReport — evidence", () => {
  it("prints Evidence section header", () => {
    expect(captureClean(singleDiagnosis)).toContain("Evidence");
  });

  it("prints finding messages", () => {
    expect(captureClean(singleDiagnosis)).toContain("Average retrieval score is 0.22");
  });

  it("prints severity labels", () => {
    expect(captureClean(fullDiagnosis)).toContain("HIGH");
    expect(captureClean(fullDiagnosis)).toContain("MEDIUM");
  });

  it("does not print Evidence section when empty", () => {
    const noEvidence: DiagnosisResult = {
      primaryCause,
      contributingCauses: [],
      evidence: [],
      recommendations: [],
    };
    expect(captureClean(noEvidence)).not.toContain("Evidence:");
  });
});

// ── Contributing causes ───────────────────────────────────────────────────────

describe("printDiagnosisReport — contributing causes", () => {
  it("prints Contributing causes section when present", () => {
    expect(captureClean(fullDiagnosis)).toContain("Contributing causes");
  });

  it("prints contributing cause title", () => {
    expect(captureClean(fullDiagnosis)).toContain("Duplicate Context Pollution");
  });

  it("does not print Contributing causes when none exist", () => {
    expect(captureClean(singleDiagnosis)).not.toContain("Contributing causes");
  });
});

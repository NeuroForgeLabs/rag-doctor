import { describe, it, expect } from "vitest";
import { diagnoseTrace } from "../root-cause-analyzer.js";
import type { AnalysisResult, DiagnosticFinding } from "@rag-doctor/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeResult(findings: DiagnosticFinding[]): AnalysisResult {
  const summary = { high: 0, medium: 0, low: 0 };
  for (const f of findings) summary[f.severity]++;
  return { findings, summary };
}

// ── Single-rule firing ────────────────────────────────────────────────────────

describe("diagnoseTrace — low-retrieval-score → retrieval-quality-degradation", () => {
  const result = diagnoseTrace(
    makeResult([
      {
        ruleId: "low-retrieval-score",
        ruleName: "Low Retrieval Score",
        severity: "high",
        message: "Average retrieval score is 0.22",
        recommendation: "Use a better embedding model.",
      },
    ]),
  );

  it("sets primaryCause.id to retrieval-quality-degradation", () => {
    expect(result.primaryCause?.id).toBe("retrieval-quality-degradation");
  });

  it("sets primaryCause.confidence to high", () => {
    expect(result.primaryCause?.confidence).toBe("high");
  });

  it("has no contributing causes", () => {
    expect(result.contributingCauses).toHaveLength(0);
  });

  it("includes relevant recommendations", () => {
    const recs = result.recommendations.join("\n");
    expect(recs).toContain("embedding model");
    expect(recs).toContain("reranker");
  });

  it("evidence contains the low-retrieval-score finding", () => {
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]?.findingRuleId).toBe("low-retrieval-score");
    expect(result.evidence[0]?.severity).toBe("high");
  });
});

describe("diagnoseTrace — duplicate-chunks → duplicate-context-pollution", () => {
  const result = diagnoseTrace(
    makeResult([
      {
        ruleId: "duplicate-chunks",
        ruleName: "Duplicate Chunks",
        severity: "medium",
        message: "Found 3 near-duplicate chunk pair(s).",
        recommendation: "Deduplicate.",
      },
    ]),
  );

  it("sets primaryCause.id to duplicate-context-pollution", () => {
    expect(result.primaryCause?.id).toBe("duplicate-context-pollution");
  });

  it("sets primaryCause.confidence to medium", () => {
    expect(result.primaryCause?.confidence).toBe("medium");
  });

  it("includes deduplication recommendations", () => {
    const recs = result.recommendations.join("\n");
    expect(recs).toContain("Deduplicate");
  });

  it("has no contributing causes", () => {
    expect(result.contributingCauses).toHaveLength(0);
  });
});

describe("diagnoseTrace — oversized-chunk → oversized-chunking-strategy", () => {
  const result = diagnoseTrace(
    makeResult([
      {
        ruleId: "oversized-chunk",
        ruleName: "Oversized Chunk",
        severity: "low",
        message: "2 chunk(s) exceed 1200 characters.",
      },
    ]),
  );

  it("sets primaryCause.id to oversized-chunking-strategy", () => {
    expect(result.primaryCause?.id).toBe("oversized-chunking-strategy");
  });

  it("sets primaryCause.confidence to low", () => {
    expect(result.primaryCause?.confidence).toBe("low");
  });

  it("includes chunk-size recommendations", () => {
    const recs = result.recommendations.join("\n");
    expect(recs).toContain("chunk size");
  });
});

describe("diagnoseTrace — context-overload → excessive-context-volume", () => {
  const result = diagnoseTrace(
    makeResult([
      {
        ruleId: "context-overload",
        ruleName: "Context Overload",
        severity: "medium",
        message: "Retrieved 15 chunks, exceeding the threshold of 10.",
        recommendation: "Reduce topK.",
      },
    ]),
  );

  it("sets primaryCause.id to excessive-context-volume", () => {
    expect(result.primaryCause?.id).toBe("excessive-context-volume");
  });

  it("sets primaryCause.confidence to medium", () => {
    expect(result.primaryCause?.confidence).toBe("medium");
  });

  it("includes topK reduction recommendation", () => {
    const recs = result.recommendations.join("\n");
    expect(recs).toContain("topK");
  });
});

// ── Multi-finding trace ───────────────────────────────────────────────────────

describe("diagnoseTrace — multi-finding trace → primary + contributing causes", () => {
  const result = diagnoseTrace(
    makeResult([
      {
        ruleId: "low-retrieval-score",
        ruleName: "Low Retrieval Score",
        severity: "high",
        message: "Average retrieval score is 0.22",
      },
      {
        ruleId: "duplicate-chunks",
        ruleName: "Duplicate Chunks",
        severity: "medium",
        message: "Found 1 near-duplicate pair.",
      },
      {
        ruleId: "context-overload",
        ruleName: "Context Overload",
        severity: "medium",
        message: "Retrieved 15 chunks.",
      },
    ]),
  );

  it("primaryCause is retrieval-quality-degradation (highest score)", () => {
    expect(result.primaryCause?.id).toBe("retrieval-quality-degradation");
  });

  it("has two contributing causes", () => {
    expect(result.contributingCauses).toHaveLength(2);
  });

  it("contributing cause IDs are duplicate-context-pollution and excessive-context-volume", () => {
    const ids = result.contributingCauses.map((c) => c.id);
    expect(ids).toContain("duplicate-context-pollution");
    expect(ids).toContain("excessive-context-volume");
  });

  it("evidence has all three findings", () => {
    expect(result.evidence).toHaveLength(3);
  });

  it("recommendations are non-empty and deduplicated", () => {
    expect(result.recommendations.length).toBeGreaterThan(0);
    const unique = new Set(result.recommendations);
    expect(unique.size).toBe(result.recommendations.length);
  });

  it("primary cause recommendations appear before contributing ones", () => {
    const recs = result.recommendations.join("\n");
    const embeddingIdx = recs.indexOf("embedding model");
    const topKIdx = recs.indexOf("topK");
    // embedding model (primary) should come before topK (contributing)
    expect(embeddingIdx).toBeLessThan(topKIdx);
  });
});

// ── No findings ───────────────────────────────────────────────────────────────

describe("diagnoseTrace — no findings", () => {
  const result = diagnoseTrace({ findings: [], summary: { high: 0, medium: 0, low: 0 } });

  it("primaryCause is null", () => {
    expect(result.primaryCause).toBeNull();
  });

  it("contributingCauses is empty", () => {
    expect(result.contributingCauses).toHaveLength(0);
  });

  it("evidence is empty", () => {
    expect(result.evidence).toHaveLength(0);
  });

  it("recommendations is empty", () => {
    expect(result.recommendations).toHaveLength(0);
  });
});

// ── Unknown rule ID (no heuristic) ───────────────────────────────────────────

describe("diagnoseTrace — findings with no matching heuristic", () => {
  const result = diagnoseTrace(
    makeResult([
      {
        ruleId: "unknown-custom-rule",
        ruleName: "Unknown Rule",
        severity: "medium",
        message: "Something unknown happened.",
      },
    ]),
  );

  it("primaryCause is null when no heuristic matches", () => {
    expect(result.primaryCause).toBeNull();
  });

  it("evidence still contains the unmatched finding", () => {
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]?.findingRuleId).toBe("unknown-custom-rule");
  });

  it("recommendations is empty", () => {
    expect(result.recommendations).toHaveLength(0);
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe("diagnoseTrace — determinism", () => {
  it("returns identical results for the same input called twice", () => {
    const input = makeResult([
      {
        ruleId: "low-retrieval-score",
        ruleName: "Low Retrieval Score",
        severity: "high",
        message: "Average retrieval score is 0.22",
      },
      {
        ruleId: "duplicate-chunks",
        ruleName: "Duplicate Chunks",
        severity: "medium",
        message: "Found 1 near-duplicate pair.",
      },
    ]);
    const r1 = diagnoseTrace(input);
    const r2 = diagnoseTrace(input);
    expect(r1).toEqual(r2);
  });
});

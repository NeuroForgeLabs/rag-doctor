import { describe, it, expect } from "vitest";
import { analyzeTrace } from "../engine.js";
import type { DiagnosticFinding, DiagnosticRule, NormalizedTrace } from "@rag-doctor/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const cleanTrace: NormalizedTrace = {
  query: "What is the capital of France?",
  retrievedChunks: [
    { id: "1", text: "Paris is the capital of France.", score: 0.97 },
    { id: "2", text: "France is a Western European country.", score: 0.93 },
  ],
  finalAnswer: "Paris.",
};

const lowScoreTrace: NormalizedTrace = {
  query: "What causes headaches?",
  retrievedChunks: [
    { id: "1", text: "Dehydration can cause headaches.", score: 0.18 },
    { id: "2", text: "Stress is a common headache trigger.", score: 0.22 },
  ],
};

const duplicateTrace: NormalizedTrace = {
  query: "How do I reset my password?",
  retrievedChunks: [
    { id: "1", text: "Reset your password by visiting account settings.", score: 0.85 },
    { id: "2", text: "Reset your password by visiting account settings.", score: 0.84 },
  ],
};

const overloadTrace: NormalizedTrace = {
  query: "Explain photosynthesis",
  retrievedChunks: Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    text: `Unique photosynthesis fact number ${i} with distinct wording to avoid duplicate detection.`,
    score: 0.8,
  })),
};

const oversizedTrace: NormalizedTrace = {
  query: "History of computing",
  retrievedChunks: [{ id: "1", text: "a".repeat(1500), score: 0.7 }],
};

const emptyChunksTrace: NormalizedTrace = {
  query: "empty test",
  retrievedChunks: [],
};

const noScoresTrace: NormalizedTrace = {
  query: "no scores test",
  retrievedChunks: [
    { id: "1", text: "Some content without a score" },
    { id: "2", text: "Another chunk without a score" },
  ],
};

// ── Helper rules ──────────────────────────────────────────────────────────────

const alwaysHighRule: DiagnosticRule = {
  id: "always-high",
  name: "Always High",
  run: () => [{ ruleId: "always-high", ruleName: "Always High", severity: "high", message: "High" }],
};

const alwaysMediumRule: DiagnosticRule = {
  id: "always-medium",
  name: "Always Medium",
  run: () => [{ ruleId: "always-medium", ruleName: "Always Medium", severity: "medium", message: "Medium" }],
};

const alwaysLowRule: DiagnosticRule = {
  id: "always-low",
  name: "Always Low",
  run: () => [{ ruleId: "always-low", ruleName: "Always Low", severity: "low", message: "Low" }],
};

const neverFiresRule: DiagnosticRule = {
  id: "never-fires",
  name: "Never Fires",
  run: () => [],
};

const multipleFindings: DiagnosticRule = {
  id: "multi",
  name: "Multi",
  run: () => [
    { ruleId: "multi", ruleName: "Multi", severity: "high", message: "H1" },
    { ruleId: "multi", ruleName: "Multi", severity: "medium", message: "M1" },
    { ruleId: "multi", ruleName: "Multi", severity: "low", message: "L1" },
  ],
};

// ── Return shape ──────────────────────────────────────────────────────────────

describe("analyzeTrace — return shape", () => {
  it("always returns findings array and summary object", () => {
    const result = analyzeTrace(cleanTrace);
    expect(Array.isArray(result.findings)).toBe(true);
    expect(typeof result.summary).toBe("object");
  });

  it("summary always has high, medium, and low keys", () => {
    const result = analyzeTrace(cleanTrace, { rules: [] });
    expect(result.summary).toHaveProperty("high");
    expect(result.summary).toHaveProperty("medium");
    expect(result.summary).toHaveProperty("low");
  });

  it("summary values are always non-negative integers", () => {
    const result = analyzeTrace(cleanTrace);
    expect(result.summary.high).toBeGreaterThanOrEqual(0);
    expect(result.summary.medium).toBeGreaterThanOrEqual(0);
    expect(result.summary.low).toBeGreaterThanOrEqual(0);
  });
});

// ── Summary correctness ───────────────────────────────────────────────────────

describe("analyzeTrace — summary counts", () => {
  it("summary counts exactly match actual findings by severity", () => {
    for (const trace of [cleanTrace, lowScoreTrace, duplicateTrace, overloadTrace]) {
      const result = analyzeTrace(trace);
      const counted = result.findings.reduce(
        (acc, f) => { acc[f.severity]++; return acc; },
        { high: 0, medium: 0, low: 0 },
      );
      expect(result.summary).toEqual(counted);
    }
  });

  it("produces high:1 medium:0 low:0 when only alwaysHighRule fires", () => {
    const result = analyzeTrace(cleanTrace, { rules: [alwaysHighRule] });
    expect(result.summary).toEqual({ high: 1, medium: 0, low: 0 });
  });

  it("produces high:0 medium:1 low:0 when only alwaysMediumRule fires", () => {
    const result = analyzeTrace(cleanTrace, { rules: [alwaysMediumRule] });
    expect(result.summary).toEqual({ high: 0, medium: 1, low: 0 });
  });

  it("produces high:0 medium:0 low:1 when only alwaysLowRule fires", () => {
    const result = analyzeTrace(cleanTrace, { rules: [alwaysLowRule] });
    expect(result.summary).toEqual({ high: 0, medium: 0, low: 1 });
  });

  it("aggregates findings from multiple rules correctly", () => {
    const result = analyzeTrace(cleanTrace, {
      rules: [alwaysHighRule, alwaysMediumRule, alwaysLowRule],
    });
    expect(result.summary).toEqual({ high: 1, medium: 1, low: 1 });
    expect(result.findings).toHaveLength(3);
  });

  it("handles a rule that returns multiple findings", () => {
    const result = analyzeTrace(cleanTrace, { rules: [multipleFindings] });
    expect(result.summary).toEqual({ high: 1, medium: 1, low: 1 });
    expect(result.findings).toHaveLength(3);
  });
});

// ── Empty and zero cases ──────────────────────────────────────────────────────

describe("analyzeTrace — empty / zero cases", () => {
  it("returns zeroed summary when no rules provided", () => {
    const result = analyzeTrace(cleanTrace, { rules: [] });
    expect(result.summary).toEqual({ high: 0, medium: 0, low: 0 });
    expect(result.findings).toHaveLength(0);
  });

  it("returns zeroed summary when all rules produce no findings", () => {
    const result = analyzeTrace(cleanTrace, { rules: [neverFiresRule] });
    expect(result.summary).toEqual({ high: 0, medium: 0, low: 0 });
  });

  it("handles empty retrievedChunks without error", () => {
    const result = analyzeTrace(emptyChunksTrace);
    expect(result.summary).toEqual({ high: 0, medium: 0, low: 0 });
  });

  it("handles trace with no scores without error", () => {
    expect(() => analyzeTrace(noScoresTrace)).not.toThrow();
  });
});

// ── Real rule scenarios ───────────────────────────────────────────────────────

describe("analyzeTrace — real rule scenarios", () => {
  it("clean trace with high scores produces no findings", () => {
    const result = analyzeTrace(cleanTrace);
    expect(result.findings).toHaveLength(0);
    expect(result.summary).toEqual({ high: 0, medium: 0, low: 0 });
  });

  it("low-score trace triggers exactly one high-severity finding", () => {
    const result = analyzeTrace(lowScoreTrace);
    expect(result.summary.high).toBeGreaterThanOrEqual(1);
    const lowScoreFindings = result.findings.filter((f) => f.ruleId === "low-retrieval-score");
    expect(lowScoreFindings).toHaveLength(1);
  });

  it("duplicate trace triggers a medium-severity duplicate-chunks finding", () => {
    const result = analyzeTrace(duplicateTrace);
    const dupFindings = result.findings.filter((f) => f.ruleId === "duplicate-chunks");
    expect(dupFindings).toHaveLength(1);
    expect(dupFindings[0]?.severity).toBe("medium");
  });

  it("overloaded trace triggers a medium-severity context-overload finding", () => {
    const result = analyzeTrace(overloadTrace);
    const overloadFindings = result.findings.filter((f) => f.ruleId === "context-overload");
    expect(overloadFindings).toHaveLength(1);
    expect(overloadFindings[0]?.severity).toBe("medium");
  });

  it("oversized trace triggers a low-severity oversized-chunk finding", () => {
    const result = analyzeTrace(oversizedTrace);
    const sizedFindings = result.findings.filter((f) => f.ruleId === "oversized-chunk");
    expect(sizedFindings).toHaveLength(1);
    expect(sizedFindings[0]?.severity).toBe("low");
  });

  it("multi-rule trace triggers findings from multiple rules", () => {
    // multi-rule-trace: duplicates + low score + context overload
    const multiRuleTrace: NormalizedTrace = {
      query: "What are the benefits of drinking water?",
      retrievedChunks: [
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `dup${i}`,
          text: "Drinking water helps maintain the balance of body fluids.",
          score: 0.2,
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `unique${i}`,
          text: `Unique content about water benefit number ${i} hydration energy.`,
          score: 0.19,
        })),
      ],
    };
    const result = analyzeTrace(multiRuleTrace);
    const ruleIds = result.findings.map((f) => f.ruleId);
    expect(ruleIds).toContain("low-retrieval-score");
    expect(ruleIds).toContain("duplicate-chunks");
    expect(ruleIds).toContain("context-overload");
  });
});

// ── Custom rule injection ─────────────────────────────────────────────────────

describe("analyzeTrace — custom rules", () => {
  it("custom rule replaces default rules when passed via options", () => {
    const result = analyzeTrace(lowScoreTrace, { rules: [neverFiresRule] });
    expect(result.findings).toHaveLength(0);
    // default low-retrieval-score would have fired, but we replaced rules
  });

  it("can combine default rules with custom rules", async () => {
    const { defaultRules } = await import("@rag-doctor/rules");
    const result = analyzeTrace(cleanTrace, { rules: [...defaultRules, alwaysHighRule] });
    const customFindings = result.findings.filter((f) => f.ruleId === "always-high");
    expect(customFindings).toHaveLength(1);
  });

  it("custom rule receives the correct NormalizedTrace", () => {
    let receivedTrace: NormalizedTrace | null = null;
    const capturingRule: DiagnosticRule = {
      id: "capture",
      name: "Capture",
      run: (t) => { receivedTrace = t; return []; },
    };
    analyzeTrace(cleanTrace, { rules: [capturingRule] });
    expect(receivedTrace).toBe(cleanTrace);
  });

  it("findings preserve all fields set by the custom rule", () => {
    const detailRule: DiagnosticRule = {
      id: "detail-rule",
      name: "Detail Rule",
      run: () => [
        {
          ruleId: "detail-rule",
          ruleName: "Detail Rule",
          severity: "medium",
          message: "Custom message",
          recommendation: "Custom recommendation",
          details: { foo: "bar", count: 42 },
        },
      ],
    };
    const result = analyzeTrace(cleanTrace, { rules: [detailRule] });
    const f = result.findings[0] as DiagnosticFinding;
    expect(f.recommendation).toBe("Custom recommendation");
    expect(f.details?.["foo"]).toBe("bar");
    expect(f.details?.["count"]).toBe(42);
  });
});

/**
 * Phase 3 engine tests: pack resolution, ruleOptions overrides, error handling.
 * Appends to the existing engine test suite.
 */
import { describe, it, expect } from "vitest";
import { analyzeTrace, resolveRules, UnknownPackError } from "../engine.js";
import { RuleConfigurationError } from "@rag-doctor/rules";
import type { NormalizedTrace, RetrievedChunk } from "@rag-doctor/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeTrace = (
  chunks: RetrievedChunk[],
  extra?: Partial<NormalizedTrace>,
): NormalizedTrace => ({ query: "test", retrievedChunks: chunks, ...extra });

const chunk = (id: string, text: string, score?: number): RetrievedChunk => ({
  id,
  text,
  ...(score !== undefined ? { score } : {}),
});

// ── resolveRules ──────────────────────────────────────────────────────────────

describe("resolveRules", () => {
  it("returns defaultRules when no options provided", async () => {
    const { defaultRules } = await import("@rag-doctor/rules");
    const rules = resolveRules({});
    expect(rules).toBe(defaultRules);
  });

  it("returns explicit rules when rules option is provided", () => {
    const custom = [{ id: "x", name: "X", run: () => [] }];
    expect(resolveRules({ rules: custom })).toBe(custom);
  });

  it("ignores packs when explicit rules are provided", () => {
    const custom = [{ id: "x", name: "X", run: () => [] }];
    const result = resolveRules({ rules: custom, packs: ["recommended"] });
    expect(result).toBe(custom);
  });

  it("resolves 'recommended' pack to 4 rules", () => {
    const rules = resolveRules({ packs: ["recommended"] });
    expect(rules).toHaveLength(4);
  });

  it("resolves 'strict' pack to 4 rules", () => {
    const rules = resolveRules({ packs: ["strict"] });
    expect(rules).toHaveLength(4);
  });

  it("concatenates multiple packs in order", () => {
    const rules = resolveRules({ packs: ["recommended", "strict"] });
    expect(rules).toHaveLength(8);
  });

  it("throws UnknownPackError for an unrecognized pack name", () => {
    expect(() => resolveRules({ packs: ["nonexistent"] })).toThrow(UnknownPackError);
  });

  it("UnknownPackError has correct packName", () => {
    let err: UnknownPackError | undefined;
    try {
      resolveRules({ packs: ["nonexistent"] });
    } catch (e) {
      if (e instanceof UnknownPackError) err = e;
    }
    expect(err?.packName).toBe("nonexistent");
    expect(err?.code).toBe("UNKNOWN_PACK_ERROR");
    expect(err?.message).toContain("nonexistent");
  });

  it("applies ruleOptions when resolving a pack", () => {
    const rules = resolveRules({
      packs: ["recommended"],
      ruleOptions: { "context-overload": { maxChunkCount: 5 } },
    });
    const co = rules.find((r) => r.id === "context-overload")!;
    const six = Array.from({ length: 6 }, (_, i) => chunk(String(i), `c ${i}`));
    expect(co.run(makeTrace(six))).toHaveLength(1);
  });
});

// ── analyzeTrace — pack resolution ───────────────────────────────────────────

describe("analyzeTrace — packs", () => {
  it("runs analysis with recommended pack (same results as default)", () => {
    const defaultResult = analyzeTrace(makeTrace([chunk("1", "t", 0.9)]));
    const packResult = analyzeTrace(makeTrace([chunk("1", "t", 0.9)]), {
      packs: ["recommended"],
    });
    expect(packResult.summary).toEqual(defaultResult.summary);
  });

  it("strict pack fires low-retrieval-score at avg 0.55 (above recommended threshold)", () => {
    const trace = makeTrace([chunk("1", "t", 0.55)]);
    const recommended = analyzeTrace(trace, { packs: ["recommended"] });
    const strict = analyzeTrace(trace, { packs: ["strict"] });
    // recommended (threshold 0.5) should NOT fire
    expect(recommended.findings.filter((f) => f.ruleId === "low-retrieval-score")).toHaveLength(0);
    // strict (threshold 0.6) should fire
    expect(strict.findings.filter((f) => f.ruleId === "low-retrieval-score")).toHaveLength(1);
  });

  it("strict pack fires context-overload at 9 chunks (above recommended threshold)", () => {
    const nine = Array.from({ length: 9 }, (_, i) => chunk(String(i), `chunk ${i} unique text here`));
    const trace = makeTrace(nine);
    const recommended = analyzeTrace(trace, { packs: ["recommended"] });
    const strict = analyzeTrace(trace, { packs: ["strict"] });
    expect(recommended.findings.filter((f) => f.ruleId === "context-overload")).toHaveLength(0);
    expect(strict.findings.filter((f) => f.ruleId === "context-overload")).toHaveLength(1);
  });

  it("throws UnknownPackError for unknown pack (propagates from resolveRules)", () => {
    expect(() =>
      analyzeTrace(makeTrace([]), { packs: ["unknown-pack"] }),
    ).toThrow(UnknownPackError);
  });
});

// ── analyzeTrace — ruleOptions overrides ─────────────────────────────────────

describe("analyzeTrace — ruleOptions overrides", () => {
  it("overriding context-overload threshold changes which traces fire", () => {
    const six = Array.from({ length: 6 }, (_, i) => chunk(String(i), `chunk ${i}`));
    const trace = makeTrace(six);

    // With default (threshold=10), 6 chunks should NOT fire
    const defaultResult = analyzeTrace(trace);
    expect(defaultResult.findings.filter((f) => f.ruleId === "context-overload")).toHaveLength(0);

    // With override to threshold=5 via pack, 6 chunks SHOULD fire
    const overrideResult = analyzeTrace(trace, {
      packs: ["recommended"],
      ruleOptions: { "context-overload": { maxChunkCount: 5 } },
    });
    expect(overrideResult.findings.filter((f) => f.ruleId === "context-overload")).toHaveLength(1);
  });

  it("overriding low-retrieval-score threshold changes findings", () => {
    const trace = makeTrace([chunk("1", "t", 0.55)]);

    // Default threshold (0.5): avg 0.55 does NOT fire
    expect(analyzeTrace(trace).findings.filter((f) => f.ruleId === "low-retrieval-score")).toHaveLength(0);

    // Override threshold to 0.6: avg 0.55 SHOULD fire
    const result = analyzeTrace(trace, {
      packs: ["recommended"],
      ruleOptions: { "low-retrieval-score": { averageScoreThreshold: 0.6 } },
    });
    expect(result.findings.filter((f) => f.ruleId === "low-retrieval-score")).toHaveLength(1);
  });

  it("throws RuleConfigurationError when ruleOptions contain invalid values", () => {
    expect(() =>
      analyzeTrace(makeTrace([]), {
        packs: ["recommended"],
        ruleOptions: { "context-overload": { maxChunkCount: 0 } },
      }),
    ).toThrow(RuleConfigurationError);
  });

  it("RuleConfigurationError has correct ruleId and optionKey", () => {
    let err: RuleConfigurationError | undefined;
    try {
      analyzeTrace(makeTrace([]), {
        packs: ["recommended"],
        ruleOptions: { "low-retrieval-score": { averageScoreThreshold: -1 } },
      });
    } catch (e) {
      if (e instanceof RuleConfigurationError) err = e;
    }
    expect(err?.ruleId).toBe("low-retrieval-score");
    expect(err?.optionKey).toBe("averageScoreThreshold");
  });
});

// ── analyzeTrace — backward compatibility ────────────────────────────────────

describe("analyzeTrace — backward compatibility", () => {
  it("analyzeTrace() with no options still uses defaultRules", async () => {
    const { defaultRules } = await import("@rag-doctor/rules");
    const trace = makeTrace([chunk("1", "t", 0.2)]);
    const result = analyzeTrace(trace);
    // defaultRules includes low-retrieval-score which should fire
    expect(result.findings.some((f) => f.ruleId === "low-retrieval-score")).toBe(true);
    expect(result.findings.length).toBe(defaultRules.reduce((n, r) => n + r.run(trace).length, 0));
  });

  it("explicit rules option still works exactly as before", () => {
    const custom = { id: "custom", name: "Custom", run: () => [] as never[] };
    const result = analyzeTrace(makeTrace([]), { rules: [custom] });
    expect(result.findings).toHaveLength(0);
  });

  it("empty findings and zeroed summary for clean trace with recommended pack", () => {
    const clean: NormalizedTrace = {
      query: "What is the capital of France?",
      retrievedChunks: [
        { id: "1", text: "Paris is the capital of France.", score: 0.97 },
        { id: "2", text: "France is a Western European country.", score: 0.93 },
      ],
      finalAnswer: "Paris.",
    };
    const result = analyzeTrace(clean, { packs: ["recommended"] });
    expect(result.findings).toHaveLength(0);
    expect(result.summary).toEqual({ high: 0, medium: 0, low: 0 });
  });
});

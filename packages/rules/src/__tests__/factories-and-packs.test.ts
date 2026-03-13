/**
 * Tests for rule factories, configurable thresholds, and RuleConfigurationError.
 * These tests verify the Phase 3 factory API without breaking the legacy rule objects.
 */
import { describe, it, expect } from "vitest";
import {
  createDuplicateChunksRule,
  createLowRetrievalScoreRule,
  createOversizedChunkRule,
  createContextOverloadRule,
  DuplicateChunksRule,
  LowRetrievalScoreRule,
  OversizedChunkRule,
  ContextOverloadRule,
  RuleConfigurationError,
  defaultRules,
  recommendedPack,
  strictPack,
  BUILT_IN_PACKS,
} from "../index.js";
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

// ── createDuplicateChunksRule ─────────────────────────────────────────────────

describe("createDuplicateChunksRule", () => {
  it("uses default threshold of 0.8 when no options supplied", () => {
    const rule = createDuplicateChunksRule();
    expect(rule.id).toBe("duplicate-chunks");
    // Jaccard ~0.92 (14 shared tokens / 15 total) — should fire at default 0.8
    const a = "The quick brown fox jumps over the lazy dog near the river bank";
    const b = "The quick brown fox jumps over the lazy dog near the river bank today";
    expect(rule.run(makeTrace([chunk("1", a), chunk("2", b)]))).toHaveLength(1);
  });

  it("fires when similarity >= custom threshold", () => {
    const rule = createDuplicateChunksRule({ similarityThreshold: 0.5 });
    // Two partially-overlapping strings with ~0.6 overlap should now fire
    const a = "the cat sat on the mat by the window";
    const b = "the cat sat on the floor by the window";
    const findings = rule.run(makeTrace([chunk("1", a), chunk("2", b)]));
    expect(findings).toHaveLength(1);
  });

  it("does not fire when similarity < custom threshold", () => {
    const rule = createDuplicateChunksRule({ similarityThreshold: 0.99 });
    // Near-duplicates that are NOT identical should not fire at 0.99 threshold
    const a = "the quick brown fox jumps over the lazy dog";
    const b = "the quick brown fox jumps over the lazy cat";
    const findings = rule.run(makeTrace([chunk("1", a), chunk("2", b)]));
    expect(findings).toHaveLength(0);
  });

  it("includes threshold in finding details", () => {
    const rule = createDuplicateChunksRule({ similarityThreshold: 0.7 });
    const text = "identical chunk text used for both";
    const findings = rule.run(makeTrace([chunk("1", text), chunk("2", text)]));
    expect(findings[0]?.details?.["threshold"]).toBe(0.7);
  });

  it("throws RuleConfigurationError for threshold of 0", () => {
    expect(() => createDuplicateChunksRule({ similarityThreshold: 0 })).toThrow(
      RuleConfigurationError,
    );
  });

  it("throws RuleConfigurationError for threshold > 1", () => {
    expect(() => createDuplicateChunksRule({ similarityThreshold: 1.1 })).toThrow(
      RuleConfigurationError,
    );
  });

  it("throws RuleConfigurationError for negative threshold", () => {
    expect(() => createDuplicateChunksRule({ similarityThreshold: -0.1 })).toThrow(
      RuleConfigurationError,
    );
  });

  it("accepts threshold of exactly 1 (only flags exact duplicates)", () => {
    expect(() => createDuplicateChunksRule({ similarityThreshold: 1 })).not.toThrow();
  });

  it("RuleConfigurationError has correct ruleId and optionKey", () => {
    let err: RuleConfigurationError | undefined;
    try {
      createDuplicateChunksRule({ similarityThreshold: 0 });
    } catch (e) {
      if (e instanceof RuleConfigurationError) err = e;
    }
    expect(err?.ruleId).toBe("duplicate-chunks");
    expect(err?.optionKey).toBe("similarityThreshold");
    expect(err?.code).toBe("RULE_CONFIGURATION_ERROR");
  });

  it("backward-compatible: DuplicateChunksRule object still works", () => {
    const text = "same content repeated twice verbatim for backward compat test";
    expect(DuplicateChunksRule.run(makeTrace([chunk("1", text), chunk("2", text)]))).toHaveLength(1);
  });
});

// ── createLowRetrievalScoreRule ───────────────────────────────────────────────

describe("createLowRetrievalScoreRule", () => {
  it("uses default threshold of 0.5 when no options supplied", () => {
    const rule = createLowRetrievalScoreRule();
    expect(rule.run(makeTrace([chunk("1", "t", 0.3)]))).toHaveLength(1);
    expect(rule.run(makeTrace([chunk("1", "t", 0.5)]))).toHaveLength(0);
  });

  it("fires when average score < custom threshold", () => {
    const rule = createLowRetrievalScoreRule({ averageScoreThreshold: 0.7 });
    expect(rule.run(makeTrace([chunk("1", "t", 0.6)]))).toHaveLength(1);
  });

  it("does not fire when average score >= custom threshold", () => {
    const rule = createLowRetrievalScoreRule({ averageScoreThreshold: 0.7 });
    expect(rule.run(makeTrace([chunk("1", "t", 0.7)]))).toHaveLength(0);
  });

  it("includes the custom threshold in the finding message and details", () => {
    const rule = createLowRetrievalScoreRule({ averageScoreThreshold: 0.6 });
    const findings = rule.run(makeTrace([chunk("1", "t", 0.3)]));
    expect(findings[0]?.message).toContain("0.6");
    expect(findings[0]?.details?.["threshold"]).toBe(0.6);
  });

  it("throws RuleConfigurationError for threshold < 0", () => {
    expect(() => createLowRetrievalScoreRule({ averageScoreThreshold: -0.1 })).toThrow(
      RuleConfigurationError,
    );
  });

  it("throws RuleConfigurationError for threshold > 1", () => {
    expect(() => createLowRetrievalScoreRule({ averageScoreThreshold: 1.1 })).toThrow(
      RuleConfigurationError,
    );
  });

  it("accepts threshold of exactly 0", () => {
    expect(() => createLowRetrievalScoreRule({ averageScoreThreshold: 0 })).not.toThrow();
  });

  it("accepts threshold of exactly 1", () => {
    expect(() => createLowRetrievalScoreRule({ averageScoreThreshold: 1 })).not.toThrow();
  });

  it("backward-compatible: LowRetrievalScoreRule object still works", () => {
    expect(LowRetrievalScoreRule.run(makeTrace([chunk("1", "t", 0.2)]))).toHaveLength(1);
  });
});

// ── createOversizedChunkRule ──────────────────────────────────────────────────

describe("createOversizedChunkRule", () => {
  it("uses default threshold of 1200 when no options supplied", () => {
    const rule = createOversizedChunkRule();
    expect(rule.run(makeTrace([chunk("1", "a".repeat(1201))]))).toHaveLength(1);
    expect(rule.run(makeTrace([chunk("1", "a".repeat(1200))]))).toHaveLength(0);
  });

  it("fires when chunk length > custom threshold", () => {
    const rule = createOversizedChunkRule({ maxChunkLength: 500 });
    expect(rule.run(makeTrace([chunk("1", "a".repeat(501))]))).toHaveLength(1);
  });

  it("does not fire when chunk length <= custom threshold", () => {
    const rule = createOversizedChunkRule({ maxChunkLength: 500 });
    expect(rule.run(makeTrace([chunk("1", "a".repeat(500))]))).toHaveLength(0);
  });

  it("includes the custom threshold in finding details", () => {
    const rule = createOversizedChunkRule({ maxChunkLength: 800 });
    const findings = rule.run(makeTrace([chunk("1", "a".repeat(900))]));
    expect(findings[0]?.details?.["threshold"]).toBe(800);
  });

  it("throws RuleConfigurationError for threshold of 0", () => {
    expect(() => createOversizedChunkRule({ maxChunkLength: 0 })).toThrow(RuleConfigurationError);
  });

  it("throws RuleConfigurationError for negative threshold", () => {
    expect(() => createOversizedChunkRule({ maxChunkLength: -1 })).toThrow(RuleConfigurationError);
  });

  it("throws RuleConfigurationError for non-integer threshold", () => {
    expect(() => createOversizedChunkRule({ maxChunkLength: 1200.5 })).toThrow(
      RuleConfigurationError,
    );
  });

  it("backward-compatible: OversizedChunkRule object still works", () => {
    expect(OversizedChunkRule.run(makeTrace([chunk("1", "a".repeat(1201))]))).toHaveLength(1);
  });
});

// ── createContextOverloadRule ─────────────────────────────────────────────────

describe("createContextOverloadRule", () => {
  it("uses default threshold of 10 when no options supplied", () => {
    const rule = createContextOverloadRule();
    const eleven = Array.from({ length: 11 }, (_, i) => chunk(String(i), `chunk ${i}`));
    const ten = Array.from({ length: 10 }, (_, i) => chunk(String(i), `chunk ${i}`));
    expect(rule.run(makeTrace(eleven))).toHaveLength(1);
    expect(rule.run(makeTrace(ten))).toHaveLength(0);
  });

  it("fires when chunk count > custom threshold", () => {
    const rule = createContextOverloadRule({ maxChunkCount: 5 });
    const six = Array.from({ length: 6 }, (_, i) => chunk(String(i), `chunk ${i}`));
    expect(rule.run(makeTrace(six))).toHaveLength(1);
  });

  it("does not fire when chunk count <= custom threshold", () => {
    const rule = createContextOverloadRule({ maxChunkCount: 5 });
    const five = Array.from({ length: 5 }, (_, i) => chunk(String(i), `chunk ${i}`));
    expect(rule.run(makeTrace(five))).toHaveLength(0);
  });

  it("includes the custom threshold in finding details", () => {
    const rule = createContextOverloadRule({ maxChunkCount: 3 });
    const four = Array.from({ length: 4 }, (_, i) => chunk(String(i), `chunk ${i}`));
    const findings = rule.run(makeTrace(four));
    expect(findings[0]?.details?.["threshold"]).toBe(3);
  });

  it("throws RuleConfigurationError for threshold of 0", () => {
    expect(() => createContextOverloadRule({ maxChunkCount: 0 })).toThrow(RuleConfigurationError);
  });

  it("throws RuleConfigurationError for negative threshold", () => {
    expect(() => createContextOverloadRule({ maxChunkCount: -1 })).toThrow(RuleConfigurationError);
  });

  it("throws RuleConfigurationError for non-integer threshold", () => {
    expect(() => createContextOverloadRule({ maxChunkCount: 5.5 })).toThrow(RuleConfigurationError);
  });

  it("backward-compatible: ContextOverloadRule object still works", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => chunk(String(i), `chunk ${i}`));
    expect(ContextOverloadRule.run(makeTrace(eleven))).toHaveLength(1);
  });
});

// ── defaultRules (regression) ─────────────────────────────────────────────────

describe("defaultRules — regression", () => {
  it("still exports exactly 4 rules", () => expect(defaultRules).toHaveLength(4));
  it("all rules have unique ids", () => {
    const ids = defaultRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("run() still returns an array for all rules", () => {
    for (const rule of defaultRules)
      expect(Array.isArray(rule.run(makeTrace([])))).toBe(true);
  });
});

// ── recommendedPack ───────────────────────────────────────────────────────────

describe("recommendedPack", () => {
  it("has name 'recommended'", () => expect(recommendedPack.name).toBe("recommended"));

  it("resolves to exactly 4 rules", () => {
    expect(recommendedPack.resolve()).toHaveLength(4);
  });

  it("resolved rules cover all built-in rule IDs", () => {
    const ids = recommendedPack.resolve().map((r) => r.id);
    expect(ids).toContain("duplicate-chunks");
    expect(ids).toContain("low-retrieval-score");
    expect(ids).toContain("oversized-chunk");
    expect(ids).toContain("context-overload");
  });

  it("uses default thresholds — low-retrieval-score fires at 0.4 avg", () => {
    const rules = recommendedPack.resolve();
    const lrs = rules.find((r) => r.id === "low-retrieval-score")!;
    expect(lrs.run(makeTrace([chunk("1", "t", 0.4)]))).toHaveLength(1);
  });

  it("uses default thresholds — context-overload fires at 11 chunks", () => {
    const rules = recommendedPack.resolve();
    const co = rules.find((r) => r.id === "context-overload")!;
    const eleven = Array.from({ length: 11 }, (_, i) => chunk(String(i), `chunk ${i}`));
    expect(co.run(makeTrace(eleven))).toHaveLength(1);
  });

  it("applies ruleOptions override on top of recommended defaults", () => {
    const rules = recommendedPack.resolve({
      "low-retrieval-score": { averageScoreThreshold: 0.7 },
    });
    const lrs = rules.find((r) => r.id === "low-retrieval-score")!;
    // At 0.7 threshold: score 0.6 should fire
    expect(lrs.run(makeTrace([chunk("1", "t", 0.6)]))).toHaveLength(1);
    // Without override, 0.6 would NOT fire at the default 0.5 threshold
  });

  it("ruleOptions override only affects the targeted rule", () => {
    const rules = recommendedPack.resolve({
      "context-overload": { maxChunkCount: 5 },
    });
    // context-overload should fire at 6 chunks (override applied)
    const co = rules.find((r) => r.id === "context-overload")!;
    const six = Array.from({ length: 6 }, (_, i) => chunk(String(i), `chunk ${i}`));
    expect(co.run(makeTrace(six))).toHaveLength(1);

    // low-retrieval-score should still use default threshold
    const lrs = rules.find((r) => r.id === "low-retrieval-score")!;
    expect(lrs.run(makeTrace([chunk("1", "t", 0.6)]))).toHaveLength(0);
  });

  it("is deterministic — same options always produce same rule IDs", () => {
    const r1 = recommendedPack.resolve().map((r) => r.id);
    const r2 = recommendedPack.resolve().map((r) => r.id);
    expect(r1).toEqual(r2);
  });
});

// ── strictPack ────────────────────────────────────────────────────────────────

describe("strictPack", () => {
  it("has name 'strict'", () => expect(strictPack.name).toBe("strict"));

  it("resolves to exactly 4 rules", () => {
    expect(strictPack.resolve()).toHaveLength(4);
  });

  it("uses stricter thresholds — low-retrieval-score fires at 0.55 avg (strict: 0.6)", () => {
    const rules = strictPack.resolve();
    const lrs = rules.find((r) => r.id === "low-retrieval-score")!;
    // At strict threshold 0.6: avg 0.55 should fire
    expect(lrs.run(makeTrace([chunk("1", "t", 0.55)]))).toHaveLength(1);
  });

  it("uses stricter thresholds — context-overload fires at 9 chunks (strict: 8)", () => {
    const rules = strictPack.resolve();
    const co = rules.find((r) => r.id === "context-overload")!;
    const nine = Array.from({ length: 9 }, (_, i) => chunk(String(i), `chunk ${i}`));
    expect(co.run(makeTrace(nine))).toHaveLength(1);
  });

  it("uses stricter thresholds — oversized-chunk fires at 1001 chars (strict: 1000)", () => {
    const rules = strictPack.resolve();
    const oc = rules.find((r) => r.id === "oversized-chunk")!;
    expect(oc.run(makeTrace([chunk("1", "a".repeat(1001))]))).toHaveLength(1);
    expect(oc.run(makeTrace([chunk("1", "a".repeat(1000))]))).toHaveLength(0);
  });

  it("strict does NOT fire low-retrieval-score at 0.55 under recommended (threshold 0.5)", () => {
    const rules = recommendedPack.resolve();
    const lrs = rules.find((r) => r.id === "low-retrieval-score")!;
    // Under recommended 0.5 threshold, 0.55 does NOT fire
    expect(lrs.run(makeTrace([chunk("1", "t", 0.55)]))).toHaveLength(0);
  });

  it("ruleOptions override takes precedence over strict defaults", () => {
    const rules = strictPack.resolve({
      "context-overload": { maxChunkCount: 15 },
    });
    const co = rules.find((r) => r.id === "context-overload")!;
    // Should now fire at 16 chunks (override), not at 9 (strict default)
    const fifteen = Array.from({ length: 15 }, (_, i) => chunk(String(i), `c ${i}`));
    const sixteen = Array.from({ length: 16 }, (_, i) => chunk(String(i), `c ${i}`));
    expect(co.run(makeTrace(fifteen))).toHaveLength(0);
    expect(co.run(makeTrace(sixteen))).toHaveLength(1);
  });

  it("is deterministic — same options always produce same results", () => {
    const r1 = strictPack.resolve().map((r) => r.id);
    const r2 = strictPack.resolve().map((r) => r.id);
    expect(r1).toEqual(r2);
  });
});

// ── BUILT_IN_PACKS registry ───────────────────────────────────────────────────

describe("BUILT_IN_PACKS", () => {
  it("contains 'recommended'", () => expect("recommended" in BUILT_IN_PACKS).toBe(true));
  it("contains 'strict'", () => expect("strict" in BUILT_IN_PACKS).toBe(true));
  it("recommendedPack and BUILT_IN_PACKS.recommended are the same object", () => {
    expect(BUILT_IN_PACKS["recommended"]).toBe(recommendedPack);
  });
  it("strictPack and BUILT_IN_PACKS.strict are the same object", () => {
    expect(BUILT_IN_PACKS["strict"]).toBe(strictPack);
  });
});

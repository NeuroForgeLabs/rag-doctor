import { describe, it, expect } from "vitest";
import { DuplicateChunksRule } from "../duplicate-chunks.rule.js";
import { LowRetrievalScoreRule } from "../low-retrieval-score.rule.js";
import { OversizedChunkRule } from "../oversized-chunk.rule.js";
import { ContextOverloadRule } from "../context-overload.rule.js";
import { defaultRules } from "../index.js";
import type { NormalizedTrace, RetrievedChunk } from "@rag-doctor/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeTrace = (chunks: RetrievedChunk[], extra?: Partial<NormalizedTrace>): NormalizedTrace => ({
  query: "test query",
  retrievedChunks: chunks,
  ...extra,
});

const chunk = (
  id: string,
  text: string,
  score?: number,
  source?: string,
): RetrievedChunk => ({ id, text, ...(score !== undefined ? { score } : {}), ...(source ? { source } : {}) });

// ── DuplicateChunksRule ───────────────────────────────────────────────────────

describe("DuplicateChunksRule", () => {
  describe("positive — detects duplicates", () => {
    it("flags two identical chunks", () => {
      const text = "Reset password via account settings menu.";
      const findings = DuplicateChunksRule.run(makeTrace([chunk("1", text), chunk("2", text)]));
      expect(findings).toHaveLength(1);
      expect(findings[0]?.severity).toBe("medium");
      expect(findings[0]?.ruleId).toBe("duplicate-chunks");
    });

    it("flags near-duplicate chunks (high token overlap)", () => {
      const a = "The quick brown fox jumps over the lazy dog near the river bank";
      const b = "The quick brown fox jumps over the lazy dog near the river bank today";
      const findings = DuplicateChunksRule.run(makeTrace([chunk("1", a), chunk("2", b)]));
      expect(findings).toHaveLength(1);
    });

    it("reports the number of duplicate pairs in the message", () => {
      const text = "Exact same content repeated here verbatim for testing purposes.";
      const findings = DuplicateChunksRule.run(
        makeTrace([chunk("1", text), chunk("2", text), chunk("3", text)]),
      );
      expect(findings[0]?.message).toContain("pair");
    });

    it("includes chunk IDs in finding details", () => {
      const text = "Repeated content for duplicate detection test.";
      const findings = DuplicateChunksRule.run(makeTrace([chunk("a", text), chunk("b", text)]));
      const pairs = (findings[0]?.details?.["duplicatePairs"] as Array<{ chunkAId: string; chunkBId: string }>) ?? [];
      expect(pairs[0]?.chunkAId).toBe("a");
      expect(pairs[0]?.chunkBId).toBe("b");
    });

    it("detects multiple duplicate pairs across many chunks", () => {
      const text = "Completely identical chunk text used in all positions.";
      const findings = DuplicateChunksRule.run(
        makeTrace([chunk("1", text), chunk("2", text), chunk("3", text), chunk("4", text)]),
      );
      // 4 identical chunks = 6 pairs
      const pairs = findings[0]?.details?.["duplicatePairs"] as unknown[];
      expect(pairs?.length).toBe(6);
    });

    it("is case-insensitive for duplicate detection", () => {
      const a = "RESET PASSWORD VIA ACCOUNT SETTINGS";
      const b = "reset password via account settings";
      const findings = DuplicateChunksRule.run(makeTrace([chunk("1", a), chunk("2", b)]));
      expect(findings).toHaveLength(1);
    });
  });

  describe("negative — does not flag distinct chunks", () => {
    it("returns no findings for clearly different chunks", () => {
      const findings = DuplicateChunksRule.run(
        makeTrace([
          chunk("1", "The weather today is sunny and warm."),
          chunk("2", "Python is a high-level programming language."),
        ]),
      );
      expect(findings).toHaveLength(0);
    });

    it("returns no findings for chunks that share only a few common words", () => {
      const a = "The quick brown fox";
      const b = "The slow red cat sat on the mat";
      const findings = DuplicateChunksRule.run(makeTrace([chunk("1", a), chunk("2", b)]));
      expect(findings).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("returns no findings for an empty chunk list", () => {
      expect(DuplicateChunksRule.run(makeTrace([]))).toHaveLength(0);
    });

    it("returns no findings for a single chunk", () => {
      expect(DuplicateChunksRule.run(makeTrace([chunk("1", "some content")]))).toHaveLength(0);
    });

    it("returns no findings for two chunks with empty text", () => {
      // Two empty strings have Jaccard similarity of 0 (no tokens)
      expect(DuplicateChunksRule.run(makeTrace([chunk("1", ""), chunk("2", "")]))).toHaveLength(0);
    });

    it("does not flag identical score or source — only text matters", () => {
      const findings = DuplicateChunksRule.run(
        makeTrace([
          chunk("1", "Totally different content here.", 0.9, "same.md"),
          chunk("2", "Completely unrelated paragraph about astronomy.", 0.9, "same.md"),
        ]),
      );
      expect(findings).toHaveLength(0);
    });
  });
});

// ── LowRetrievalScoreRule ─────────────────────────────────────────────────────

describe("LowRetrievalScoreRule", () => {
  describe("positive — flags low scores", () => {
    it("flags when average score is below 0.5", () => {
      const findings = LowRetrievalScoreRule.run(
        makeTrace([chunk("1", "text", 0.3), chunk("2", "text", 0.2)]),
      );
      expect(findings).toHaveLength(1);
      expect(findings[0]?.severity).toBe("high");
      expect(findings[0]?.ruleId).toBe("low-retrieval-score");
    });

    it("message includes the computed average score", () => {
      const findings = LowRetrievalScoreRule.run(
        makeTrace([chunk("1", "t", 0.3), chunk("2", "t", 0.1)]),
      );
      expect(findings[0]?.message).toContain("0.2");
    });

    it("includes average score in details", () => {
      const findings = LowRetrievalScoreRule.run(
        makeTrace([chunk("1", "t", 0.3), chunk("2", "t", 0.1)]),
      );
      expect(findings[0]?.details?.["averageScore"]).toBe(0.2);
    });

    it("includes lowest scoring chunks in details", () => {
      const findings = LowRetrievalScoreRule.run(
        makeTrace([chunk("1", "t", 0.1), chunk("2", "t", 0.2), chunk("3", "t", 0.3)]),
      );
      const lowest = findings[0]?.details?.["lowestScoringChunks"] as Array<{ id: string }>;
      expect(lowest).toBeDefined();
      expect(lowest[0]?.id).toBe("1");
    });

    it("flags a single chunk with score 0", () => {
      const findings = LowRetrievalScoreRule.run(makeTrace([chunk("1", "text", 0)]));
      expect(findings).toHaveLength(1);
      expect(findings[0]?.severity).toBe("high");
    });
  });

  describe("negative — does not flag acceptable scores", () => {
    it("returns no findings when average is exactly 0.5", () => {
      const findings = LowRetrievalScoreRule.run(
        makeTrace([chunk("1", "t", 0.5), chunk("2", "t", 0.5)]),
      );
      expect(findings).toHaveLength(0);
    });

    it("returns no findings when average is above 0.5", () => {
      const findings = LowRetrievalScoreRule.run(
        makeTrace([chunk("1", "t", 0.8), chunk("2", "t", 0.9)]),
      );
      expect(findings).toHaveLength(0);
    });

    it("returns no findings when all scores are 1.0", () => {
      expect(
        LowRetrievalScoreRule.run(makeTrace([chunk("1", "t", 1.0), chunk("2", "t", 1.0)])),
      ).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("skips rule when no chunks have a score", () => {
      expect(
        LowRetrievalScoreRule.run(makeTrace([chunk("1", "t"), chunk("2", "t")])),
      ).toHaveLength(0);
    });

    it("skips rule for empty chunk list", () => {
      expect(LowRetrievalScoreRule.run(makeTrace([]))).toHaveLength(0);
    });

    it("only averages chunks that have scores, ignoring unscored chunks", () => {
      // scored chunk has 0.9 → average of scored chunks = 0.9 → no finding
      const findings = LowRetrievalScoreRule.run(
        makeTrace([chunk("1", "t", 0.9), chunk("2", "t")]),
      );
      expect(findings).toHaveLength(0);
    });

    it("fires when only scored chunks have low scores, even if others are unscored", () => {
      const findings = LowRetrievalScoreRule.run(
        makeTrace([chunk("1", "t", 0.1), chunk("2", "t")]),
      );
      expect(findings).toHaveLength(1);
    });

    it("mixed scores where some are high and some are very low → averages correctly", () => {
      // (0.9 + 0.1) / 2 = 0.5 → no finding
      const findings = LowRetrievalScoreRule.run(
        makeTrace([chunk("1", "t", 0.9), chunk("2", "t", 0.1)]),
      );
      expect(findings).toHaveLength(0);
    });

    it("details reports threshold of 0.5", () => {
      const findings = LowRetrievalScoreRule.run(makeTrace([chunk("1", "t", 0.2)]));
      expect(findings[0]?.details?.["threshold"]).toBe(0.5);
    });

    it("details reports the count of scored chunks evaluated", () => {
      const findings = LowRetrievalScoreRule.run(
        makeTrace([chunk("1", "t", 0.1), chunk("2", "t", 0.2), chunk("3", "t")]),
      );
      // only 2 out of 3 have scores
      expect(findings[0]?.details?.["chunksEvaluated"]).toBe(2);
    });
  });
});

// ── OversizedChunkRule ────────────────────────────────────────────────────────

describe("OversizedChunkRule", () => {
  describe("positive — flags oversized chunks", () => {
    it("flags a chunk of 1201 characters", () => {
      const findings = OversizedChunkRule.run(makeTrace([chunk("1", "a".repeat(1201))]));
      expect(findings).toHaveLength(1);
      expect(findings[0]?.severity).toBe("low");
      expect(findings[0]?.ruleId).toBe("oversized-chunk");
    });

    it("flags multiple oversized chunks in a single finding", () => {
      const findings = OversizedChunkRule.run(
        makeTrace([chunk("1", "a".repeat(1500)), chunk("2", "a".repeat(2000))]),
      );
      expect(findings).toHaveLength(1);
      const oversized = findings[0]?.details?.["oversizedChunks"] as Array<{ id: string; length: number }>;
      expect(oversized).toHaveLength(2);
    });

    it("includes chunk id and length in details", () => {
      const findings = OversizedChunkRule.run(makeTrace([chunk("bigone", "z".repeat(1500))]));
      const oversized = findings[0]?.details?.["oversizedChunks"] as Array<{ id: string; length: number }>;
      expect(oversized[0]?.id).toBe("bigone");
      expect(oversized[0]?.length).toBe(1500);
    });

    it("mentions count in the finding message", () => {
      const findings = OversizedChunkRule.run(
        makeTrace([chunk("1", "a".repeat(1300)), chunk("2", "b".repeat(1400))]),
      );
      expect(findings[0]?.message).toContain("2");
    });
  });

  describe("negative — does not flag acceptable chunks", () => {
    it("returns no findings for short chunks", () => {
      expect(OversizedChunkRule.run(makeTrace([chunk("1", "short text")]))).toHaveLength(0);
    });

    it("returns no findings for a chunk of exactly 1200 characters", () => {
      expect(OversizedChunkRule.run(makeTrace([chunk("1", "a".repeat(1200))]))).toHaveLength(0);
    });

    it("returns no findings for an empty chunk list", () => {
      expect(OversizedChunkRule.run(makeTrace([]))).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("returns no findings for an empty text chunk", () => {
      expect(OversizedChunkRule.run(makeTrace([chunk("1", "")]))).toHaveLength(0);
    });

    it("flags a chunk of 1199 characters? — no, threshold is 1200", () => {
      expect(OversizedChunkRule.run(makeTrace([chunk("1", "a".repeat(1199))]))).toHaveLength(0);
    });

    it("does not flag normal-sized chunks alongside oversized ones (single finding)", () => {
      const findings = OversizedChunkRule.run(
        makeTrace([chunk("1", "short"), chunk("2", "a".repeat(1500))]),
      );
      expect(findings).toHaveLength(1);
      const oversized = findings[0]?.details?.["oversizedChunks"] as unknown[];
      expect(oversized).toHaveLength(1);
    });

    it("details includes threshold value", () => {
      const findings = OversizedChunkRule.run(makeTrace([chunk("1", "a".repeat(1300))]));
      expect(findings[0]?.details?.["threshold"]).toBe(1200);
    });
  });
});

// ── ContextOverloadRule ───────────────────────────────────────────────────────

describe("ContextOverloadRule", () => {
  describe("positive — flags too many chunks", () => {
    it("flags 11 chunks with medium severity", () => {
      const chunks = Array.from({ length: 11 }, (_, i) => chunk(String(i), `Chunk ${i}`));
      const findings = ContextOverloadRule.run(makeTrace(chunks));
      expect(findings).toHaveLength(1);
      expect(findings[0]?.severity).toBe("medium");
      expect(findings[0]?.ruleId).toBe("context-overload");
    });

    it("flags 15 chunks", () => {
      const chunks = Array.from({ length: 15 }, (_, i) => chunk(String(i), `Chunk ${i}`));
      expect(ContextOverloadRule.run(makeTrace(chunks))).toHaveLength(1);
    });

    it("includes chunk count in the message", () => {
      const chunks = Array.from({ length: 12 }, (_, i) => chunk(String(i), `Chunk ${i}`));
      const findings = ContextOverloadRule.run(makeTrace(chunks));
      expect(findings[0]?.message).toContain("12");
    });

    it("details.chunkCount matches the actual count", () => {
      const chunks = Array.from({ length: 13 }, (_, i) => chunk(String(i), `Chunk ${i}`));
      const findings = ContextOverloadRule.run(makeTrace(chunks));
      expect(findings[0]?.details?.["chunkCount"]).toBe(13);
    });
  });

  describe("negative — does not flag acceptable counts", () => {
    it("returns no findings for exactly 10 chunks", () => {
      const chunks = Array.from({ length: 10 }, (_, i) => chunk(String(i), `Chunk ${i}`));
      expect(ContextOverloadRule.run(makeTrace(chunks))).toHaveLength(0);
    });

    it("returns no findings for fewer than 10 chunks", () => {
      const chunks = Array.from({ length: 5 }, (_, i) => chunk(String(i), `Chunk ${i}`));
      expect(ContextOverloadRule.run(makeTrace(chunks))).toHaveLength(0);
    });

    it("returns no findings for a single chunk", () => {
      expect(ContextOverloadRule.run(makeTrace([chunk("1", "text")]))).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("returns no findings for empty chunk list", () => {
      expect(ContextOverloadRule.run(makeTrace([]))).toHaveLength(0);
    });

    it("details includes threshold value of 10", () => {
      const chunks = Array.from({ length: 11 }, (_, i) => chunk(String(i), `Chunk ${i}`));
      const findings = ContextOverloadRule.run(makeTrace(chunks));
      expect(findings[0]?.details?.["threshold"]).toBe(10);
    });
  });
});

// ── defaultRules ──────────────────────────────────────────────────────────────

describe("defaultRules registry", () => {
  it("exports exactly 4 rules", () => {
    expect(defaultRules).toHaveLength(4);
  });

  it("all rules have unique ids", () => {
    const ids = defaultRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all rules have a non-empty name", () => {
    for (const rule of defaultRules) {
      expect(rule.name.length).toBeGreaterThan(0);
    }
  });

  it("all rules have a run function", () => {
    for (const rule of defaultRules) {
      expect(typeof rule.run).toBe("function");
    }
  });

  it("rule run() always returns an array", () => {
    const emptyTrace = makeTrace([]);
    for (const rule of defaultRules) {
      expect(Array.isArray(rule.run(emptyTrace))).toBe(true);
    }
  });

  it("contains duplicate-chunks rule", () => {
    expect(defaultRules.some((r) => r.id === "duplicate-chunks")).toBe(true);
  });

  it("contains low-retrieval-score rule", () => {
    expect(defaultRules.some((r) => r.id === "low-retrieval-score")).toBe(true);
  });

  it("contains oversized-chunk rule", () => {
    expect(defaultRules.some((r) => r.id === "oversized-chunk")).toBe(true);
  });

  it("contains context-overload rule", () => {
    expect(defaultRules.some((r) => r.id === "context-overload")).toBe(true);
  });
});

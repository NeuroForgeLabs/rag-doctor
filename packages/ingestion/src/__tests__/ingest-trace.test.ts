import { describe, it, expect } from "vitest";
import { ingestTrace } from "../ingest-trace.js";
import { TraceValidationError, TraceNormalizationError } from "../errors.js";
import type { NormalizedTrace } from "@rag-doctor/types";

// ── Valid raw input → canonical trace ────────────────────────────────────────

describe("ingestTrace — valid input", () => {
  it("returns a NormalizedTrace for minimal valid input", () => {
    const result = ingestTrace({ query: "What is Paris?", retrievedChunks: [] });
    expect(result).toMatchObject<Partial<NormalizedTrace>>({
      query: "What is Paris?",
      retrievedChunks: [],
    });
  });

  it("returns correct structure for full valid trace", () => {
    const result = ingestTrace({
      query: "  Capital of France?  ",
      retrievedChunks: [
        { id: "c1", text: "Paris is the capital.", score: 0.97, source: "geo.md" },
      ],
      finalAnswer: "Paris.",
      metadata: { model: "gpt-4" },
    });

    expect(result.query).toBe("Capital of France?");
    expect(result.retrievedChunks).toHaveLength(1);
    expect(result.retrievedChunks[0]?.score).toBe(0.97);
    expect(result.finalAnswer).toBe("Paris.");
    expect(result.metadata).toEqual({ model: "gpt-4" });
  });

  it("is deterministic — same input produces same output", () => {
    const input = {
      query: "Q",
      retrievedChunks: [{ id: "c1", text: "text", score: 0.5 }],
    };
    const r1 = ingestTrace(input);
    const r2 = ingestTrace(input);
    expect(r1).toEqual(r2);
  });

  it("trims query whitespace", () => {
    const result = ingestTrace({ query: "  hello  ", retrievedChunks: [] });
    expect(result.query).toBe("hello");
  });

  it("handles multiple chunks correctly", () => {
    const chunks = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      text: `chunk content ${i}`,
      score: 0.9 - i * 0.1,
    }));
    const result = ingestTrace({ query: "Q", retrievedChunks: chunks });
    expect(result.retrievedChunks).toHaveLength(5);
  });
});

// ── Invalid raw input → typed validation error ────────────────────────────────

describe("ingestTrace — invalid input throws TraceValidationError", () => {
  it("throws TraceValidationError for null input", () => {
    expect(() => ingestTrace(null)).toThrow(TraceValidationError);
  });

  it("throws TraceValidationError for missing query", () => {
    expect(() => ingestTrace({ retrievedChunks: [] })).toThrow(TraceValidationError);
  });

  it("throws TraceValidationError for missing retrievedChunks", () => {
    expect(() => ingestTrace({ query: "Q" })).toThrow(TraceValidationError);
  });

  it("throws TraceValidationError for wrong field types", () => {
    expect(() =>
      ingestTrace({ query: 42, retrievedChunks: [] }),
    ).toThrow(TraceValidationError);
  });

  it("throws TraceValidationError for bad chunk score type", () => {
    expect(() =>
      ingestTrace({
        query: "Q",
        retrievedChunks: [{ id: "c1", text: "text", score: "high" }],
      }),
    ).toThrow(TraceValidationError);
  });

  it("error carries field-level issues", () => {
    let caught: unknown;
    try {
      ingestTrace({ query: "", retrievedChunks: [] });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(TraceValidationError);
    const err = caught as TraceValidationError;
    expect(err.issues.length).toBeGreaterThan(0);
    expect(err.issues.some((i) => i.path === "query")).toBe(true);
  });

  it("toPayload() returns structured error JSON", () => {
    let caught: unknown;
    try {
      ingestTrace({ query: "Q", retrievedChunks: [{ text: "no-id" }] });
    } catch (err) {
      caught = err;
    }
    const err = caught as TraceValidationError;
    const payload = err.toPayload();
    expect(payload.code).toBe("INVALID_TRACE_SCHEMA");
    expect(Array.isArray(payload.issues)).toBe(true);
    expect(payload.issues.length).toBeGreaterThan(0);
  });

  it("does not throw TraceNormalizationError for structurally invalid input", () => {
    // validation should catch bad input before normalization
    let caught: unknown;
    try {
      ingestTrace({ query: 99, retrievedChunks: "bad" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(TraceValidationError);
    expect(caught).not.toBeInstanceOf(TraceNormalizationError);
  });
});

// ── Malformed parsed object cases ─────────────────────────────────────────────

describe("ingestTrace — malformed parsed object cases", () => {
  it("rejects plain string", () => {
    expect(() => ingestTrace("a string")).toThrow(TraceValidationError);
  });

  it("rejects numeric input", () => {
    expect(() => ingestTrace(42)).toThrow(TraceValidationError);
  });

  it("rejects array input", () => {
    expect(() => ingestTrace([])).toThrow(TraceValidationError);
  });

  it("rejects boolean input", () => {
    expect(() => ingestTrace(true)).toThrow(TraceValidationError);
  });

  it("rejects object with only unknown fields", () => {
    expect(() =>
      ingestTrace({ notAQuery: "bad", chunks: [{ content: "wrong" }] }),
    ).toThrow(TraceValidationError);
  });

  it("error for completely unknown object includes both missing fields", () => {
    let caught: TraceValidationError | undefined;
    try {
      ingestTrace({ notAQuery: "bad" });
    } catch (err) {
      if (err instanceof TraceValidationError) caught = err;
    }
    expect(caught).toBeDefined();
    const paths = caught!.issues.map((i) => i.path);
    expect(paths).toContain("query");
    expect(paths).toContain("retrievedChunks");
  });

  it("rejects chunks array containing nested arrays", () => {
    expect(() =>
      ingestTrace({ query: "Q", retrievedChunks: [[{ id: "c1", text: "nested" }]] }),
    ).toThrow(TraceValidationError);
  });
});

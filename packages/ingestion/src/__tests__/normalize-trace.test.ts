import { describe, it, expect } from "vitest";
import { normalizeTrace } from "../normalize-trace.js";
import { TraceNormalizationError } from "../errors.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function expectNormalizationError(input: unknown): TraceNormalizationError {
  let caught: unknown;
  try {
    normalizeTrace(input);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(TraceNormalizationError);
  return caught as TraceNormalizationError;
}

// ── Defaults and safe coercion ────────────────────────────────────────────────

describe("normalizeTrace — canonical output", () => {
  it("trims leading/trailing whitespace from query", () => {
    const trace = normalizeTrace({
      query: "  What is Paris?  ",
      retrievedChunks: [],
    });
    expect(trace.query).toBe("What is Paris?");
  });

  it("preserves query with no surrounding whitespace", () => {
    const trace = normalizeTrace({ query: "Q", retrievedChunks: [] });
    expect(trace.query).toBe("Q");
  });

  it("defaults retrievedChunks to [] when missing (defensive)", () => {
    // This case should have been caught by validator, but normalizer is defensive
    const raw = { query: "Q" };
    const trace = normalizeTrace(raw as unknown);
    expect(Array.isArray(trace.retrievedChunks)).toBe(true);
    expect(trace.retrievedChunks).toHaveLength(0);
  });

  it("produces stable canonical output for identical inputs", () => {
    const input = {
      query: "What is Paris?",
      retrievedChunks: [{ id: "c1", text: "Paris is the capital.", score: 0.9 }],
    };
    const t1 = normalizeTrace(input);
    const t2 = normalizeTrace(input);
    expect(t1).toEqual(t2);
  });

  it("output has only query and retrievedChunks for minimal trace", () => {
    const trace = normalizeTrace({ query: "Q", retrievedChunks: [] });
    expect(Object.keys(trace).sort()).toEqual(["query", "retrievedChunks"]);
  });
});

// ── Preserves valid optional fields ─────────────────────────────────────────

describe("normalizeTrace — preserves optional fields", () => {
  it("preserves finalAnswer when present", () => {
    const trace = normalizeTrace({
      query: "Q",
      retrievedChunks: [],
      finalAnswer: "Paris.",
    });
    expect(trace.finalAnswer).toBe("Paris.");
  });

  it("omits finalAnswer when absent", () => {
    const trace = normalizeTrace({ query: "Q", retrievedChunks: [] });
    expect("finalAnswer" in trace).toBe(false);
  });

  it("preserves metadata object", () => {
    const meta = { model: "gpt-4", tokens: 512 };
    const trace = normalizeTrace({ query: "Q", retrievedChunks: [], metadata: meta });
    expect(trace.metadata).toEqual(meta);
  });

  it("omits metadata when absent", () => {
    const trace = normalizeTrace({ query: "Q", retrievedChunks: [] });
    expect("metadata" in trace).toBe(false);
  });

  it("omits metadata when it is an array (invalid shape silently skipped)", () => {
    const trace = normalizeTrace({ query: "Q", retrievedChunks: [], metadata: ["bad"] });
    expect("metadata" in trace).toBe(false);
  });
});

// ── Chunk normalization ───────────────────────────────────────────────────────

describe("normalizeTrace — chunk normalization", () => {
  it("preserves chunk id and text as-is", () => {
    const trace = normalizeTrace({
      query: "Q",
      retrievedChunks: [{ id: "chunk-1", text: "Some content here." }],
    });
    expect(trace.retrievedChunks[0]?.id).toBe("chunk-1");
    expect(trace.retrievedChunks[0]?.text).toBe("Some content here.");
  });

  it("preserves chunk score when present", () => {
    const trace = normalizeTrace({
      query: "Q",
      retrievedChunks: [{ id: "c1", text: "text", score: 0.87 }],
    });
    expect(trace.retrievedChunks[0]?.score).toBe(0.87);
  });

  it("omits score from chunk output when not present in input", () => {
    const trace = normalizeTrace({
      query: "Q",
      retrievedChunks: [{ id: "c1", text: "text" }],
    });
    expect("score" in (trace.retrievedChunks[0] ?? {})).toBe(false);
  });

  it("preserves chunk source when present", () => {
    const trace = normalizeTrace({
      query: "Q",
      retrievedChunks: [{ id: "c1", text: "text", source: "docs/file.md" }],
    });
    expect(trace.retrievedChunks[0]?.source).toBe("docs/file.md");
  });

  it("omits source from chunk output when not present in input", () => {
    const trace = normalizeTrace({
      query: "Q",
      retrievedChunks: [{ id: "c1", text: "text" }],
    });
    expect("source" in (trace.retrievedChunks[0] ?? {})).toBe(false);
  });

  it("normalizes multiple chunks preserving order", () => {
    const trace = normalizeTrace({
      query: "Q",
      retrievedChunks: [
        { id: "c1", text: "first", score: 0.9 },
        { id: "c2", text: "second", score: 0.8 },
        { id: "c3", text: "third", score: 0.7 },
      ],
    });
    expect(trace.retrievedChunks).toHaveLength(3);
    expect(trace.retrievedChunks[0]?.id).toBe("c1");
    expect(trace.retrievedChunks[1]?.id).toBe("c2");
    expect(trace.retrievedChunks[2]?.id).toBe("c3");
  });

  it("does not trim or alter chunk text content", () => {
    const text = "  text with surrounding spaces  ";
    const trace = normalizeTrace({
      query: "Q",
      retrievedChunks: [{ id: "c1", text }],
    });
    expect(trace.retrievedChunks[0]?.text).toBe(text);
  });

  it("preserves score of 0", () => {
    const trace = normalizeTrace({
      query: "Q",
      retrievedChunks: [{ id: "c1", text: "text", score: 0 }],
    });
    expect(trace.retrievedChunks[0]?.score).toBe(0);
  });
});

// ── Does not over-coerce bad input ────────────────────────────────────────────

describe("normalizeTrace — does not over-coerce", () => {
  it("throws TraceNormalizationError for non-object root", () => {
    const err = expectNormalizationError("string-input");
    expect(err.name).toBe("TraceNormalizationError");
    expect(err.code).toBe("TRACE_NORMALIZATION_ERROR");
  });

  it("throws TraceNormalizationError for null root", () => {
    expectNormalizationError(null);
  });

  it("throws TraceNormalizationError for array root", () => {
    expectNormalizationError([]);
  });

  it("silently drops a chunk with invalid score type (non-finite skipped)", () => {
    // non-finite scores pass validateTrace but normalizer skips them defensively
    const trace = normalizeTrace({
      query: "Q",
      retrievedChunks: [{ id: "c1", text: "text", score: Infinity }],
    });
    expect("score" in (trace.retrievedChunks[0] ?? {})).toBe(false);
  });
});

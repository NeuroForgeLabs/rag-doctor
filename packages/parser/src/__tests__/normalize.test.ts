import { describe, it, expect } from "vitest";
import { normalizeTrace, ParseError } from "../index.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const minimalValid = {
  query: "What is the capital of France?",
  retrievedChunks: [],
};

const fullValid = {
  query: "How do I reset my password?",
  retrievedChunks: [
    { id: "1", text: "Go to account settings and click reset.", score: 0.88, source: "help.md" },
    { id: "2", text: "You will receive an email with a reset link.", score: 0.76 },
  ],
  finalAnswer: "Click reset in account settings.",
  metadata: { model: "gpt-4o", ts: 1700000000 },
};

// ── Positive cases ────────────────────────────────────────────────────────────

describe("normalizeTrace — positive cases", () => {
  it("accepts a minimal valid trace (query + empty chunks)", () => {
    const trace = normalizeTrace(minimalValid);
    expect(trace.query).toBe("What is the capital of France?");
    expect(trace.retrievedChunks).toHaveLength(0);
    expect(trace.finalAnswer).toBeUndefined();
    expect(trace.metadata).toBeUndefined();
  });

  it("accepts a full valid trace with all optional fields", () => {
    const trace = normalizeTrace(fullValid);
    expect(trace.query).toBe("How do I reset my password?");
    expect(trace.retrievedChunks).toHaveLength(2);
    expect(trace.finalAnswer).toBe("Click reset in account settings.");
    expect(trace.metadata?.["model"]).toBe("gpt-4o");
  });

  it("trims leading and trailing whitespace from query", () => {
    const trace = normalizeTrace({ ...minimalValid, query: "   hello world   " });
    expect(trace.query).toBe("hello world");
  });

  it("accepts a trace with multiple chunks", () => {
    const chunks = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      text: `Chunk text number ${i}`,
      score: 0.5 + i * 0.01,
    }));
    const trace = normalizeTrace({ query: "multi chunk query", retrievedChunks: chunks });
    expect(trace.retrievedChunks).toHaveLength(8);
  });

  it("accepts chunks where score and source are both absent", () => {
    const trace = normalizeTrace({
      query: "test",
      retrievedChunks: [{ id: "x", text: "some content" }],
    });
    expect(trace.retrievedChunks[0]?.score).toBeUndefined();
    expect(trace.retrievedChunks[0]?.source).toBeUndefined();
  });

  it("accepts chunks where only score is present", () => {
    const trace = normalizeTrace({
      query: "test",
      retrievedChunks: [{ id: "x", text: "hello", score: 0.5 }],
    });
    expect(trace.retrievedChunks[0]?.score).toBe(0.5);
    expect(trace.retrievedChunks[0]?.source).toBeUndefined();
  });

  it("accepts chunks where only source is present", () => {
    const trace = normalizeTrace({
      query: "test",
      retrievedChunks: [{ id: "x", text: "hello", source: "doc.md" }],
    });
    expect(trace.retrievedChunks[0]?.source).toBe("doc.md");
    expect(trace.retrievedChunks[0]?.score).toBeUndefined();
  });

  it("accepts score of exactly 0", () => {
    const trace = normalizeTrace({
      query: "test",
      retrievedChunks: [{ id: "x", text: "hello", score: 0 }],
    });
    expect(trace.retrievedChunks[0]?.score).toBe(0);
  });

  it("accepts score of exactly 1", () => {
    const trace = normalizeTrace({
      query: "test",
      retrievedChunks: [{ id: "x", text: "hello", score: 1 }],
    });
    expect(trace.retrievedChunks[0]?.score).toBe(1);
  });

  it("preserves chunk text verbatim (no trimming)", () => {
    const text = "  leading spaces in chunk  ";
    const trace = normalizeTrace({ query: "q", retrievedChunks: [{ id: "1", text }] });
    expect(trace.retrievedChunks[0]?.text).toBe(text);
  });

  it("passes through metadata fields unchanged", () => {
    const trace = normalizeTrace({
      ...minimalValid,
      metadata: { model: "gpt-4", version: 2, nested: { ok: true } },
    });
    expect(trace.metadata?.["model"]).toBe("gpt-4");
    expect(trace.metadata?.["version"]).toBe(2);
  });

  it("ignores metadata when it is not a plain object", () => {
    const trace = normalizeTrace({ ...minimalValid, metadata: null });
    expect(trace.metadata).toBeUndefined();
  });

  it("ignores metadata when it is an array", () => {
    const trace = normalizeTrace({ ...minimalValid, metadata: [1, 2, 3] });
    expect(trace.metadata).toBeUndefined();
  });

  it("accepts empty string for finalAnswer", () => {
    const trace = normalizeTrace({ ...minimalValid, finalAnswer: "" });
    expect(trace.finalAnswer).toBe("");
  });
});

// ── Negative cases — top-level shape ─────────────────────────────────────────

describe("normalizeTrace — negative cases (top-level)", () => {
  it("throws ParseError for a plain string input", () => {
    expect(() => normalizeTrace("not an object")).toThrow(ParseError);
  });

  it("throws ParseError for null", () => {
    expect(() => normalizeTrace(null)).toThrow(ParseError);
  });

  it("throws ParseError for an array", () => {
    expect(() => normalizeTrace([{ query: "test" }])).toThrow(ParseError);
  });

  it("throws ParseError for a number", () => {
    expect(() => normalizeTrace(42)).toThrow(ParseError);
  });

  it("throws ParseError for undefined", () => {
    expect(() => normalizeTrace(undefined)).toThrow(ParseError);
  });

  it("throws ParseError for boolean", () => {
    expect(() => normalizeTrace(true)).toThrow(ParseError);
  });
});

// ── Negative cases — query field ──────────────────────────────────────────────

describe("normalizeTrace — negative cases (query)", () => {
  it("throws ParseError when query is missing", () => {
    const err = catchParseError(() => normalizeTrace({ retrievedChunks: [] }));
    expect(err.field).toBe("query");
  });

  it("throws ParseError when query is a number", () => {
    const err = catchParseError(() => normalizeTrace({ query: 42, retrievedChunks: [] }));
    expect(err.field).toBe("query");
  });

  it("throws ParseError when query is null", () => {
    const err = catchParseError(() => normalizeTrace({ query: null, retrievedChunks: [] }));
    expect(err.field).toBe("query");
  });

  it("throws ParseError when query is an empty string", () => {
    const err = catchParseError(() => normalizeTrace({ query: "", retrievedChunks: [] }));
    expect(err.field).toBe("query");
  });

  it("throws ParseError when query is whitespace only", () => {
    const err = catchParseError(() => normalizeTrace({ query: "   \t\n  ", retrievedChunks: [] }));
    expect(err.field).toBe("query");
  });

  it("throws ParseError when query is an array", () => {
    const err = catchParseError(() => normalizeTrace({ query: ["hello"], retrievedChunks: [] }));
    expect(err.field).toBe("query");
  });

  it("error message mentions 'query'", () => {
    const err = catchParseError(() => normalizeTrace({ retrievedChunks: [] }));
    expect(err.message.toLowerCase()).toContain("query");
  });
});

// ── Negative cases — retrievedChunks field ────────────────────────────────────

describe("normalizeTrace — negative cases (retrievedChunks)", () => {
  it("throws ParseError when retrievedChunks is missing", () => {
    const err = catchParseError(() => normalizeTrace({ query: "test" }));
    expect(err.field).toBe("retrievedChunks");
  });

  it("throws ParseError when retrievedChunks is a string", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: "bad" }),
    );
    expect(err.field).toBe("retrievedChunks");
  });

  it("throws ParseError when retrievedChunks is an object", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: { id: "1" } }),
    );
    expect(err.field).toBe("retrievedChunks");
  });

  it("throws ParseError when retrievedChunks is null", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: null }),
    );
    expect(err.field).toBe("retrievedChunks");
  });

  it("throws ParseError when retrievedChunks is a number", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: 5 }),
    );
    expect(err.field).toBe("retrievedChunks");
  });
});

// ── Negative cases — chunk shape ──────────────────────────────────────────────

describe("normalizeTrace — negative cases (chunk fields)", () => {
  it("throws ParseError for chunk with missing id", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: [{ text: "hello" }] }),
    );
    expect(err.message).toContain("id");
  });

  it("throws ParseError for chunk with empty id", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: [{ id: "", text: "hello" }] }),
    );
    expect(err.message).toContain("id");
  });

  it("throws ParseError for chunk with numeric id", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: [{ id: 1, text: "hello" }] }),
    );
    expect(err.message).toContain("id");
  });

  it("throws ParseError for chunk with missing text", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: [{ id: "1" }] }),
    );
    expect(err.message).toContain("text");
  });

  it("throws ParseError for chunk where text is a number", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: [{ id: "1", text: 42 }] }),
    );
    expect(err.message).toContain("text");
  });

  it("throws ParseError for chunk where text is null", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: [{ id: "1", text: null }] }),
    );
    expect(err.message).toContain("text");
  });

  it("throws ParseError for chunk where score is a string", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: [{ id: "1", text: "hi", score: "0.9" }] }),
    );
    expect(err.message).toContain("score");
  });

  it("throws ParseError for chunk where score is Infinity", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: [{ id: "1", text: "hi", score: Infinity }] }),
    );
    expect(err.message).toContain("score");
  });

  it("throws ParseError for chunk where score is NaN", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: [{ id: "1", text: "hi", score: NaN }] }),
    );
    expect(err.message).toContain("score");
  });

  it("throws ParseError for chunk where source is a number", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: [{ id: "1", text: "hi", source: 99 }] }),
    );
    expect(err.message).toContain("source");
  });

  it("throws ParseError for a chunk that is a string, not an object", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: ["just a string"] }),
    );
    expect(err).toBeInstanceOf(ParseError);
  });

  it("throws ParseError for a chunk that is null", () => {
    expect(() =>
      normalizeTrace({ query: "test", retrievedChunks: [null] }),
    ).toThrow(ParseError);
  });

  it("error field points to the correct chunk index", () => {
    const err = catchParseError(() =>
      normalizeTrace({
        query: "test",
        retrievedChunks: [
          { id: "1", text: "ok" },
          { id: "2" }, // missing text
        ],
      }),
    );
    expect(err.message).toContain("[1]");
  });

  it("throws ParseError when finalAnswer is not a string", () => {
    const err = catchParseError(() =>
      normalizeTrace({ query: "test", retrievedChunks: [], finalAnswer: 42 }),
    );
    expect(err.field).toBe("finalAnswer");
  });
});

// ── ParseError properties ─────────────────────────────────────────────────────

describe("ParseError", () => {
  it("has name set to ParseError", () => {
    const err = catchParseError(() => normalizeTrace(null));
    expect(err.name).toBe("ParseError");
  });

  it("is an instance of Error", () => {
    const err = catchParseError(() => normalizeTrace(null));
    expect(err).toBeInstanceOf(Error);
  });

  it("has a human-readable message", () => {
    const err = catchParseError(() => normalizeTrace({ retrievedChunks: [] }));
    expect(typeof err.message).toBe("string");
    expect(err.message.length).toBeGreaterThan(0);
  });

  it("field is undefined for top-level shape errors", () => {
    const err = catchParseError(() => normalizeTrace("string"));
    expect(err.field).toBeUndefined();
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function catchParseError(fn: () => unknown): ParseError {
  try {
    fn();
    throw new Error("Expected ParseError but no error was thrown");
  } catch (err) {
    if (err instanceof ParseError) return err;
    throw err;
  }
}

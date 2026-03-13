import { describe, it, expect } from "vitest";
import { validateTrace } from "../validate-trace.js";
import { TraceValidationError } from "../errors.js";

// ── Helper ────────────────────────────────────────────────────────────────────

function getIssues(input: unknown): ReturnType<TraceValidationError["toPayload"]>["issues"] {
  try {
    validateTrace(input);
    return [];
  } catch (err) {
    if (err instanceof TraceValidationError) return err.issues;
    throw err;
  }
}

function expectValid(input: unknown): void {
  expect(() => validateTrace(input)).not.toThrow();
}

function expectInvalid(input: unknown): TraceValidationError {
  let caught: unknown;
  try {
    validateTrace(input);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(TraceValidationError);
  return caught as TraceValidationError;
}

// ── Valid traces ──────────────────────────────────────────────────────────────

describe("validateTrace — valid inputs", () => {
  it("accepts a minimal valid trace", () => {
    expectValid({
      query: "What is Paris?",
      retrievedChunks: [],
    });
  });

  it("accepts a trace with all optional fields", () => {
    expectValid({
      query: "What is Paris?",
      retrievedChunks: [
        { id: "c1", text: "Paris is the capital of France.", score: 0.97, source: "geo.md" },
      ],
      finalAnswer: "Paris.",
      metadata: { model: "gpt-4", timestamp: 1234567890 },
    });
  });

  it("accepts chunks without optional score and source", () => {
    expectValid({
      query: "What?",
      retrievedChunks: [{ id: "c1", text: "some text" }],
    });
  });

  it("accepts a score of exactly 0", () => {
    expectValid({
      query: "Q",
      retrievedChunks: [{ id: "c1", text: "text", score: 0 }],
    });
  });

  it("accepts a score of exactly 1", () => {
    expectValid({
      query: "Q",
      retrievedChunks: [{ id: "c1", text: "text", score: 1 }],
    });
  });

  it("accepts scores outside 0–1 (rules handle threshold logic, not validation)", () => {
    expectValid({
      query: "Q",
      retrievedChunks: [{ id: "c1", text: "text", score: 2.5 }],
    });
  });

  it("accepts a trace with metadata as an object", () => {
    expectValid({
      query: "Q",
      retrievedChunks: [],
      metadata: { nested: { deep: true } },
    });
  });

  it("accepts empty-string text in a chunk (oversized/empty-chunk rule handles this)", () => {
    expectValid({
      query: "Q",
      retrievedChunks: [{ id: "c1", text: "" }],
    });
  });

  it("accepts multiple valid chunks", () => {
    expectValid({
      query: "What is the capital of France?",
      retrievedChunks: [
        { id: "c1", text: "Paris is the capital.", score: 0.9 },
        { id: "c2", text: "France is in Europe.", score: 0.8 },
        { id: "c3", text: "Paris has the Eiffel Tower.", score: 0.75 },
      ],
    });
  });
});

// ── Missing required fields ───────────────────────────────────────────────────

describe("validateTrace — missing required fields", () => {
  it("rejects null input", () => {
    const err = expectInvalid(null);
    expect(err.issues[0]?.path).toBe("(root)");
    expect(err.issues[0]?.expected).toBe("object");
  });

  it("rejects array input", () => {
    const err = expectInvalid([]);
    expect(err.issues[0]?.path).toBe("(root)");
    expect(err.issues[0]?.received).toBe("array");
  });

  it("rejects string input", () => {
    const err = expectInvalid("not an object");
    expect(err.issues[0]?.path).toBe("(root)");
  });

  it("rejects missing query", () => {
    const issues = getIssues({ retrievedChunks: [] });
    const q = issues.find((i) => i.path === "query");
    expect(q).toBeDefined();
    expect(q?.received).toBe("missing");
  });

  it("rejects missing retrievedChunks", () => {
    const issues = getIssues({ query: "Q" });
    const c = issues.find((i) => i.path === "retrievedChunks");
    expect(c).toBeDefined();
    expect(c?.received).toBe("missing");
  });

  it("collects both missing query and missing retrievedChunks in one pass", () => {
    const issues = getIssues({});
    expect(issues.some((i) => i.path === "query")).toBe(true);
    expect(issues.some((i) => i.path === "retrievedChunks")).toBe(true);
  });

  it("rejects empty-string query", () => {
    const issues = getIssues({ query: "   ", retrievedChunks: [] });
    const q = issues.find((i) => i.path === "query");
    expect(q).toBeDefined();
    expect(q?.received).toBe("empty string");
  });
});

// ── Wrong primitive types ─────────────────────────────────────────────────────

describe("validateTrace — wrong primitive types", () => {
  it("rejects numeric query", () => {
    const issues = getIssues({ query: 42, retrievedChunks: [] });
    const q = issues.find((i) => i.path === "query");
    expect(q?.received).toBe("number");
  });

  it("rejects boolean query", () => {
    const issues = getIssues({ query: true, retrievedChunks: [] });
    const q = issues.find((i) => i.path === "query");
    expect(q?.received).toBe("boolean");
  });

  it("rejects non-string finalAnswer", () => {
    const issues = getIssues({ query: "Q", retrievedChunks: [], finalAnswer: 99 });
    const f = issues.find((i) => i.path === "finalAnswer");
    expect(f?.received).toBe("number");
  });

  it("rejects array metadata", () => {
    const issues = getIssues({ query: "Q", retrievedChunks: [], metadata: ["oops"] });
    const m = issues.find((i) => i.path === "metadata");
    expect(m?.received).toBe("array");
  });

  it("rejects non-array retrievedChunks", () => {
    const issues = getIssues({ query: "Q", retrievedChunks: "not-an-array" });
    const c = issues.find((i) => i.path === "retrievedChunks");
    expect(c?.received).toBe("string");
  });
});

// ── Malformed arrays / chunk objects ─────────────────────────────────────────

describe("validateTrace — malformed chunk arrays", () => {
  it("rejects a primitive in the chunks array", () => {
    const issues = getIssues({ query: "Q", retrievedChunks: ["not-an-object"] });
    expect(issues.some((i) => i.path === "retrievedChunks[0]")).toBe(true);
  });

  it("rejects null in the chunks array", () => {
    const issues = getIssues({ query: "Q", retrievedChunks: [null] });
    expect(issues.some((i) => i.path === "retrievedChunks[0]")).toBe(true);
  });

  it("rejects chunk with missing id", () => {
    const issues = getIssues({ query: "Q", retrievedChunks: [{ text: "hi" }] });
    expect(issues.some((i) => i.path === "retrievedChunks[0].id")).toBe(true);
  });

  it("rejects chunk with missing text", () => {
    const issues = getIssues({ query: "Q", retrievedChunks: [{ id: "c1" }] });
    expect(issues.some((i) => i.path === "retrievedChunks[0].text")).toBe(true);
  });

  it("rejects chunk with empty-string id", () => {
    const issues = getIssues({ query: "Q", retrievedChunks: [{ id: "  ", text: "hi" }] });
    const idIssue = issues.find((i) => i.path === "retrievedChunks[0].id");
    expect(idIssue?.received).toBe("empty string");
  });

  it("rejects chunk with string score", () => {
    const issues = getIssues({
      query: "Q",
      retrievedChunks: [{ id: "c1", text: "text", score: "0.9" }],
    });
    const s = issues.find((i) => i.path === "retrievedChunks[0].score");
    expect(s?.received).toBe("string");
  });

  it("rejects chunk with Infinity score", () => {
    const issues = getIssues({
      query: "Q",
      retrievedChunks: [{ id: "c1", text: "text", score: Infinity }],
    });
    const s = issues.find((i) => i.path === "retrievedChunks[0].score");
    expect(s?.received).toBe("Infinity");
  });

  it("rejects chunk with NaN score", () => {
    const issues = getIssues({
      query: "Q",
      retrievedChunks: [{ id: "c1", text: "text", score: NaN }],
    });
    const s = issues.find((i) => i.path === "retrievedChunks[0].score");
    expect(s).toBeDefined();
  });

  it("rejects chunk with numeric source", () => {
    const issues = getIssues({
      query: "Q",
      retrievedChunks: [{ id: "c1", text: "text", source: 42 }],
    });
    const s = issues.find((i) => i.path === "retrievedChunks[0].source");
    expect(s?.received).toBe("number");
  });

  it("collects issues across multiple bad chunks in one pass", () => {
    const issues = getIssues({
      query: "Q",
      retrievedChunks: [
        { id: "c1", text: "ok" },
        { text: "missing-id" },
        { id: "c3", text: "ok" },
        { id: "", text: "empty-id" },
      ],
    });
    expect(issues.some((i) => i.path === "retrievedChunks[1].id")).toBe(true);
    expect(issues.some((i) => i.path === "retrievedChunks[3].id")).toBe(true);
  });
});

// ── Error structure ───────────────────────────────────────────────────────────

describe("validateTrace — error structure", () => {
  it("TraceValidationError has the correct name", () => {
    const err = expectInvalid({});
    expect(err.name).toBe("TraceValidationError");
  });

  it("TraceValidationError has code TRACE_VALIDATION_ERROR", () => {
    const err = expectInvalid({});
    expect(err.code).toBe("TRACE_VALIDATION_ERROR");
  });

  it("toPayload returns structured payload with INVALID_TRACE_SCHEMA code", () => {
    const err = expectInvalid({ query: "Q", retrievedChunks: [{ text: "no-id" }] });
    const payload = err.toPayload();
    expect(payload.code).toBe("INVALID_TRACE_SCHEMA");
    expect(payload.message).toBe("Trace validation failed");
    expect(Array.isArray(payload.issues)).toBe(true);
    expect(payload.issues.length).toBeGreaterThan(0);
  });

  it("issues have path, expected, received fields", () => {
    const err = expectInvalid({ retrievedChunks: [] });
    for (const issue of err.issues) {
      expect(typeof issue.path).toBe("string");
      expect(typeof issue.expected).toBe("string");
      expect(typeof issue.received).toBe("string");
    }
  });
});

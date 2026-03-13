import { describe, it, expect } from "vitest";
import { adaptTrace, UnsupportedTraceFormatError, AdapterInputError } from "../index.js";

describe("adaptTrace", () => {
  // ── auto-detection ──────────────────────────────────────────────────────────

  it("auto-detects canonical format", () => {
    const result = adaptTrace({ query: "q", retrievedChunks: [] });
    expect(result.format).toBe("canonical");
  });

  it("auto-detects event-trace format", () => {
    const result = adaptTrace({
      events: [
        { type: "query.received", query: "q" },
        { type: "retrieval.completed", chunks: [] },
      ],
    });
    expect(result.format).toBe("event-trace");
  });

  it("auto-detects langchain format", () => {
    const result = adaptTrace({ input: "q", retrieverOutput: [] });
    expect(result.format).toBe("langchain");
  });

  it("auto-detects langsmith format", () => {
    const result = adaptTrace({
      run_type: "chain",
      inputs: { question: "q" },
      outputs: { answer: "a" },
    });
    expect(result.format).toBe("langsmith");
  });

  it("throws UnsupportedTraceFormatError for unknown format", () => {
    expect(() => adaptTrace({ unknown: true })).toThrow(UnsupportedTraceFormatError);
  });

  it("throws UnsupportedTraceFormatError for non-object input", () => {
    expect(() => adaptTrace("string")).toThrow(UnsupportedTraceFormatError);
  });

  // ── explicit format ─────────────────────────────────────────────────────────

  it("uses explicit format when provided", () => {
    const input = { query: "q", retrievedChunks: [] };
    const result = adaptTrace(input, { format: "canonical" });
    expect(result.format).toBe("canonical");
  });

  it("uses explicit langchain even if detection would match something else", () => {
    // This shape would be detected as canonical, but we force langchain
    // which should throw because "query" is not a langchain field
    expect(() =>
      adaptTrace({ query: "q", retrievedChunks: [] }, { format: "langchain" }),
    ).toThrow(AdapterInputError);
  });

  it("throws AdapterInputError when explicit format does not match shape", () => {
    expect(() =>
      adaptTrace({ events: [] }, { format: "langchain" }),
    ).toThrow(AdapterInputError);
  });

  it("throws UnsupportedTraceFormatError when format is 'unknown'", () => {
    expect(() =>
      adaptTrace({ anything: true }, { format: "unknown" }),
    ).toThrow(UnsupportedTraceFormatError);
  });

  // ── result structure ────────────────────────────────────────────────────────

  it("returns correct AdaptedTraceResult shape", () => {
    const result = adaptTrace({ query: "q", retrievedChunks: [] });
    expect(result).toHaveProperty("format");
    expect(result).toHaveProperty("adapter");
    expect(result).toHaveProperty("trace");
    expect(result).toHaveProperty("warnings");
    expect(typeof result.format).toBe("string");
    expect(typeof result.adapter).toBe("string");
    expect(typeof result.trace).toBe("object");
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  // ── error types ─────────────────────────────────────────────────────────────

  it("UnsupportedTraceFormatError has correct code", () => {
    let err: UnsupportedTraceFormatError | undefined;
    try { adaptTrace({}); } catch (e) {
      if (e instanceof UnsupportedTraceFormatError) err = e;
    }
    expect(err?.code).toBe("UNSUPPORTED_TRACE_FORMAT");
  });

  it("AdapterInputError has correct code and adapter name", () => {
    let err: AdapterInputError | undefined;
    try {
      adaptTrace({ input: 123, retrieverOutput: [] }, { format: "langchain" });
    } catch (e) {
      if (e instanceof AdapterInputError) err = e;
    }
    expect(err?.code).toBe("ADAPTER_INPUT_ERROR");
    expect(err?.adapter).toBe("langchain");
  });
});

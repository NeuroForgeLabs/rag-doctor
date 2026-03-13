import { describe, it, expect } from "vitest";
import { detectTraceFormat } from "../detect-format.js";

describe("detectTraceFormat", () => {
  // ── canonical ───────────────────────────────────────────────────────────────

  it("detects canonical format (query + retrievedChunks)", () => {
    expect(detectTraceFormat({ query: "test", retrievedChunks: [] })).toBe("canonical");
  });

  it("detects canonical even with extra fields", () => {
    expect(detectTraceFormat({ query: "q", retrievedChunks: [], finalAnswer: "a", metadata: {} })).toBe("canonical");
  });

  // ── event-trace ─────────────────────────────────────────────────────────────

  it("detects event-trace format (events array)", () => {
    expect(detectTraceFormat({ events: [{ type: "query.received" }] })).toBe("event-trace");
  });

  it("detects event-trace with empty events array", () => {
    expect(detectTraceFormat({ events: [] })).toBe("event-trace");
  });

  it("does not detect event-trace when events is not an array", () => {
    expect(detectTraceFormat({ events: "not-array" })).toBe("unknown");
  });

  // ── langchain ───────────────────────────────────────────────────────────────

  it("detects langchain format (input + retrieverOutput)", () => {
    expect(detectTraceFormat({ input: "q", retrieverOutput: [] })).toBe("langchain");
  });

  it("detects langchain with extra fields", () => {
    expect(detectTraceFormat({ input: "q", retrieverOutput: [], output: "a" })).toBe("langchain");
  });

  // ── langsmith ───────────────────────────────────────────────────────────────

  it("detects langsmith format (run_type + inputs + outputs)", () => {
    expect(detectTraceFormat({ run_type: "chain", inputs: {}, outputs: {} })).toBe("langsmith");
  });

  it("detects langsmith with extra fields", () => {
    expect(
      detectTraceFormat({ run_type: "chain", inputs: {}, outputs: {}, retrieval: {}, extra: {} }),
    ).toBe("langsmith");
  });

  // ── unknown ─────────────────────────────────────────────────────────────────

  it('returns "unknown" for empty object', () => {
    expect(detectTraceFormat({})).toBe("unknown");
  });

  it('returns "unknown" for unrecognized shape', () => {
    expect(detectTraceFormat({ totally: "unexpected" })).toBe("unknown");
  });

  it('returns "unknown" for null', () => {
    expect(detectTraceFormat(null)).toBe("unknown");
  });

  it('returns "unknown" for an array', () => {
    expect(detectTraceFormat([1, 2, 3])).toBe("unknown");
  });

  it('returns "unknown" for a string', () => {
    expect(detectTraceFormat("hello")).toBe("unknown");
  });

  it('returns "unknown" for a number', () => {
    expect(detectTraceFormat(42)).toBe("unknown");
  });

  // ── priority ────────────────────────────────────────────────────────────────

  it("canonical takes priority over langsmith when both match", () => {
    // Object has query+retrievedChunks AND run_type+inputs+outputs
    expect(
      detectTraceFormat({ query: "q", retrievedChunks: [], run_type: "chain", inputs: {}, outputs: {} }),
    ).toBe("canonical");
  });

  it("canonical takes priority over event-trace when both match", () => {
    expect(
      detectTraceFormat({ query: "q", retrievedChunks: [], events: [] }),
    ).toBe("canonical");
  });
});

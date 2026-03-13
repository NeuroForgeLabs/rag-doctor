import { describe, it, expect } from "vitest";
import { canonicalAdapter } from "../adapters/canonical.adapter.js";
import { eventTraceAdapter } from "../adapters/event-trace.adapter.js";
import { langchainAdapter } from "../adapters/langchain.adapter.js";
import { langsmithAdapter } from "../adapters/langsmith.adapter.js";
import { AdapterInputError } from "../errors.js";

// ── canonicalAdapter ──────────────────────────────────────────────────────────

describe("canonicalAdapter", () => {
  it("passes through a valid canonical trace", () => {
    const input = { query: "test", retrievedChunks: [{ id: "1", text: "t", score: 0.9 }] };
    const result = canonicalAdapter.adapt(input);
    expect(result.format).toBe("canonical");
    expect(result.trace["query"]).toBe("test");
    expect(result.warnings).toHaveLength(0);
  });

  it("preserves finalAnswer and metadata", () => {
    const input = { query: "q", retrievedChunks: [], finalAnswer: "a", metadata: { k: "v" } };
    const result = canonicalAdapter.adapt(input);
    expect(result.trace["finalAnswer"]).toBe("a");
    expect((result.trace["metadata"] as Record<string, unknown>)["k"]).toBe("v");
  });

  it("throws AdapterInputError for non-object input", () => {
    expect(() => canonicalAdapter.adapt("string")).toThrow(AdapterInputError);
    expect(() => canonicalAdapter.adapt(null)).toThrow(AdapterInputError);
    expect(() => canonicalAdapter.adapt([1])).toThrow(AdapterInputError);
  });

  it("throws AdapterInputError when query is missing", () => {
    expect(() => canonicalAdapter.adapt({ retrievedChunks: [] })).toThrow(AdapterInputError);
  });

  it("throws AdapterInputError when retrievedChunks is not an array", () => {
    expect(() => canonicalAdapter.adapt({ query: "q", retrievedChunks: "bad" })).toThrow(AdapterInputError);
  });
});

// ── eventTraceAdapter ─────────────────────────────────────────────────────────

describe("eventTraceAdapter", () => {
  const validInput = {
    events: [
      { type: "query.received", query: "What is RAG?" },
      { type: "retrieval.completed", chunks: [
        { id: "c1", text: "RAG is...", score: 0.91, source: "wiki" },
      ]},
      { type: "answer.generated", answer: "RAG is..." },
    ],
    metadata: { pipeline: "custom" },
  };

  it("maps events to canonical trace correctly", () => {
    const result = eventTraceAdapter.adapt(validInput);
    expect(result.format).toBe("event-trace");
    expect(result.trace["query"]).toBe("What is RAG?");
    expect((result.trace["retrievedChunks"] as unknown[]).length).toBe(1);
    expect(result.trace["finalAnswer"]).toBe("RAG is...");
  });

  it("merges existing metadata and adds sourceFormat", () => {
    const result = eventTraceAdapter.adapt(validInput);
    const meta = result.trace["metadata"] as Record<string, unknown>;
    expect(meta["pipeline"]).toBe("custom");
    expect(meta["sourceFormat"]).toBe("event-trace");
  });

  it("emits warning when answer event is missing", () => {
    const input = {
      events: [
        { type: "query.received", query: "q" },
        { type: "retrieval.completed", chunks: [] },
      ],
    };
    const result = eventTraceAdapter.adapt(input);
    expect(result.trace["finalAnswer"]).toBeUndefined();
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("answer.generated");
  });

  it("throws AdapterInputError when events is not array", () => {
    expect(() => eventTraceAdapter.adapt({ events: "bad" })).toThrow(AdapterInputError);
  });

  it("throws AdapterInputError when no query event", () => {
    expect(() => eventTraceAdapter.adapt({ events: [{ type: "retrieval.completed", chunks: [] }] })).toThrow(AdapterInputError);
  });

  it("throws AdapterInputError when no retrieval event", () => {
    expect(() => eventTraceAdapter.adapt({ events: [{ type: "query.received", query: "q" }] })).toThrow(AdapterInputError);
  });

  it("throws AdapterInputError for non-object input", () => {
    expect(() => eventTraceAdapter.adapt(null)).toThrow(AdapterInputError);
  });
});

// ── langchainAdapter ──────────────────────────────────────────────────────────

describe("langchainAdapter", () => {
  const validInput = {
    input: "How does chunking affect retrieval?",
    retrieverOutput: [
      { pageContent: "Smaller chunks improve precision.", metadata: { source: "doc-1" }, score: 0.72 },
      { pageContent: "Large chunks dilute relevance.", metadata: { source: "doc-2" }, score: 0.68 },
    ],
    output: "Chunking strongly influences quality.",
  };

  it("maps langchain fields to canonical trace", () => {
    const result = langchainAdapter.adapt(validInput);
    expect(result.format).toBe("langchain");
    expect(result.trace["query"]).toBe("How does chunking affect retrieval?");
    expect(result.trace["finalAnswer"]).toBe("Chunking strongly influences quality.");

    const chunks = result.trace["retrievedChunks"] as Record<string, unknown>[];
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.["text"]).toBe("Smaller chunks improve precision.");
    expect(chunks[0]?.["source"]).toBe("doc-1");
    expect(chunks[0]?.["score"]).toBe(0.72);
  });

  it("generates deterministic chunk IDs", () => {
    const result = langchainAdapter.adapt(validInput);
    const chunks = result.trace["retrievedChunks"] as Record<string, unknown>[];
    expect(chunks[0]?.["id"]).toBe("langchain-chunk-0");
    expect(chunks[1]?.["id"]).toBe("langchain-chunk-1");
  });

  it("emits warning about generated IDs", () => {
    const result = langchainAdapter.adapt(validInput);
    expect(result.warnings.some((w) => w.includes("Generated deterministic IDs"))).toBe(true);
  });

  it("sets sourceFormat in metadata", () => {
    const result = langchainAdapter.adapt(validInput);
    expect((result.trace["metadata"] as Record<string, unknown>)["sourceFormat"]).toBe("langchain");
  });

  it("handles missing output gracefully", () => {
    const input = { input: "q", retrieverOutput: [{ pageContent: "t" }] };
    const result = langchainAdapter.adapt(input);
    expect(result.trace["finalAnswer"]).toBeUndefined();
  });

  it("handles missing pageContent with warning", () => {
    const input = { input: "q", retrieverOutput: [{ score: 0.5 }] };
    const result = langchainAdapter.adapt(input);
    const chunks = result.trace["retrievedChunks"] as Record<string, unknown>[];
    expect(chunks[0]?.["text"]).toBe("");
    expect(result.warnings.some((w) => w.includes("pageContent"))).toBe(true);
  });

  it("handles missing metadata.source gracefully (no source set)", () => {
    const input = { input: "q", retrieverOutput: [{ pageContent: "t" }] };
    const result = langchainAdapter.adapt(input);
    const chunks = result.trace["retrievedChunks"] as Record<string, unknown>[];
    expect(chunks[0]?.["source"]).toBeUndefined();
  });

  it("throws AdapterInputError when input is not a string", () => {
    expect(() => langchainAdapter.adapt({ input: 123, retrieverOutput: [] })).toThrow(AdapterInputError);
  });

  it("throws AdapterInputError when retrieverOutput is not array", () => {
    expect(() => langchainAdapter.adapt({ input: "q", retrieverOutput: "bad" })).toThrow(AdapterInputError);
  });

  it("throws AdapterInputError for non-object items in retrieverOutput", () => {
    expect(() => langchainAdapter.adapt({ input: "q", retrieverOutput: ["bad"] })).toThrow(AdapterInputError);
  });

  it("is deterministic across calls", () => {
    const r1 = langchainAdapter.adapt(validInput);
    const r2 = langchainAdapter.adapt(validInput);
    expect(JSON.stringify(r1.trace)).toBe(JSON.stringify(r2.trace));
  });
});

// ── langsmithAdapter ──────────────────────────────────────────────────────────

describe("langsmithAdapter", () => {
  const validInput = {
    run_type: "chain",
    inputs: { question: "Why do duplicate chunks hurt RAG?" },
    outputs: { answer: "Duplicate chunks waste context." },
    retrieval: {
      documents: [
        { id: "doc-a", content: "Duplicate chunks repeat context.", score: 0.64, source: "guide" },
        { id: "doc-b", content: "They reduce diversity.", score: 0.59, source: "notes" },
      ],
    },
    extra: { project: "rag-eval" },
  };

  it("maps langsmith fields to canonical trace", () => {
    const result = langsmithAdapter.adapt(validInput);
    expect(result.format).toBe("langsmith");
    expect(result.trace["query"]).toBe("Why do duplicate chunks hurt RAG?");
    expect(result.trace["finalAnswer"]).toBe("Duplicate chunks waste context.");

    const chunks = result.trace["retrievedChunks"] as Record<string, unknown>[];
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.["id"]).toBe("doc-a");
    expect(chunks[0]?.["text"]).toBe("Duplicate chunks repeat context.");
    expect(chunks[0]?.["score"]).toBe(0.64);
    expect(chunks[0]?.["source"]).toBe("guide");
  });

  it("preserves existing document IDs", () => {
    const result = langsmithAdapter.adapt(validInput);
    const chunks = result.trace["retrievedChunks"] as Record<string, unknown>[];
    expect(chunks[0]?.["id"]).toBe("doc-a");
    expect(chunks[1]?.["id"]).toBe("doc-b");
  });

  it("generates deterministic IDs when missing", () => {
    const input = {
      ...validInput,
      retrieval: {
        documents: [{ content: "test", score: 0.5 }],
      },
    };
    const result = langsmithAdapter.adapt(input);
    const chunks = result.trace["retrievedChunks"] as Record<string, unknown>[];
    expect(chunks[0]?.["id"]).toBe("langsmith-chunk-0");
    expect(result.warnings.some((w) => w.includes("Generated deterministic IDs"))).toBe(true);
  });

  it("merges extra into metadata with sourceFormat", () => {
    const result = langsmithAdapter.adapt(validInput);
    const meta = result.trace["metadata"] as Record<string, unknown>;
    expect(meta["sourceFormat"]).toBe("langsmith");
    expect(meta["project"]).toBe("rag-eval");
  });

  it("warns when no retrieval.documents is present", () => {
    const input = {
      run_type: "chain",
      inputs: { question: "q" },
      outputs: { answer: "a" },
    };
    const result = langsmithAdapter.adapt(input);
    expect((result.trace["retrievedChunks"] as unknown[]).length).toBe(0);
    expect(result.warnings.some((w) => w.includes("retrieval.documents"))).toBe(true);
  });

  it("warns when outputs.answer is not a string", () => {
    const input = {
      run_type: "chain",
      inputs: { question: "q" },
      outputs: { answer: 123 },
      retrieval: { documents: [] },
    };
    const result = langsmithAdapter.adapt(input);
    expect(result.trace["finalAnswer"]).toBeUndefined();
    expect(result.warnings.some((w) => w.includes("outputs.answer"))).toBe(true);
  });

  it("throws AdapterInputError when run_type missing", () => {
    expect(() => langsmithAdapter.adapt({ inputs: {}, outputs: {} })).toThrow(AdapterInputError);
  });

  it("throws AdapterInputError when inputs is not an object", () => {
    expect(() => langsmithAdapter.adapt({ run_type: "chain", inputs: "bad", outputs: {} })).toThrow(AdapterInputError);
  });

  it("throws AdapterInputError when inputs.question is not a string", () => {
    expect(() =>
      langsmithAdapter.adapt({ run_type: "chain", inputs: { question: 42 }, outputs: {} }),
    ).toThrow(AdapterInputError);
  });

  it("throws AdapterInputError when outputs is not an object", () => {
    expect(() =>
      langsmithAdapter.adapt({ run_type: "chain", inputs: { question: "q" }, outputs: "bad" }),
    ).toThrow(AdapterInputError);
  });

  it("is deterministic across calls", () => {
    const r1 = langsmithAdapter.adapt(validInput);
    const r2 = langsmithAdapter.adapt(validInput);
    expect(JSON.stringify(r1.trace)).toBe(JSON.stringify(r2.trace));
  });
});

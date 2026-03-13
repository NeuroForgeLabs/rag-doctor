/**
 * Integration tests: adapted traces flow through @rag-doctor/ingestion successfully.
 */
import { describe, it, expect } from "vitest";
import { adaptTrace } from "../index.js";
import { ingestTrace } from "@rag-doctor/ingestion";

describe("adapters → ingestion integration", () => {
  it("canonical adapted trace ingests successfully", () => {
    const adapted = adaptTrace({
      query: "test query",
      retrievedChunks: [{ id: "1", text: "Some text", score: 0.8 }],
      finalAnswer: "Answer",
    });
    const trace = ingestTrace(adapted.trace);
    expect(trace.query).toBe("test query");
    expect(trace.retrievedChunks).toHaveLength(1);
  });

  it("event-trace adapted trace ingests successfully", () => {
    const adapted = adaptTrace({
      events: [
        { type: "query.received", query: "What is RAG?" },
        { type: "retrieval.completed", chunks: [
          { id: "c1", text: "RAG is Retrieval-Augmented Generation.", score: 0.91, source: "wiki" },
        ]},
        { type: "answer.generated", answer: "RAG combines retrieval and generation." },
      ],
    });
    const trace = ingestTrace(adapted.trace);
    expect(trace.query).toBe("What is RAG?");
    expect(trace.retrievedChunks).toHaveLength(1);
    expect(trace.finalAnswer).toBe("RAG combines retrieval and generation.");
  });

  it("langchain adapted trace ingests successfully", () => {
    const adapted = adaptTrace({
      input: "How does chunking work?",
      retrieverOutput: [
        { pageContent: "Chunking splits text.", metadata: { source: "doc-1" }, score: 0.72 },
      ],
      output: "Chunking splits documents into smaller pieces.",
    });
    const trace = ingestTrace(adapted.trace);
    expect(trace.query).toBe("How does chunking work?");
    expect(trace.retrievedChunks).toHaveLength(1);
    expect(trace.retrievedChunks[0]?.id).toBe("langchain-chunk-0");
    expect(trace.retrievedChunks[0]?.text).toBe("Chunking splits text.");
    expect(trace.retrievedChunks[0]?.source).toBe("doc-1");
  });

  it("langsmith adapted trace ingests successfully", () => {
    const adapted = adaptTrace({
      run_type: "chain",
      inputs: { question: "Why do duplicates hurt?" },
      outputs: { answer: "They waste context." },
      retrieval: {
        documents: [
          { id: "doc-a", content: "Duplicates repeat context.", score: 0.64, source: "guide" },
        ],
      },
    });
    const trace = ingestTrace(adapted.trace);
    expect(trace.query).toBe("Why do duplicates hurt?");
    expect(trace.retrievedChunks).toHaveLength(1);
    expect(trace.retrievedChunks[0]?.id).toBe("doc-a");
  });

  it("langsmith with empty retrieval ingests (empty chunks)", () => {
    const adapted = adaptTrace({
      run_type: "chain",
      inputs: { question: "minimal" },
      outputs: { answer: "yes" },
    });
    const trace = ingestTrace(adapted.trace);
    expect(trace.retrievedChunks).toHaveLength(0);
  });
});

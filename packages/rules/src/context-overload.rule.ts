import type { DiagnosticFinding, DiagnosticRule, NormalizedTrace } from "@rag-doctor/types";

const MAX_CHUNKS = 10;

/**
 * Detects when too many chunks are retrieved, which can overwhelm the LLM context
 * window and dilute the most relevant information.
 */
export const ContextOverloadRule: DiagnosticRule = {
  id: "context-overload",
  name: "Context Overload",

  run(trace: NormalizedTrace): DiagnosticFinding[] {
    const count = trace.retrievedChunks.length;

    if (count <= MAX_CHUNKS) {
      return [];
    }

    return [
      {
        ruleId: this.id,
        ruleName: this.name,
        severity: "medium",
        message: `${count} chunks retrieved (threshold: ${MAX_CHUNKS}). Too many chunks can cause the LLM to lose focus on the most relevant content ("lost in the middle" problem).`,
        recommendation:
          "Reduce the top-k retrieval parameter or add a reranking step to select only the most relevant chunks before sending to the LLM.",
        details: {
          chunkCount: count,
          threshold: MAX_CHUNKS,
        },
      },
    ];
  },
};

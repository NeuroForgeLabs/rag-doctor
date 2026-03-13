import type { DiagnosticFinding, DiagnosticRule, NormalizedTrace } from "@rag-doctor/types";

const MAX_CHUNK_LENGTH = 1200;

/**
 * Detects chunks whose text content exceeds the recommended maximum length.
 * Oversized chunks reduce the precision of retrieval and consume excess tokens.
 */
export const OversizedChunkRule: DiagnosticRule = {
  id: "oversized-chunk",
  name: "Oversized Chunk",

  run(trace: NormalizedTrace): DiagnosticFinding[] {
    const oversized = trace.retrievedChunks.filter(
      (c) => c.text.length > MAX_CHUNK_LENGTH,
    );

    if (oversized.length === 0) {
      return [];
    }

    return [
      {
        ruleId: this.id,
        ruleName: this.name,
        severity: "low",
        message: `${oversized.length} chunk(s) exceed ${MAX_CHUNK_LENGTH} characters. Large chunks reduce retrieval precision and inflate token usage.`,
        recommendation:
          "Split large documents into smaller overlapping chunks (200–500 tokens recommended). Use a recursive character splitter or semantic splitter.",
        details: {
          threshold: MAX_CHUNK_LENGTH,
          oversizedChunks: oversized.map((c) => ({
            id: c.id,
            length: c.text.length,
            source: c.source,
          })),
        },
      },
    ];
  },
};

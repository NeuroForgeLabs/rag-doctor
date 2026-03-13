import type { DiagnosticFinding, DiagnosticRule, NormalizedTrace } from "@rag-doctor/types";

/**
 * Computes the Jaccard similarity between two strings by tokenizing on whitespace.
 * Returns a value between 0 (no overlap) and 1 (identical token sets).
 */
function jaccardSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().split(/\s+/).filter((t) => t.length > 0));

  const setA = tokenize(a);
  const setB = tokenize(b);

  const intersection = new Set([...setA].filter((t) => setB.has(t)));
  const union = new Set([...setA, ...setB]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

const SIMILARITY_THRESHOLD = 0.8;

/**
 * Detects retrieved chunks whose text content is very similar to each other,
 * indicating redundant retrieval that wastes context window space.
 */
export const DuplicateChunksRule: DiagnosticRule = {
  id: "duplicate-chunks",
  name: "Duplicate Chunks",

  run(trace: NormalizedTrace): DiagnosticFinding[] {
    const findings: DiagnosticFinding[] = [];
    const chunks = trace.retrievedChunks;
    const duplicatePairs: Array<{ i: number; j: number; similarity: number }> = [];

    for (let i = 0; i < chunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        const chunkI = chunks[i];
        const chunkJ = chunks[j];
        if (!chunkI || !chunkJ) continue;

        const similarity = jaccardSimilarity(chunkI.text, chunkJ.text);
        if (similarity >= SIMILARITY_THRESHOLD) {
          duplicatePairs.push({ i, j, similarity });
        }
      }
    }

    if (duplicatePairs.length > 0) {
      findings.push({
        ruleId: this.id,
        ruleName: this.name,
        severity: "medium",
        message: `Found ${duplicatePairs.length} near-duplicate chunk pair(s). Redundant content wastes context window and dilutes relevance signals.`,
        recommendation:
          "Implement deduplication in your chunking pipeline or add a post-retrieval deduplication step (e.g. MMR, cosine dedup).",
        details: {
          duplicatePairs: duplicatePairs.map(({ i, j, similarity }) => ({
            chunkAId: chunks[i]?.id,
            chunkBId: chunks[j]?.id,
            similarity: Math.round(similarity * 100) / 100,
          })),
        },
      });
    }

    return findings;
  },
};

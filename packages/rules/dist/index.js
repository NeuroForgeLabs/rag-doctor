// src/duplicate-chunks.rule.ts
function jaccardSimilarity(a, b) {
  const tokenize = (s) => new Set(s.toLowerCase().split(/\s+/).filter((t) => t.length > 0));
  const setA = tokenize(a);
  const setB = tokenize(b);
  const intersection = new Set([...setA].filter((t) => setB.has(t)));
  const union = /* @__PURE__ */ new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}
var SIMILARITY_THRESHOLD = 0.8;
var DuplicateChunksRule = {
  id: "duplicate-chunks",
  name: "Duplicate Chunks",
  run(trace) {
    const findings = [];
    const chunks = trace.retrievedChunks;
    const duplicatePairs = [];
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
        recommendation: "Implement deduplication in your chunking pipeline or add a post-retrieval deduplication step (e.g. MMR, cosine dedup).",
        details: {
          duplicatePairs: duplicatePairs.map(({ i, j, similarity }) => ({
            chunkAId: chunks[i]?.id,
            chunkBId: chunks[j]?.id,
            similarity: Math.round(similarity * 100) / 100
          }))
        }
      });
    }
    return findings;
  }
};

// src/low-retrieval-score.rule.ts
var LOW_SCORE_THRESHOLD = 0.5;
var LowRetrievalScoreRule = {
  id: "low-retrieval-score",
  name: "Low Retrieval Score",
  run(trace) {
    const chunksWithScores = trace.retrievedChunks.filter(
      (c) => typeof c.score === "number"
    );
    if (chunksWithScores.length === 0) {
      return [];
    }
    const avgScore = chunksWithScores.reduce((sum, c) => sum + (c.score ?? 0), 0) / chunksWithScores.length;
    if (avgScore >= LOW_SCORE_THRESHOLD) {
      return [];
    }
    const lowestChunks = [...chunksWithScores].sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 3).map((c) => ({ id: c.id, score: c.score }));
    return [
      {
        ruleId: this.id,
        ruleName: this.name,
        severity: "high",
        message: `Average retrieval score is ${avgScore.toFixed(3)} (threshold: ${LOW_SCORE_THRESHOLD}). The retrieved chunks may not be semantically relevant to the query.`,
        recommendation: "Check your embedding model alignment with your domain. Consider fine-tuning embeddings, adding a reranker (e.g. Cohere Rerank, BGE), or improving your chunking strategy.",
        details: {
          averageScore: Math.round(avgScore * 1e3) / 1e3,
          threshold: LOW_SCORE_THRESHOLD,
          chunksEvaluated: chunksWithScores.length,
          lowestScoringChunks: lowestChunks
        }
      }
    ];
  }
};

// src/oversized-chunk.rule.ts
var MAX_CHUNK_LENGTH = 1200;
var OversizedChunkRule = {
  id: "oversized-chunk",
  name: "Oversized Chunk",
  run(trace) {
    const oversized = trace.retrievedChunks.filter(
      (c) => c.text.length > MAX_CHUNK_LENGTH
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
        recommendation: "Split large documents into smaller overlapping chunks (200\u2013500 tokens recommended). Use a recursive character splitter or semantic splitter.",
        details: {
          threshold: MAX_CHUNK_LENGTH,
          oversizedChunks: oversized.map((c) => ({
            id: c.id,
            length: c.text.length,
            source: c.source
          }))
        }
      }
    ];
  }
};

// src/context-overload.rule.ts
var MAX_CHUNKS = 10;
var ContextOverloadRule = {
  id: "context-overload",
  name: "Context Overload",
  run(trace) {
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
        recommendation: "Reduce the top-k retrieval parameter or add a reranking step to select only the most relevant chunks before sending to the LLM.",
        details: {
          chunkCount: count,
          threshold: MAX_CHUNKS
        }
      }
    ];
  }
};

// src/index.ts
var defaultRules = [
  DuplicateChunksRule,
  LowRetrievalScoreRule,
  OversizedChunkRule,
  ContextOverloadRule
];
export {
  ContextOverloadRule,
  DuplicateChunksRule,
  LowRetrievalScoreRule,
  OversizedChunkRule,
  defaultRules
};
//# sourceMappingURL=index.js.map
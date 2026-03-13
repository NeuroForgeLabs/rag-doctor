import type { DiagnosticFinding, DiagnosticRule, NormalizedTrace } from "@rag-doctor/types";

const LOW_SCORE_THRESHOLD = 0.5;

/**
 * Detects when retrieved chunks have low relevance scores on average,
 * suggesting the embedding model or retrieval query is poorly aligned.
 */
export const LowRetrievalScoreRule: DiagnosticRule = {
  id: "low-retrieval-score",
  name: "Low Retrieval Score",

  run(trace: NormalizedTrace): DiagnosticFinding[] {
    const chunksWithScores = trace.retrievedChunks.filter(
      (c) => typeof c.score === "number",
    );

    // Skip rule if no scores are present in the trace
    if (chunksWithScores.length === 0) {
      return [];
    }

    const avgScore =
      chunksWithScores.reduce((sum, c) => sum + (c.score ?? 0), 0) /
      chunksWithScores.length;

    if (avgScore >= LOW_SCORE_THRESHOLD) {
      return [];
    }

    const lowestChunks = [...chunksWithScores]
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .slice(0, 3)
      .map((c) => ({ id: c.id, score: c.score }));

    return [
      {
        ruleId: this.id,
        ruleName: this.name,
        severity: "high",
        message: `Average retrieval score is ${avgScore.toFixed(3)} (threshold: ${LOW_SCORE_THRESHOLD}). The retrieved chunks may not be semantically relevant to the query.`,
        recommendation:
          "Check your embedding model alignment with your domain. Consider fine-tuning embeddings, adding a reranker (e.g. Cohere Rerank, BGE), or improving your chunking strategy.",
        details: {
          averageScore: Math.round(avgScore * 1000) / 1000,
          threshold: LOW_SCORE_THRESHOLD,
          chunksEvaluated: chunksWithScores.length,
          lowestScoringChunks: lowestChunks,
        },
      },
    ];
  },
};

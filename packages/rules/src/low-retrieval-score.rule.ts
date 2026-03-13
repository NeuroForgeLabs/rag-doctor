import type { DiagnosticFinding, DiagnosticRule, NormalizedTrace } from "@rag-doctor/types";
import { RuleConfigurationError } from "./errors.js";

/** Configurable options for the LowRetrievalScoreRule */
export interface LowRetrievalScoreOptions {
  /**
   * Average score below which a HIGH finding is produced.
   * Must be >= 0 and <= 1.
   * @default 0.5
   */
  averageScoreThreshold: number;
}

const DEFAULTS: LowRetrievalScoreOptions = {
  averageScoreThreshold: 0.5,
};

/**
 * Validates LowRetrievalScoreOptions and throws RuleConfigurationError on invalid values.
 */
function validateOptions(opts: LowRetrievalScoreOptions): void {
  if (opts.averageScoreThreshold < 0 || opts.averageScoreThreshold > 1) {
    throw new RuleConfigurationError(
      "low-retrieval-score",
      "averageScoreThreshold",
      "must be >= 0 and <= 1",
    );
  }
}

/**
 * Creates a LowRetrievalScoreRule with the given options.
 * Options are merged with defaults — only overridden fields need to be specified.
 *
 * @throws {RuleConfigurationError} if options fail validation
 */
export function createLowRetrievalScoreRule(
  options?: Partial<LowRetrievalScoreOptions>,
): DiagnosticRule {
  const opts: LowRetrievalScoreOptions = { ...DEFAULTS, ...options };
  validateOptions(opts);

  const threshold = opts.averageScoreThreshold;

  return {
    id: "low-retrieval-score",
    name: "Low Retrieval Score",

    run(trace: NormalizedTrace): DiagnosticFinding[] {
      const chunksWithScores = trace.retrievedChunks.filter(
        (c) => typeof c.score === "number",
      );

      if (chunksWithScores.length === 0) {
        return [];
      }

      const avgScore =
        chunksWithScores.reduce((sum, c) => sum + (c.score ?? 0), 0) /
        chunksWithScores.length;

      if (avgScore >= threshold) {
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
          message: `Average retrieval score is ${avgScore.toFixed(3)} (threshold: ${threshold}). The retrieved chunks may not be semantically relevant to the query.`,
          recommendation:
            "Check your embedding model alignment with your domain. Consider fine-tuning embeddings, adding a reranker (e.g. Cohere Rerank, BGE), or improving your chunking strategy.",
          details: {
            averageScore: Math.round(avgScore * 1000) / 1000,
            threshold,
            chunksEvaluated: chunksWithScores.length,
            lowestScoringChunks: lowestChunks,
          },
        },
      ];
    },
  };
}

/**
 * Default LowRetrievalScoreRule instance (averageScoreThreshold: 0.5).
 * Preserved for backward compatibility.
 */
export const LowRetrievalScoreRule: DiagnosticRule = createLowRetrievalScoreRule();

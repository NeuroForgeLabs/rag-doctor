// src/errors.ts
var RuleConfigurationError = class extends Error {
  constructor(ruleId, optionKey, constraint) {
    super(`Rule "${ruleId}": invalid option "${optionKey}" \u2014 ${constraint}`);
    this.ruleId = ruleId;
    this.optionKey = optionKey;
    this.constraint = constraint;
    this.name = "RuleConfigurationError";
  }
  code = "RULE_CONFIGURATION_ERROR";
};

// src/duplicate-chunks.rule.ts
var DEFAULTS = {
  similarityThreshold: 0.8
};
function jaccardSimilarity(a, b) {
  const tokenize = (s) => new Set(s.toLowerCase().split(/\s+/).filter((t) => t.length > 0));
  const setA = tokenize(a);
  const setB = tokenize(b);
  const intersection = new Set([...setA].filter((t) => setB.has(t)));
  const union = /* @__PURE__ */ new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}
function validateOptions(opts) {
  if (opts.similarityThreshold <= 0 || opts.similarityThreshold > 1) {
    throw new RuleConfigurationError(
      "duplicate-chunks",
      "similarityThreshold",
      "must be > 0 and <= 1"
    );
  }
}
function createDuplicateChunksRule(options) {
  const opts = { ...DEFAULTS, ...options };
  validateOptions(opts);
  const threshold = opts.similarityThreshold;
  return {
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
          if (similarity >= threshold) {
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
            })),
            threshold
          }
        });
      }
      return findings;
    }
  };
}
var DuplicateChunksRule = createDuplicateChunksRule();

// src/low-retrieval-score.rule.ts
var DEFAULTS2 = {
  averageScoreThreshold: 0.5
};
function validateOptions2(opts) {
  if (opts.averageScoreThreshold < 0 || opts.averageScoreThreshold > 1) {
    throw new RuleConfigurationError(
      "low-retrieval-score",
      "averageScoreThreshold",
      "must be >= 0 and <= 1"
    );
  }
}
function createLowRetrievalScoreRule(options) {
  const opts = { ...DEFAULTS2, ...options };
  validateOptions2(opts);
  const threshold = opts.averageScoreThreshold;
  return {
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
      if (avgScore >= threshold) {
        return [];
      }
      const lowestChunks = [...chunksWithScores].sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 3).map((c) => ({ id: c.id, score: c.score }));
      return [
        {
          ruleId: this.id,
          ruleName: this.name,
          severity: "high",
          message: `Average retrieval score is ${avgScore.toFixed(3)} (threshold: ${threshold}). The retrieved chunks may not be semantically relevant to the query.`,
          recommendation: "Check your embedding model alignment with your domain. Consider fine-tuning embeddings, adding a reranker (e.g. Cohere Rerank, BGE), or improving your chunking strategy.",
          details: {
            averageScore: Math.round(avgScore * 1e3) / 1e3,
            threshold,
            chunksEvaluated: chunksWithScores.length,
            lowestScoringChunks: lowestChunks
          }
        }
      ];
    }
  };
}
var LowRetrievalScoreRule = createLowRetrievalScoreRule();

// src/oversized-chunk.rule.ts
var DEFAULTS3 = {
  maxChunkLength: 1200
};
function validateOptions3(opts) {
  if (!Number.isInteger(opts.maxChunkLength) || opts.maxChunkLength < 1) {
    throw new RuleConfigurationError(
      "oversized-chunk",
      "maxChunkLength",
      "must be a positive integer"
    );
  }
}
function createOversizedChunkRule(options) {
  const opts = { ...DEFAULTS3, ...options };
  validateOptions3(opts);
  const maxLength = opts.maxChunkLength;
  return {
    id: "oversized-chunk",
    name: "Oversized Chunk",
    run(trace) {
      const oversized = trace.retrievedChunks.filter((c) => c.text.length > maxLength);
      if (oversized.length === 0) {
        return [];
      }
      return [
        {
          ruleId: this.id,
          ruleName: this.name,
          severity: "low",
          message: `${oversized.length} chunk(s) exceed ${maxLength} characters. Large chunks reduce retrieval precision and inflate token usage.`,
          recommendation: "Split large documents into smaller overlapping chunks (200\u2013500 tokens recommended). Use a recursive character splitter or semantic splitter.",
          details: {
            threshold: maxLength,
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
}
var OversizedChunkRule = createOversizedChunkRule();

// src/context-overload.rule.ts
var DEFAULTS4 = {
  maxChunkCount: 10
};
function validateOptions4(opts) {
  if (!Number.isInteger(opts.maxChunkCount) || opts.maxChunkCount < 1) {
    throw new RuleConfigurationError(
      "context-overload",
      "maxChunkCount",
      "must be a positive integer"
    );
  }
}
function createContextOverloadRule(options) {
  const opts = { ...DEFAULTS4, ...options };
  validateOptions4(opts);
  const maxCount = opts.maxChunkCount;
  return {
    id: "context-overload",
    name: "Context Overload",
    run(trace) {
      const count = trace.retrievedChunks.length;
      if (count <= maxCount) {
        return [];
      }
      return [
        {
          ruleId: this.id,
          ruleName: this.name,
          severity: "medium",
          message: `${count} chunks retrieved (threshold: ${maxCount}). Too many chunks can cause the LLM to lose focus on the most relevant content ("lost in the middle" problem).`,
          recommendation: "Reduce the top-k retrieval parameter or add a reranking step to select only the most relevant chunks before sending to the LLM.",
          details: {
            chunkCount: count,
            threshold: maxCount
          }
        }
      ];
    }
  };
}
var ContextOverloadRule = createContextOverloadRule();

// src/packs.ts
function resolveBuiltinRules(ruleOptions) {
  return [
    createDuplicateChunksRule(
      ruleOptions?.["duplicate-chunks"]
    ),
    createLowRetrievalScoreRule(
      ruleOptions?.["low-retrieval-score"]
    ),
    createOversizedChunkRule(
      ruleOptions?.["oversized-chunk"]
    ),
    createContextOverloadRule(
      ruleOptions?.["context-overload"]
    )
  ];
}
var recommendedPack = {
  name: "recommended",
  description: "All built-in rules with balanced default thresholds. Suitable for most RAG pipelines.",
  resolve(ruleOptions) {
    return resolveBuiltinRules(ruleOptions);
  }
};
var strictPack = {
  name: "strict",
  description: "All built-in rules with tighter thresholds for higher-quality RAG pipelines.",
  resolve(ruleOptions) {
    const strictDefaults = {
      "duplicate-chunks": { similarityThreshold: 0.7 },
      "low-retrieval-score": { averageScoreThreshold: 0.6 },
      "oversized-chunk": { maxChunkLength: 1e3 },
      "context-overload": { maxChunkCount: 8 }
    };
    const merged = {};
    for (const ruleId of Object.keys(strictDefaults)) {
      merged[ruleId] = {
        ...strictDefaults[ruleId],
        ...ruleOptions?.[ruleId]
      };
    }
    return resolveBuiltinRules(merged);
  }
};
var BUILT_IN_PACKS = {
  recommended: recommendedPack,
  strict: strictPack
};

// src/index.ts
var defaultRules = [
  DuplicateChunksRule,
  LowRetrievalScoreRule,
  OversizedChunkRule,
  ContextOverloadRule
];
export {
  BUILT_IN_PACKS,
  ContextOverloadRule,
  DuplicateChunksRule,
  LowRetrievalScoreRule,
  OversizedChunkRule,
  RuleConfigurationError,
  createContextOverloadRule,
  createDuplicateChunksRule,
  createLowRetrievalScoreRule,
  createOversizedChunkRule,
  defaultRules,
  recommendedPack,
  strictPack
};
//# sourceMappingURL=index.js.map
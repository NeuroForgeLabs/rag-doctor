import type { DiagnosticRule, RulePack, RuleOptions } from "@rag-doctor/types";
import {
  createDuplicateChunksRule,
  type DuplicateChunksOptions,
} from "./duplicate-chunks.rule.js";
import {
  createLowRetrievalScoreRule,
  type LowRetrievalScoreOptions,
} from "./low-retrieval-score.rule.js";
import {
  createOversizedChunkRule,
  type OversizedChunkOptions,
} from "./oversized-chunk.rule.js";
import {
  createContextOverloadRule,
  type ContextOverloadOptions,
} from "./context-overload.rule.js";

/**
 * Resolves all four built-in rules from their factories, applying any
 * per-rule overrides from the supplied ruleOptions map.
 */
function resolveBuiltinRules(ruleOptions?: RuleOptions): DiagnosticRule[] {
  return [
    createDuplicateChunksRule(
      ruleOptions?.["duplicate-chunks"] as Partial<DuplicateChunksOptions> | undefined,
    ),
    createLowRetrievalScoreRule(
      ruleOptions?.["low-retrieval-score"] as Partial<LowRetrievalScoreOptions> | undefined,
    ),
    createOversizedChunkRule(
      ruleOptions?.["oversized-chunk"] as Partial<OversizedChunkOptions> | undefined,
    ),
    createContextOverloadRule(
      ruleOptions?.["context-overload"] as Partial<ContextOverloadOptions> | undefined,
    ),
  ];
}

/**
 * The "recommended" rule pack.
 *
 * Includes all four built-in rules with their default thresholds:
 * - duplicate-chunks:       similarityThreshold 0.8
 * - low-retrieval-score:    averageScoreThreshold 0.5
 * - oversized-chunk:        maxChunkLength 1200
 * - context-overload:       maxChunkCount 10
 */
export const recommendedPack: RulePack = {
  name: "recommended",
  description:
    "All built-in rules with balanced default thresholds. Suitable for most RAG pipelines.",

  resolve(ruleOptions?: RuleOptions): DiagnosticRule[] {
    return resolveBuiltinRules(ruleOptions);
  },
};

/**
 * The "strict" rule pack.
 *
 * Same rules as "recommended" but with tighter thresholds:
 * - duplicate-chunks:       similarityThreshold 0.7  (catches more near-duplicates)
 * - low-retrieval-score:    averageScoreThreshold 0.6 (requires higher average relevance)
 * - oversized-chunk:        maxChunkLength 1000       (enforces smaller chunks)
 * - context-overload:       maxChunkCount 8           (limits retrieved chunks more aggressively)
 *
 * Per-rule overrides in ruleOptions are applied on top of these strict defaults,
 * not on top of the recommended defaults.
 */
export const strictPack: RulePack = {
  name: "strict",
  description:
    "All built-in rules with tighter thresholds for higher-quality RAG pipelines.",

  resolve(ruleOptions?: RuleOptions): DiagnosticRule[] {
    const strictDefaults: RuleOptions = {
      "duplicate-chunks": { similarityThreshold: 0.7 },
      "low-retrieval-score": { averageScoreThreshold: 0.6 },
      "oversized-chunk": { maxChunkLength: 1000 },
      "context-overload": { maxChunkCount: 8 },
    };

    // Per-rule overrides take precedence over strict defaults
    const merged: RuleOptions = {};
    for (const ruleId of Object.keys(strictDefaults)) {
      merged[ruleId] = {
        ...strictDefaults[ruleId],
        ...ruleOptions?.[ruleId],
      };
    }

    return resolveBuiltinRules(merged);
  },
};

/**
 * Registry of all built-in rule packs, keyed by pack name.
 */
export const BUILT_IN_PACKS: Readonly<Record<string, RulePack>> = {
  recommended: recommendedPack,
  strict: strictPack,
};

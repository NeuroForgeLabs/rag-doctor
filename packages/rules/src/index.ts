// ── Rule instances (backward-compatible exports) ──────────────────────────────
export { DuplicateChunksRule } from "./duplicate-chunks.rule.js";
export { LowRetrievalScoreRule } from "./low-retrieval-score.rule.js";
export { OversizedChunkRule } from "./oversized-chunk.rule.js";
export { ContextOverloadRule } from "./context-overload.rule.js";

// ── Rule factories ────────────────────────────────────────────────────────────
export { createDuplicateChunksRule } from "./duplicate-chunks.rule.js";
export { createLowRetrievalScoreRule } from "./low-retrieval-score.rule.js";
export { createOversizedChunkRule } from "./oversized-chunk.rule.js";
export { createContextOverloadRule } from "./context-overload.rule.js";

// ── Rule options types ────────────────────────────────────────────────────────
export type { DuplicateChunksOptions } from "./duplicate-chunks.rule.js";
export type { LowRetrievalScoreOptions } from "./low-retrieval-score.rule.js";
export type { OversizedChunkOptions } from "./oversized-chunk.rule.js";
export type { ContextOverloadOptions } from "./context-overload.rule.js";

// ── Error types ───────────────────────────────────────────────────────────────
export { RuleConfigurationError } from "./errors.js";

// ── Rule packs ────────────────────────────────────────────────────────────────
export { recommendedPack, strictPack, BUILT_IN_PACKS } from "./packs.js";

// ── Default rules array ───────────────────────────────────────────────────────
import type { DiagnosticRule } from "@rag-doctor/types";
import { DuplicateChunksRule } from "./duplicate-chunks.rule.js";
import { LowRetrievalScoreRule } from "./low-retrieval-score.rule.js";
import { OversizedChunkRule } from "./oversized-chunk.rule.js";
import { ContextOverloadRule } from "./context-overload.rule.js";

/**
 * The default set of built-in diagnostic rules shipped with RAG Doctor.
 * All rules use their default thresholds.
 *
 * To customize thresholds, use the factory functions or rule packs instead:
 * @example
 * ```ts
 * import { createLowRetrievalScoreRule, recommendedPack } from "@rag-doctor/rules";
 *
 * // Custom threshold via factory
 * const strictScoreRule = createLowRetrievalScoreRule({ averageScoreThreshold: 0.6 });
 *
 * // Or use a named pack
 * const rules = recommendedPack.resolve({ "low-retrieval-score": { averageScoreThreshold: 0.6 } });
 * ```
 */
export const defaultRules: DiagnosticRule[] = [
  DuplicateChunksRule,
  LowRetrievalScoreRule,
  OversizedChunkRule,
  ContextOverloadRule,
];

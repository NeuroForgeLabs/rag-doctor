export { DuplicateChunksRule } from "./duplicate-chunks.rule.js";
export { LowRetrievalScoreRule } from "./low-retrieval-score.rule.js";
export { OversizedChunkRule } from "./oversized-chunk.rule.js";
export { ContextOverloadRule } from "./context-overload.rule.js";

import type { DiagnosticRule } from "@rag-doctor/types";
import { DuplicateChunksRule } from "./duplicate-chunks.rule.js";
import { LowRetrievalScoreRule } from "./low-retrieval-score.rule.js";
import { OversizedChunkRule } from "./oversized-chunk.rule.js";
import { ContextOverloadRule } from "./context-overload.rule.js";

/**
 * The default set of built-in diagnostic rules shipped with RAG Doctor.
 * Pass this array to the core engine, or extend it with your own rules.
 */
export const defaultRules: DiagnosticRule[] = [
  DuplicateChunksRule,
  LowRetrievalScoreRule,
  OversizedChunkRule,
  ContextOverloadRule,
];

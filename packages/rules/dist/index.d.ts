import { DiagnosticRule } from '@rag-doctor/types';

/**
 * Detects retrieved chunks whose text content is very similar to each other,
 * indicating redundant retrieval that wastes context window space.
 */
declare const DuplicateChunksRule: DiagnosticRule;

/**
 * Detects when retrieved chunks have low relevance scores on average,
 * suggesting the embedding model or retrieval query is poorly aligned.
 */
declare const LowRetrievalScoreRule: DiagnosticRule;

/**
 * Detects chunks whose text content exceeds the recommended maximum length.
 * Oversized chunks reduce the precision of retrieval and consume excess tokens.
 */
declare const OversizedChunkRule: DiagnosticRule;

/**
 * Detects when too many chunks are retrieved, which can overwhelm the LLM context
 * window and dilute the most relevant information.
 */
declare const ContextOverloadRule: DiagnosticRule;

/**
 * The default set of built-in diagnostic rules shipped with RAG Doctor.
 * Pass this array to the core engine, or extend it with your own rules.
 */
declare const defaultRules: DiagnosticRule[];

export { ContextOverloadRule, DuplicateChunksRule, LowRetrievalScoreRule, OversizedChunkRule, defaultRules };

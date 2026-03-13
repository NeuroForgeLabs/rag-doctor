/**
 * @rag-doctor/ingestion
 *
 * Pure, deterministic trace ingestion pipeline.
 *
 * Validates raw JSON input against the trace schema and normalizes it into
 * canonical `NormalizedTrace` form. Designed to be embedded in CLI, SDK,
 * CI integrations, and other consumers without any Node.js runtime dependencies.
 *
 * @example
 * ```ts
 * import { ingestTrace, TraceValidationError } from "@rag-doctor/ingestion";
 *
 * try {
 *   const trace = ingestTrace(JSON.parse(rawJson));
 * } catch (err) {
 *   if (err instanceof TraceValidationError) {
 *     console.error(err.toPayload());
 *   }
 * }
 * ```
 */

export { ingestTrace } from "./ingest-trace.js";
export { validateTrace } from "./validate-trace.js";
export { normalizeTrace } from "./normalize-trace.js";
export { TraceParseError, TraceValidationError, TraceNormalizationError } from "./errors.js";
export type {
  RawTraceInput,
  ValidationIssue,
  ValidationErrorPayload,
  IngestionResult,
} from "./ingestion-types.js";

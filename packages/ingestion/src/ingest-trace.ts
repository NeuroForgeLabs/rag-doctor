import type { NormalizedTrace } from "@rag-doctor/types";
import type { RawTraceInput } from "./ingestion-types.js";
import { validateTrace } from "./validate-trace.js";
import { normalizeTrace } from "./normalize-trace.js";

/**
 * The shared ingestion pipeline for both CLI commands and future SDK consumers.
 *
 * Accepts arbitrary parsed JSON input, runs full schema validation, then
 * produces a canonical `NormalizedTrace`. Both steps are pure and deterministic.
 *
 * Error taxonomy:
 * - `TraceValidationError` — schema shape is invalid (field-level issues attached)
 * - `TraceNormalizationError` — post-validation normalization encountered an
 *    irrecoverable inconsistency (should be rare given a passing validation)
 *
 * The caller is responsible for JSON parsing; `TraceParseError` is provided
 * for wrappers that also handle the JSON.parse step.
 *
 * @example
 * ```ts
 * import { ingestTrace } from "@rag-doctor/ingestion";
 *
 * const raw = JSON.parse(fs.readFileSync("trace.json", "utf-8"));
 * const trace = ingestTrace(raw); // throws TraceValidationError on bad input
 * const result = analyzeTrace(trace);
 * ```
 *
 * @throws {TraceValidationError} when the input does not match the trace schema
 * @throws {TraceNormalizationError} when a validated trace cannot be normalized
 */
export function ingestTrace(input: RawTraceInput): NormalizedTrace {
  validateTrace(input);
  return normalizeTrace(input);
}

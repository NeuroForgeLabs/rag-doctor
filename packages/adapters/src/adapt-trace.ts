import type { AdaptOptions, AdaptedTraceResult, TraceAdapter, TraceFormat } from "./adapter-types.js";
import { detectTraceFormat } from "./detect-format.js";
import { UnsupportedTraceFormatError } from "./errors.js";
import { canonicalAdapter } from "./adapters/canonical.adapter.js";
import { eventTraceAdapter } from "./adapters/event-trace.adapter.js";
import { langchainAdapter } from "./adapters/langchain.adapter.js";
import { langsmithAdapter } from "./adapters/langsmith.adapter.js";

/**
 * Registry of all built-in adapters, keyed by format name.
 */
const ADAPTERS: Readonly<Record<string, TraceAdapter>> = {
  canonical: canonicalAdapter,
  "event-trace": eventTraceAdapter,
  langchain: langchainAdapter,
  langsmith: langsmithAdapter,
};

/**
 * Adapt an external trace into RAG Doctor's canonical raw trace shape.
 *
 * Behavior:
 * - If `options.format` is provided, the named adapter is used directly.
 * - If `options.format` is omitted, auto-detection picks the adapter.
 * - If detection returns "unknown", throws `UnsupportedTraceFormatError`.
 * - If the named adapter rejects the input shape, throws `AdapterInputError`.
 *
 * The returned `trace` object is ready to be passed to `ingestTrace()` from
 * `@rag-doctor/ingestion` for schema validation and normalization.
 *
 * @throws {UnsupportedTraceFormatError} when format cannot be detected or is "unknown"
 * @throws {AdapterInputError} when the adapter rejects the input shape
 */
export function adaptTrace(input: unknown, options?: AdaptOptions): AdaptedTraceResult {
  let format: TraceFormat;

  if (options?.format !== undefined && options.format !== "unknown") {
    format = options.format;
  } else {
    format = detectTraceFormat(input);
  }

  if (format === "unknown") {
    throw new UnsupportedTraceFormatError();
  }

  const adapter = ADAPTERS[format];
  if (!adapter) {
    throw new UnsupportedTraceFormatError(`No adapter registered for format "${format}".`);
  }

  return adapter.adapt(input);
}

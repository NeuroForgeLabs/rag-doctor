/**
 * Recognized external trace formats.
 * "unknown" means the format could not be detected.
 */
type TraceFormat = "canonical" | "event-trace" | "langchain" | "langsmith" | "unknown";
/**
 * The result of adapting an external trace into canonical form.
 */
interface AdaptedTraceResult {
    /** The detected or explicitly requested format */
    format: TraceFormat;
    /** The adapter identifier that performed the conversion */
    adapter: string;
    /** The canonical raw trace object ready for @rag-doctor/ingestion */
    trace: Record<string, unknown>;
    /** Human-readable warnings about lossy conversions or generated fields */
    warnings: string[];
}
/**
 * Options for adaptTrace().
 */
interface AdaptOptions {
    /**
     * Explicitly request a specific adapter instead of auto-detecting.
     * When set, format detection is skipped and the named adapter is used directly.
     */
    format?: TraceFormat;
}
/**
 * A single trace adapter that converts an external format into canonical form.
 */
interface TraceAdapter {
    /** The format this adapter handles */
    format: TraceFormat;
    /** Human-readable adapter name */
    name: string;
    /**
     * Adapt the external input into canonical raw trace.
     * @throws {AdapterInputError} if the input shape is malformed for this format
     */
    adapt(input: unknown): AdaptedTraceResult;
}

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
declare function adaptTrace(input: unknown, options?: AdaptOptions): AdaptedTraceResult;

/**
 * Deterministic heuristic format detection.
 *
 * Inspects the top-level keys of the parsed JSON object to identify
 * the most likely trace format. Returns "unknown" if no format matches.
 *
 * Detection order (first match wins):
 * 1. canonical — has `query` AND `retrievedChunks`
 * 2. event-trace — has `events` array
 * 3. langchain — has `input` AND `retrieverOutput`
 * 4. langsmith — has `run_type` AND `inputs` AND `outputs`
 */
declare function detectTraceFormat(input: unknown): TraceFormat;

/**
 * Thrown when the input format cannot be detected or is not supported.
 */
declare class UnsupportedTraceFormatError extends Error {
    readonly code: "UNSUPPORTED_TRACE_FORMAT";
    constructor(message?: string);
}
/**
 * Thrown when input is detected (or explicitly declared) as a specific format
 * but does not match the expected shape for that adapter.
 */
declare class AdapterInputError extends Error {
    /** The adapter/format that rejected the input */
    readonly adapter: string;
    readonly code: "ADAPTER_INPUT_ERROR";
    constructor(
    /** The adapter/format that rejected the input */
    adapter: string, 
    /** What went wrong */
    message: string);
}

/**
 * Canonical adapter — pass-through with minimal transformation.
 * Input already matches RAG Doctor's expected shape.
 */
declare const canonicalAdapter: TraceAdapter;

/**
 * Event-trace adapter — converts a generic event-based trace format.
 *
 * Expected shape:
 * {
 *   events: [
 *     { type: "query.received", query: "..." },
 *     { type: "retrieval.completed", chunks: [...] },
 *     { type: "answer.generated", answer: "..." }
 *   ],
 *   metadata?: { ... }
 * }
 */
declare const eventTraceAdapter: TraceAdapter;

/**
 * LangChain adapter — converts a simplified LangChain-style trace.
 *
 * Expected shape:
 * {
 *   input: "...",
 *   retrieverOutput: [{ pageContent: "...", metadata?: { source: "..." }, score?: number }],
 *   output?: "..."
 * }
 */
declare const langchainAdapter: TraceAdapter;

/**
 * LangSmith adapter — converts a simplified LangSmith-inspired trace.
 *
 * Expected shape:
 * {
 *   run_type: "chain",
 *   inputs: { question: "..." },
 *   outputs: { answer: "..." },
 *   retrieval?: { documents: [{ id?, content, score?, source? }] },
 *   extra?: { ... }
 * }
 */
declare const langsmithAdapter: TraceAdapter;

export { type AdaptOptions, type AdaptedTraceResult, AdapterInputError, type TraceAdapter, type TraceFormat, UnsupportedTraceFormatError, adaptTrace, canonicalAdapter, detectTraceFormat, eventTraceAdapter, langchainAdapter, langsmithAdapter };

/**
 * Recognized external trace formats.
 * "unknown" means the format could not be detected.
 */
export type TraceFormat =
  | "canonical"
  | "event-trace"
  | "langchain"
  | "langsmith"
  | "unknown";

/**
 * The result of adapting an external trace into canonical form.
 */
export interface AdaptedTraceResult {
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
export interface AdaptOptions {
  /**
   * Explicitly request a specific adapter instead of auto-detecting.
   * When set, format detection is skipped and the named adapter is used directly.
   */
  format?: TraceFormat;
}

/**
 * A single trace adapter that converts an external format into canonical form.
 */
export interface TraceAdapter {
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

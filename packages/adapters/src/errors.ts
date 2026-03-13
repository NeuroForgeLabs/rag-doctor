/**
 * Thrown when the input format cannot be detected or is not supported.
 */
export class UnsupportedTraceFormatError extends Error {
  public readonly code = "UNSUPPORTED_TRACE_FORMAT" as const;

  constructor(message?: string) {
    super(message ?? "Could not detect trace format. Supported formats: canonical, event-trace, langchain, langsmith.");
    this.name = "UnsupportedTraceFormatError";
  }
}

/**
 * Thrown when input is detected (or explicitly declared) as a specific format
 * but does not match the expected shape for that adapter.
 */
export class AdapterInputError extends Error {
  public readonly code = "ADAPTER_INPUT_ERROR" as const;

  constructor(
    /** The adapter/format that rejected the input */
    public readonly adapter: string,
    /** What went wrong */
    message: string,
  ) {
    super(`Adapter "${adapter}": ${message}`);
    this.name = "AdapterInputError";
  }
}

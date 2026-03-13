/**
 * Custom error type for trace parsing failures.
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Asserts that a value is a non-null object.
 */
function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ParseError(`Expected an object for "${label}", got ${typeof value}`, label);
  }
}

/**
 * Asserts that a value is a non-empty string.
 */
function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string") {
    throw new ParseError(`Expected a string for "${label}", got ${typeof value}`, label);
  }
  if (value.trim().length === 0) {
    throw new ParseError(`"${label}" must not be empty`, label);
  }
}

/**
 * Asserts that a value is an array.
 */
function assertArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new ParseError(`Expected an array for "${label}", got ${typeof value}`, label);
  }
}

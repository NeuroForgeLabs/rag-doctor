import { NormalizedTrace } from '@rag-doctor/types';

/**
 * Normalizes an arbitrary input object into a validated NormalizedTrace.
 *
 * @throws {ParseError} when required fields are missing or have invalid types.
 *
 * @example
 * ```ts
 * const trace = normalizeTrace(JSON.parse(fs.readFileSync("trace.json", "utf8")));
 * ```
 */
declare function normalizeTrace(input: unknown): NormalizedTrace;

/**
 * Custom error type for trace parsing failures.
 */
declare class ParseError extends Error {
    readonly field?: string | undefined;
    constructor(message: string, field?: string | undefined);
}

export { ParseError, normalizeTrace };

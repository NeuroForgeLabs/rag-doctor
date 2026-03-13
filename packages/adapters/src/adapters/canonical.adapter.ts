import type { TraceAdapter, AdaptedTraceResult } from "../adapter-types.js";
import { AdapterInputError } from "../errors.js";

/**
 * Canonical adapter — pass-through with minimal transformation.
 * Input already matches RAG Doctor's expected shape.
 */
export const canonicalAdapter: TraceAdapter = {
  format: "canonical",
  name: "canonical",

  adapt(input: unknown): AdaptedTraceResult {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new AdapterInputError("canonical", "Input must be a JSON object.");
    }

    const obj = input as Record<string, unknown>;

    if (typeof obj["query"] !== "string") {
      throw new AdapterInputError("canonical", '"query" must be a string.');
    }

    if (!Array.isArray(obj["retrievedChunks"])) {
      throw new AdapterInputError("canonical", '"retrievedChunks" must be an array.');
    }

    return {
      format: "canonical",
      adapter: "canonical",
      trace: { ...obj },
      warnings: [],
    };
  },
};

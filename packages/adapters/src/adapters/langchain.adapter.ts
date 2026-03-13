import type { TraceAdapter, AdaptedTraceResult } from "../adapter-types.js";
import { AdapterInputError } from "../errors.js";

interface LangChainDocument {
  pageContent?: unknown;
  metadata?: unknown;
  score?: unknown;
}

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
export const langchainAdapter: TraceAdapter = {
  format: "langchain",
  name: "langchain",

  adapt(input: unknown): AdaptedTraceResult {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new AdapterInputError("langchain", "Input must be a JSON object.");
    }

    const obj = input as Record<string, unknown>;
    const warnings: string[] = [];

    if (typeof obj["input"] !== "string") {
      throw new AdapterInputError("langchain", '"input" must be a string.');
    }

    if (!Array.isArray(obj["retrieverOutput"])) {
      throw new AdapterInputError("langchain", '"retrieverOutput" must be an array.');
    }

    const docs = obj["retrieverOutput"] as LangChainDocument[];
    let generatedIdCount = 0;

    const retrievedChunks = docs.map((doc, idx) => {
      if (typeof doc !== "object" || doc === null) {
        throw new AdapterInputError("langchain", `retrieverOutput[${idx}] must be an object.`);
      }

      const text = typeof doc.pageContent === "string" ? doc.pageContent : "";
      if (typeof doc.pageContent !== "string") {
        warnings.push(`retrieverOutput[${idx}].pageContent is not a string; defaulting to empty text.`);
      }

      const chunk: Record<string, unknown> = {
        id: `langchain-chunk-${idx}`,
        text,
      };
      generatedIdCount++;

      if (typeof doc.score === "number") {
        chunk["score"] = doc.score;
      }

      const meta = doc.metadata;
      if (typeof meta === "object" && meta !== null && !Array.isArray(meta)) {
        const source = (meta as Record<string, unknown>)["source"];
        if (typeof source === "string") {
          chunk["source"] = source;
        }
      }

      return chunk;
    });

    if (generatedIdCount > 0) {
      warnings.push(`Generated deterministic IDs for ${generatedIdCount} chunk(s) (langchain-chunk-0, langchain-chunk-1, ...).`);
    }

    const trace: Record<string, unknown> = {
      query: obj["input"],
      retrievedChunks,
      metadata: { sourceFormat: "langchain" },
    };

    if (typeof obj["output"] === "string") {
      trace["finalAnswer"] = obj["output"];
    }

    return {
      format: "langchain",
      adapter: "langchain",
      trace,
      warnings,
    };
  },
};

import type { TraceAdapter, AdaptedTraceResult } from "../adapter-types.js";
import { AdapterInputError } from "../errors.js";

interface LangSmithDocument {
  id?: unknown;
  content?: unknown;
  score?: unknown;
  source?: unknown;
}

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
export const langsmithAdapter: TraceAdapter = {
  format: "langsmith",
  name: "langsmith",

  adapt(input: unknown): AdaptedTraceResult {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new AdapterInputError("langsmith", "Input must be a JSON object.");
    }

    const obj = input as Record<string, unknown>;
    const warnings: string[] = [];

    if (typeof obj["run_type"] !== "string") {
      throw new AdapterInputError("langsmith", '"run_type" must be a string.');
    }

    const inputs = obj["inputs"];
    if (typeof inputs !== "object" || inputs === null || Array.isArray(inputs)) {
      throw new AdapterInputError("langsmith", '"inputs" must be an object.');
    }

    const question = (inputs as Record<string, unknown>)["question"];
    if (typeof question !== "string") {
      throw new AdapterInputError("langsmith", '"inputs.question" must be a string.');
    }

    const outputs = obj["outputs"];
    if (typeof outputs !== "object" || outputs === null || Array.isArray(outputs)) {
      throw new AdapterInputError("langsmith", '"outputs" must be an object.');
    }

    const answer = (outputs as Record<string, unknown>)["answer"];

    const retrieval = obj["retrieval"];
    let retrievedChunks: Record<string, unknown>[] = [];
    let generatedIdCount = 0;

    if (typeof retrieval === "object" && retrieval !== null && !Array.isArray(retrieval)) {
      const docs = (retrieval as Record<string, unknown>)["documents"];
      if (Array.isArray(docs)) {
        retrievedChunks = (docs as LangSmithDocument[]).map((doc, idx) => {
          if (typeof doc !== "object" || doc === null) {
            throw new AdapterInputError("langsmith", `retrieval.documents[${idx}] must be an object.`);
          }

          const hasId = typeof doc.id === "string" && doc.id.length > 0;
          const chunk: Record<string, unknown> = {
            id: hasId ? doc.id : `langsmith-chunk-${idx}`,
            text: typeof doc.content === "string" ? doc.content : "",
          };

          if (!hasId) generatedIdCount++;

          if (typeof doc.content !== "string") {
            warnings.push(`retrieval.documents[${idx}].content is not a string; defaulting to empty text.`);
          }

          if (typeof doc.score === "number") {
            chunk["score"] = doc.score;
          }

          if (typeof doc.source === "string") {
            chunk["source"] = doc.source;
          }

          return chunk;
        });
      }
    } else {
      warnings.push("No 'retrieval.documents' found; retrievedChunks will be empty.");
    }

    if (generatedIdCount > 0) {
      warnings.push(`Generated deterministic IDs for ${generatedIdCount} chunk(s).`);
    }

    const extra = obj["extra"];
    const baseMeta: Record<string, unknown> = { sourceFormat: "langsmith" };
    if (typeof extra === "object" && extra !== null && !Array.isArray(extra)) {
      Object.assign(baseMeta, extra);
    }

    const trace: Record<string, unknown> = {
      query: question,
      retrievedChunks,
      metadata: baseMeta,
    };

    if (typeof answer === "string") {
      trace["finalAnswer"] = answer;
    } else {
      warnings.push("outputs.answer is not a string; finalAnswer will be omitted.");
    }

    return {
      format: "langsmith",
      adapter: "langsmith",
      trace,
      warnings,
    };
  },
};

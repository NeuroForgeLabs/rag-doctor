// src/detect-format.ts
function detectTraceFormat(input) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return "unknown";
  }
  const obj = input;
  if ("query" in obj && "retrievedChunks" in obj) {
    return "canonical";
  }
  if ("events" in obj && Array.isArray(obj["events"])) {
    return "event-trace";
  }
  if ("input" in obj && "retrieverOutput" in obj) {
    return "langchain";
  }
  if ("run_type" in obj && "inputs" in obj && "outputs" in obj) {
    return "langsmith";
  }
  return "unknown";
}

// src/errors.ts
var UnsupportedTraceFormatError = class extends Error {
  code = "UNSUPPORTED_TRACE_FORMAT";
  constructor(message) {
    super(message ?? "Could not detect trace format. Supported formats: canonical, event-trace, langchain, langsmith.");
    this.name = "UnsupportedTraceFormatError";
  }
};
var AdapterInputError = class extends Error {
  constructor(adapter, message) {
    super(`Adapter "${adapter}": ${message}`);
    this.adapter = adapter;
    this.name = "AdapterInputError";
  }
  code = "ADAPTER_INPUT_ERROR";
};

// src/adapters/canonical.adapter.ts
var canonicalAdapter = {
  format: "canonical",
  name: "canonical",
  adapt(input) {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new AdapterInputError("canonical", "Input must be a JSON object.");
    }
    const obj = input;
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
      warnings: []
    };
  }
};

// src/adapters/event-trace.adapter.ts
var eventTraceAdapter = {
  format: "event-trace",
  name: "event-trace",
  adapt(input) {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new AdapterInputError("event-trace", "Input must be a JSON object.");
    }
    const obj = input;
    const warnings = [];
    if (!Array.isArray(obj["events"])) {
      throw new AdapterInputError("event-trace", '"events" must be an array.');
    }
    const events = obj["events"];
    let query;
    let chunks;
    let finalAnswer;
    for (const event of events) {
      if (typeof event !== "object" || event === null) continue;
      switch (event["type"]) {
        case "query.received":
          if (typeof event["query"] === "string") {
            query = event["query"];
          }
          break;
        case "retrieval.completed":
          if (Array.isArray(event["chunks"])) {
            chunks = event["chunks"];
          }
          break;
        case "answer.generated":
          if (typeof event["answer"] === "string") {
            finalAnswer = event["answer"];
          }
          break;
      }
    }
    if (query === void 0) {
      throw new AdapterInputError("event-trace", 'No "query.received" event found with a query string.');
    }
    if (chunks === void 0) {
      throw new AdapterInputError("event-trace", 'No "retrieval.completed" event found with chunks.');
    }
    const existingMeta = typeof obj["metadata"] === "object" && obj["metadata"] !== null && !Array.isArray(obj["metadata"]) ? obj["metadata"] : {};
    const trace = {
      query,
      retrievedChunks: chunks,
      metadata: { ...existingMeta, sourceFormat: "event-trace" }
    };
    if (finalAnswer !== void 0) {
      trace["finalAnswer"] = finalAnswer;
    } else {
      warnings.push("No 'answer.generated' event found; finalAnswer will be omitted.");
    }
    return {
      format: "event-trace",
      adapter: "event-trace",
      trace,
      warnings
    };
  }
};

// src/adapters/langchain.adapter.ts
var langchainAdapter = {
  format: "langchain",
  name: "langchain",
  adapt(input) {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new AdapterInputError("langchain", "Input must be a JSON object.");
    }
    const obj = input;
    const warnings = [];
    if (typeof obj["input"] !== "string") {
      throw new AdapterInputError("langchain", '"input" must be a string.');
    }
    if (!Array.isArray(obj["retrieverOutput"])) {
      throw new AdapterInputError("langchain", '"retrieverOutput" must be an array.');
    }
    const docs = obj["retrieverOutput"];
    let generatedIdCount = 0;
    const retrievedChunks = docs.map((doc, idx) => {
      if (typeof doc !== "object" || doc === null) {
        throw new AdapterInputError("langchain", `retrieverOutput[${idx}] must be an object.`);
      }
      const text = typeof doc.pageContent === "string" ? doc.pageContent : "";
      if (typeof doc.pageContent !== "string") {
        warnings.push(`retrieverOutput[${idx}].pageContent is not a string; defaulting to empty text.`);
      }
      const chunk = {
        id: `langchain-chunk-${idx}`,
        text
      };
      generatedIdCount++;
      if (typeof doc.score === "number") {
        chunk["score"] = doc.score;
      }
      const meta = doc.metadata;
      if (typeof meta === "object" && meta !== null && !Array.isArray(meta)) {
        const source = meta["source"];
        if (typeof source === "string") {
          chunk["source"] = source;
        }
      }
      return chunk;
    });
    if (generatedIdCount > 0) {
      warnings.push(`Generated deterministic IDs for ${generatedIdCount} chunk(s) (langchain-chunk-0, langchain-chunk-1, ...).`);
    }
    const trace = {
      query: obj["input"],
      retrievedChunks,
      metadata: { sourceFormat: "langchain" }
    };
    if (typeof obj["output"] === "string") {
      trace["finalAnswer"] = obj["output"];
    }
    return {
      format: "langchain",
      adapter: "langchain",
      trace,
      warnings
    };
  }
};

// src/adapters/langsmith.adapter.ts
var langsmithAdapter = {
  format: "langsmith",
  name: "langsmith",
  adapt(input) {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new AdapterInputError("langsmith", "Input must be a JSON object.");
    }
    const obj = input;
    const warnings = [];
    if (typeof obj["run_type"] !== "string") {
      throw new AdapterInputError("langsmith", '"run_type" must be a string.');
    }
    const inputs = obj["inputs"];
    if (typeof inputs !== "object" || inputs === null || Array.isArray(inputs)) {
      throw new AdapterInputError("langsmith", '"inputs" must be an object.');
    }
    const question = inputs["question"];
    if (typeof question !== "string") {
      throw new AdapterInputError("langsmith", '"inputs.question" must be a string.');
    }
    const outputs = obj["outputs"];
    if (typeof outputs !== "object" || outputs === null || Array.isArray(outputs)) {
      throw new AdapterInputError("langsmith", '"outputs" must be an object.');
    }
    const answer = outputs["answer"];
    const retrieval = obj["retrieval"];
    let retrievedChunks = [];
    let generatedIdCount = 0;
    if (typeof retrieval === "object" && retrieval !== null && !Array.isArray(retrieval)) {
      const docs = retrieval["documents"];
      if (Array.isArray(docs)) {
        retrievedChunks = docs.map((doc, idx) => {
          if (typeof doc !== "object" || doc === null) {
            throw new AdapterInputError("langsmith", `retrieval.documents[${idx}] must be an object.`);
          }
          const hasId = typeof doc.id === "string" && doc.id.length > 0;
          const chunk = {
            id: hasId ? doc.id : `langsmith-chunk-${idx}`,
            text: typeof doc.content === "string" ? doc.content : ""
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
    const baseMeta = { sourceFormat: "langsmith" };
    if (typeof extra === "object" && extra !== null && !Array.isArray(extra)) {
      Object.assign(baseMeta, extra);
    }
    const trace = {
      query: question,
      retrievedChunks,
      metadata: baseMeta
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
      warnings
    };
  }
};

// src/adapt-trace.ts
var ADAPTERS = {
  canonical: canonicalAdapter,
  "event-trace": eventTraceAdapter,
  langchain: langchainAdapter,
  langsmith: langsmithAdapter
};
function adaptTrace(input, options) {
  let format;
  if (options?.format !== void 0 && options.format !== "unknown") {
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
export {
  AdapterInputError,
  UnsupportedTraceFormatError,
  adaptTrace,
  canonicalAdapter,
  detectTraceFormat,
  eventTraceAdapter,
  langchainAdapter,
  langsmithAdapter
};
//# sourceMappingURL=index.js.map
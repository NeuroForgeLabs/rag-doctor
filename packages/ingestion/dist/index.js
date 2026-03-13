// src/errors.ts
var TraceParseError = class extends Error {
  constructor(message, rawInput) {
    super(message);
    this.rawInput = rawInput;
    this.name = "TraceParseError";
  }
  code = "TRACE_PARSE_ERROR";
};
var TraceValidationError = class extends Error {
  code = "TRACE_VALIDATION_ERROR";
  /** Structured issues array for programmatic consumption */
  issues;
  constructor(message, issues) {
    super(message);
    this.name = "TraceValidationError";
    this.issues = issues;
  }
  /** Returns a structured payload suitable for JSON output */
  toPayload() {
    return {
      code: "INVALID_TRACE_SCHEMA",
      message: this.message,
      issues: this.issues
    };
  }
};
var TraceNormalizationError = class extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
    this.name = "TraceNormalizationError";
  }
  code = "TRACE_NORMALIZATION_ERROR";
};

// src/validate-trace.ts
function validateTrace(input) {
  const issues = [];
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    issues.push({
      path: "(root)",
      expected: "object",
      received: Array.isArray(input) ? "array" : String(typeof input === "object" ? "null" : typeof input)
    });
    throw new TraceValidationError("Trace validation failed", issues);
  }
  const raw = input;
  if (raw["query"] === void 0 || raw["query"] === null) {
    issues.push({ path: "query", expected: "non-empty string", received: "missing" });
  } else if (typeof raw["query"] !== "string") {
    issues.push({ path: "query", expected: "non-empty string", received: typeof raw["query"] });
  } else if (raw["query"].trim().length === 0) {
    issues.push({ path: "query", expected: "non-empty string", received: "empty string" });
  }
  if (raw["retrievedChunks"] === void 0 || raw["retrievedChunks"] === null) {
    issues.push({ path: "retrievedChunks", expected: "array", received: "missing" });
  } else if (!Array.isArray(raw["retrievedChunks"])) {
    issues.push({
      path: "retrievedChunks",
      expected: "array",
      received: typeof raw["retrievedChunks"]
    });
  } else {
    validateChunks(raw["retrievedChunks"], issues);
  }
  if (raw["finalAnswer"] !== void 0 && raw["finalAnswer"] !== null) {
    if (typeof raw["finalAnswer"] !== "string") {
      issues.push({
        path: "finalAnswer",
        expected: "string",
        received: typeof raw["finalAnswer"]
      });
    }
  }
  if (raw["metadata"] !== void 0 && raw["metadata"] !== null) {
    if (typeof raw["metadata"] !== "object" || Array.isArray(raw["metadata"])) {
      issues.push({
        path: "metadata",
        expected: "object",
        received: Array.isArray(raw["metadata"]) ? "array" : typeof raw["metadata"]
      });
    }
  }
  if (issues.length > 0) {
    throw new TraceValidationError("Trace validation failed", issues);
  }
}
function validateChunks(chunks, issues) {
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const prefix = `retrievedChunks[${i}]`;
    if (typeof chunk !== "object" || chunk === null || Array.isArray(chunk)) {
      issues.push({
        path: prefix,
        expected: "object",
        received: Array.isArray(chunk) ? "array" : String(chunk === null ? "null" : typeof chunk)
      });
      continue;
    }
    const obj = chunk;
    if (obj["id"] === void 0 || obj["id"] === null) {
      issues.push({ path: `${prefix}.id`, expected: "non-empty string", received: "missing" });
    } else if (typeof obj["id"] !== "string") {
      issues.push({ path: `${prefix}.id`, expected: "non-empty string", received: typeof obj["id"] });
    } else if (obj["id"].trim().length === 0) {
      issues.push({ path: `${prefix}.id`, expected: "non-empty string", received: "empty string" });
    }
    if (obj["text"] === void 0 || obj["text"] === null) {
      issues.push({ path: `${prefix}.text`, expected: "string", received: "missing" });
    } else if (typeof obj["text"] !== "string") {
      issues.push({ path: `${prefix}.text`, expected: "string", received: typeof obj["text"] });
    }
    if (obj["score"] !== void 0 && obj["score"] !== null) {
      if (typeof obj["score"] !== "number") {
        issues.push({
          path: `${prefix}.score`,
          expected: "number",
          received: typeof obj["score"]
        });
      } else if (!isFinite(obj["score"])) {
        issues.push({
          path: `${prefix}.score`,
          expected: "finite number",
          received: String(obj["score"])
        });
      }
    }
    if (obj["source"] !== void 0 && obj["source"] !== null) {
      if (typeof obj["source"] !== "string") {
        issues.push({
          path: `${prefix}.source`,
          expected: "string",
          received: typeof obj["source"]
        });
      }
    }
  }
}

// src/normalize-trace.ts
function normalizeTrace(input) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TraceNormalizationError(
      "Normalization received a non-object \u2014 ensure validateTrace is called first",
      "(root)"
    );
  }
  const raw = input;
  const query = raw["query"];
  if (typeof query !== "string") {
    throw new TraceNormalizationError("query must be a string after validation", "query");
  }
  const rawChunks = Array.isArray(raw["retrievedChunks"]) ? raw["retrievedChunks"] : [];
  const retrievedChunks = rawChunks.map(
    (chunk, i) => normalizeChunk(chunk, i)
  );
  const trace = {
    query: query.trim(),
    retrievedChunks
  };
  if (raw["finalAnswer"] !== void 0 && raw["finalAnswer"] !== null) {
    if (typeof raw["finalAnswer"] !== "string") {
      throw new TraceNormalizationError(
        "finalAnswer must be a string after validation",
        "finalAnswer"
      );
    }
    trace.finalAnswer = raw["finalAnswer"];
  }
  if (raw["metadata"] !== void 0 && raw["metadata"] !== null && typeof raw["metadata"] === "object" && !Array.isArray(raw["metadata"])) {
    trace.metadata = raw["metadata"];
  }
  return trace;
}
function normalizeChunk(raw, index) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new TraceNormalizationError(
      `retrievedChunks[${index}] must be an object \u2014 ensure validateTrace is called first`,
      `retrievedChunks[${index}]`
    );
  }
  const obj = raw;
  const id = obj["id"];
  if (typeof id !== "string") {
    throw new TraceNormalizationError(
      `retrievedChunks[${index}].id must be a string after validation`,
      `retrievedChunks[${index}].id`
    );
  }
  const text = obj["text"];
  if (typeof text !== "string") {
    throw new TraceNormalizationError(
      `retrievedChunks[${index}].text must be a string after validation`,
      `retrievedChunks[${index}].text`
    );
  }
  const chunk = { id, text };
  if (obj["score"] !== void 0 && obj["score"] !== null) {
    if (typeof obj["score"] === "number" && isFinite(obj["score"])) {
      chunk.score = obj["score"];
    }
  }
  if (obj["source"] !== void 0 && obj["source"] !== null) {
    if (typeof obj["source"] === "string") {
      chunk.source = obj["source"];
    }
  }
  return chunk;
}

// src/ingest-trace.ts
function ingestTrace(input) {
  validateTrace(input);
  return normalizeTrace(input);
}
export {
  TraceNormalizationError,
  TraceParseError,
  TraceValidationError,
  ingestTrace,
  normalizeTrace,
  validateTrace
};
//# sourceMappingURL=index.js.map
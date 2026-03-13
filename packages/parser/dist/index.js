// src/errors.ts
var ParseError = class extends Error {
  constructor(message, field) {
    super(message);
    this.field = field;
    this.name = "ParseError";
  }
};

// src/normalize.ts
function parseChunk(raw, index) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ParseError(
      `retrievedChunks[${index}] must be an object, got ${typeof raw}`,
      `retrievedChunks[${index}]`
    );
  }
  const obj = raw;
  if (typeof obj["id"] !== "string" || obj["id"].trim() === "") {
    throw new ParseError(
      `retrievedChunks[${index}].id must be a non-empty string`,
      `retrievedChunks[${index}].id`
    );
  }
  if (typeof obj["text"] !== "string") {
    throw new ParseError(
      `retrievedChunks[${index}].text must be a string`,
      `retrievedChunks[${index}].text`
    );
  }
  const chunk = {
    id: obj["id"],
    text: obj["text"]
  };
  if (obj["score"] !== void 0) {
    if (typeof obj["score"] !== "number" || !isFinite(obj["score"])) {
      throw new ParseError(
        `retrievedChunks[${index}].score must be a finite number`,
        `retrievedChunks[${index}].score`
      );
    }
    chunk.score = obj["score"];
  }
  if (obj["source"] !== void 0) {
    if (typeof obj["source"] !== "string") {
      throw new ParseError(
        `retrievedChunks[${index}].source must be a string`,
        `retrievedChunks[${index}].source`
      );
    }
    chunk.source = obj["source"];
  }
  return chunk;
}
function normalizeTrace(input) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ParseError(`Trace input must be a JSON object, got ${typeof input}`);
  }
  const raw = input;
  if (typeof raw["query"] !== "string" || raw["query"].trim() === "") {
    throw new ParseError('Trace must have a non-empty "query" string field', "query");
  }
  if (!Array.isArray(raw["retrievedChunks"])) {
    throw new ParseError(
      '"retrievedChunks" must be an array',
      "retrievedChunks"
    );
  }
  const retrievedChunks = raw["retrievedChunks"].map(
    (chunk, i) => parseChunk(chunk, i)
  );
  const trace = {
    query: raw["query"].trim(),
    retrievedChunks
  };
  if (raw["finalAnswer"] !== void 0) {
    if (typeof raw["finalAnswer"] !== "string") {
      throw new ParseError('"finalAnswer" must be a string when present', "finalAnswer");
    }
    trace.finalAnswer = raw["finalAnswer"];
  }
  if (raw["metadata"] !== void 0 && typeof raw["metadata"] === "object" && raw["metadata"] !== null && !Array.isArray(raw["metadata"])) {
    trace.metadata = raw["metadata"];
  }
  return trace;
}
export {
  ParseError,
  normalizeTrace
};
//# sourceMappingURL=index.js.map
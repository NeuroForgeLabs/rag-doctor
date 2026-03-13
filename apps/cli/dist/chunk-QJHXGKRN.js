#!/usr/bin/env node

// src/cli.ts
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { analyzeTrace } from "@rag-doctor/core";
import { diagnoseTrace } from "@rag-doctor/diagnostics";
import {
  ingestTrace,
  TraceValidationError,
  TraceParseError
} from "@rag-doctor/ingestion";
import { printTerminalReport, printDiagnosisReport } from "@rag-doctor/reporters";
var CliExitError = class extends Error {
  constructor(code) {
    super(`CLI exited with code ${code}`);
    this.code = code;
    this.name = "CliExitError";
  }
};
var processIO = {
  stdout: (line) => process.stdout.write(line + "\n"),
  stderr: (line) => process.stderr.write(line + "\n"),
  exit: (code) => process.exit(code)
};
function parseArgs(args) {
  const flags = { json: false, help: false, unknownFlags: [] };
  const positional = [];
  for (const arg of args) {
    if (arg === "--json") {
      flags.json = true;
    } else if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (arg.startsWith("--")) {
      flags.unknownFlags.push(arg);
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}
function buildHelpText() {
  return `
${bold("rag-doctor")} \u2014 Diagnose your RAG pipeline

${bold("USAGE")}
  rag-doctor analyze <traceFile> [flags]
  rag-doctor diagnose <traceFile> [flags]

${bold("COMMANDS")}
  analyze <traceFile>   Load a trace JSON and run diagnostics
  diagnose <traceFile>  Run diagnostics and infer root cause(s)

${bold("FLAGS")}
  --json                Output results as JSON instead of terminal report
  --help, -h            Show this help message

${bold("EXAMPLES")}
  rag-doctor analyze trace.json
  rag-doctor analyze trace.json --json
  rag-doctor diagnose trace.json
  rag-doctor diagnose trace.json --json
  npx rag-doctor analyze trace.json

${bold("TRACE FORMAT")}
  {
    "query": "string",
    "retrievedChunks": [{ "id": "string", "text": "string", "score"?: number }],
    "finalAnswer"?: "string"
  }
`;
}
function loadAndAnalyze(filePath, flags, io) {
  const absolutePath = resolve(process.cwd(), filePath);
  if (!existsSync(absolutePath)) {
    emitError(io, flags, "File not found", filePath, null);
    io.exit(1);
  }
  let rawContent;
  try {
    rawContent = readFileSync(absolutePath, "utf-8");
  } catch (err) {
    emitError(io, flags, "Could not read file", filePath, null);
    io.exit(1);
  }
  let rawJson;
  try {
    rawJson = JSON.parse(rawContent);
  } catch {
    const parseErr = new TraceParseError(`${filePath} is not valid JSON.`, rawContent);
    if (flags.json) {
      io.stderr(
        JSON.stringify(
          { error: "TRACE_PARSE_ERROR", message: parseErr.message },
          null,
          2
        )
      );
    } else {
      io.stderr(`Error: ${parseErr.message}`);
    }
    io.exit(1);
  }
  let trace;
  try {
    trace = ingestTrace(rawJson);
  } catch (err) {
    if (err instanceof TraceValidationError) {
      if (flags.json) {
        io.stderr(JSON.stringify(err.toPayload(), null, 2));
      } else {
        const issueLines = err.issues.map((i) => `  \u2022 ${i.path}: expected ${i.expected}, got ${i.received}`).join("\n");
        io.stderr(
          `Error: Invalid trace format: ${err.message}${issueLines ? "\n" + issueLines : ""}`
        );
      }
      io.exit(1);
    }
    throw err;
  }
  return analyzeTrace(trace);
}
function emitError(io, flags, message, filePath, _detail) {
  if (flags.json) {
    io.stderr(JSON.stringify({ error: message, file: filePath }, null, 2));
  } else {
    io.stderr(`Error: ${message}: ${filePath}`);
  }
}
function runAnalyzeCommand(filePath, flags, io) {
  const result = loadAndAnalyze(filePath, flags, io);
  if (flags.json) {
    io.stdout(JSON.stringify(result, null, 2));
    return result;
  }
  printTerminalReport(result, { write: io.stdout });
  if (result.summary.high > 0) {
    io.exit(1);
  }
  return result;
}
function runDiagnoseCommand(filePath, flags, io) {
  const analysisResult = loadAndAnalyze(filePath, flags, io);
  const diagnosis = diagnoseTrace(analysisResult);
  if (flags.json) {
    io.stdout(JSON.stringify(diagnosis, null, 2));
    return diagnosis;
  }
  printDiagnosisReport(diagnosis, { write: io.stdout });
  if (analysisResult.summary.high > 0) {
    io.exit(1);
  }
  return diagnosis;
}
function run(argv = process.argv.slice(2), io = processIO) {
  const { flags, positional } = parseArgs(argv);
  if (flags.unknownFlags.length > 0) {
    io.stderr(
      `Error: Unknown flag(s): ${flags.unknownFlags.join(", ")}. Run rag-doctor --help for usage.`
    );
    io.exit(1);
  }
  if (flags.help || positional.length === 0) {
    io.stdout(buildHelpText());
    return;
  }
  const command = positional[0];
  switch (command) {
    case "analyze": {
      const filePath = positional[1];
      if (!filePath) {
        io.stderr(
          'Error: The "analyze" command requires a trace file path.\n  Usage: rag-doctor analyze <traceFile>'
        );
        io.exit(1);
      }
      runAnalyzeCommand(filePath, flags, io);
      break;
    }
    case "diagnose": {
      const filePath = positional[1];
      if (!filePath) {
        io.stderr(
          'Error: The "diagnose" command requires a trace file path.\n  Usage: rag-doctor diagnose <traceFile>'
        );
        io.exit(1);
      }
      runDiagnoseCommand(filePath, flags, io);
      break;
    }
    default:
      io.stderr(
        `Error: Unknown command: "${command}". Run rag-doctor --help for usage.`
      );
      io.exit(1);
  }
}
function bold(s) {
  return `\x1B[1m${s}\x1B[0m`;
}

export {
  CliExitError,
  parseArgs,
  buildHelpText,
  runAnalyzeCommand,
  runDiagnoseCommand,
  run
};
//# sourceMappingURL=chunk-QJHXGKRN.js.map
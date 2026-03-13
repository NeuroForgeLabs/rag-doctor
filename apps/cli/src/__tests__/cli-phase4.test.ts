/**
 * Phase 4 CLI tests: --format flag, external trace adapters, auto-detection,
 * and regression tests ensuring existing behavior is preserved.
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "url";
import { join, dirname, resolve } from "path";
import { run, parseArgs, CliExitError } from "../cli.js";
import type { CliIO } from "../cli.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");
const FIXTURES = join(REPO_ROOT, "tests", "fixtures");

interface TestOutput {
  stdout: string[];
  stderr: string[];
  exitCode: number | null;
}

function makeIO(): { io: CliIO; output: TestOutput } {
  const output: TestOutput = { stdout: [], stderr: [], exitCode: null };
  const io: CliIO = {
    stdout: (line) => output.stdout.push(line),
    stderr: (line) => output.stderr.push(line),
    exit: (code) => {
      output.exitCode = code;
      throw new CliExitError(code);
    },
  };
  return { io, output };
}

function runCli(argv: string[]): TestOutput {
  const { io, output } = makeIO();
  try {
    run(argv, io);
  } catch (err) {
    if (!(err instanceof CliExitError)) throw err;
  }
  return output;
}

function fixture(name: string): string {
  return join(FIXTURES, name);
}

// ── parseArgs — --format flag ─────────────────────────────────────────────────

describe("parseArgs — --format flag (Phase 4)", () => {
  it("parses --format <name> as a separate argument", () => {
    const { flags } = parseArgs(["analyze", "trace.json", "--format", "langchain"]);
    expect(flags.format).toBe("langchain");
  });

  it("parses --format=<name> syntax", () => {
    const { flags } = parseArgs(["analyze", "trace.json", "--format=langsmith"]);
    expect(flags.format).toBe("langsmith");
  });

  it("defaults format to null when not provided", () => {
    const { flags } = parseArgs(["analyze", "trace.json"]);
    expect(flags.format).toBeNull();
  });

  it("does not add --format to unknownFlags when value is provided", () => {
    const { flags } = parseArgs(["analyze", "--format", "canonical"]);
    expect(flags.unknownFlags).toHaveLength(0);
  });

  it("treats --format without value as unknown flag", () => {
    const { flags } = parseArgs(["analyze", "--format"]);
    expect(flags.format).toBeNull();
    expect(flags.unknownFlags).toHaveLength(1);
  });
});

// ── analyze with auto-detected formats ────────────────────────────────────────

describe("run — analyze auto-detected external formats (Phase 4)", () => {
  it("auto-detects and analyzes canonical trace (existing behavior)", () => {
    const out = runCli(["analyze", fixture("valid-clean-trace.json")]);
    expect(out.exitCode).toBeNull();
    expect(out.stderr).toHaveLength(0);
  });

  it("auto-detects and analyzes event-trace format", () => {
    const out = runCli(["analyze", fixture("event-trace-valid.json")]);
    expect(out.exitCode).toBeNull();
    expect(out.stderr.join("\n")).toContain("Adapted trace format: event-trace");
  });

  it("auto-detects and analyzes langchain format", () => {
    const out = runCli(["analyze", fixture("langchain-valid.json")]);
    expect(out.exitCode).toBeNull();
    expect(out.stderr.join("\n")).toContain("Adapted trace format: langchain");
  });

  it("auto-detects and analyzes langsmith format", () => {
    const out = runCli(["analyze", fixture("langsmith-valid.json")]);
    expect(out.exitCode).toBeNull();
    expect(out.stderr.join("\n")).toContain("Adapted trace format: langsmith");
  });

  it("unknown format falls through to ingestion which reports schema errors", () => {
    const out = runCli(["analyze", fixture("unknown-format.json")]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("Invalid trace format");
  });
});

// ── analyze with explicit --format ────────────────────────────────────────────

describe("run — analyze explicit --format (Phase 4)", () => {
  it("--format canonical works for canonical trace", () => {
    const out = runCli(["analyze", fixture("valid-clean-trace.json"), "--format", "canonical"]);
    expect(out.exitCode).toBeNull();
  });

  it("--format event-trace works for event-trace fixture", () => {
    const out = runCli(["analyze", fixture("event-trace-valid.json"), "--format", "event-trace"]);
    expect(out.exitCode).toBeNull();
  });

  it("--format langchain works for langchain fixture", () => {
    const out = runCli(["analyze", fixture("langchain-valid.json"), "--format", "langchain"]);
    expect(out.exitCode).toBeNull();
  });

  it("--format langsmith works for langsmith fixture", () => {
    const out = runCli(["analyze", fixture("langsmith-valid.json"), "--format", "langsmith"]);
    expect(out.exitCode).toBeNull();
  });

  it("--format langchain on canonical trace exits 1 with adapter error", () => {
    const out = runCli(["analyze", fixture("valid-clean-trace.json"), "--format", "langchain"]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("langchain");
  });

  it("--format with unsupported value exits 1", () => {
    const out = runCli(["analyze", fixture("valid-clean-trace.json"), "--format", "nonexistent"]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("nonexistent");
  });

  it("--format langchain on malformed langchain exits 1 with adapter error", () => {
    const out = runCli(["analyze", fixture("malformed-langchain.json"), "--format", "langchain"]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("langchain");
  });
});

// ── analyze --format with --json ──────────────────────────────────────────────

describe("run — --format with --json mode (Phase 4)", () => {
  it("--json outputs valid JSON result for langchain trace", () => {
    const out = runCli(["analyze", fixture("langchain-valid.json"), "--format", "langchain", "--json"]);
    expect(out.exitCode).toBeNull();
    const parsed = JSON.parse(out.stdout.join("\n")) as { findings: unknown[]; summary: unknown };
    expect(Array.isArray(parsed.findings)).toBe(true);
    expect(typeof parsed.summary).toBe("object");
  });

  it("--json does not print 'Adapted trace format' to stderr", () => {
    const out = runCli(["analyze", fixture("langchain-valid.json"), "--format", "langchain", "--json"]);
    expect(out.stderr.join("\n")).not.toContain("Adapted trace format");
  });

  it("--json emits structured error for unsupported format", () => {
    const out = runCli(["analyze", fixture("valid-clean-trace.json"), "--format", "nonexistent", "--json"]);
    expect(out.exitCode).toBe(1);
    const payload = JSON.parse(out.stderr.join("\n")) as { error: string };
    expect(payload.error).toBe("INVALID_FORMAT");
  });

  it("--json emits structured error for adapter input mismatch", () => {
    const out = runCli(["analyze", fixture("valid-clean-trace.json"), "--format", "langchain", "--json"]);
    expect(out.exitCode).toBe(1);
    const payload = JSON.parse(out.stderr.join("\n")) as { error: string; adapter: string };
    expect(payload.error).toBe("ADAPTER_INPUT_ERROR");
    expect(payload.adapter).toBe("langchain");
  });
});

// ── diagnose with adapters ────────────────────────────────────────────────────

describe("run — diagnose with adapters (Phase 4)", () => {
  it("diagnose auto-detects event-trace", () => {
    const out = runCli(["diagnose", fixture("event-trace-valid.json")]);
    expect(out.exitCode).toBeNull();
    expect(out.stderr.join("\n")).toContain("Adapted trace format: event-trace");
  });

  it("diagnose with --format langsmith works", () => {
    const out = runCli(["diagnose", fixture("langsmith-valid.json"), "--format", "langsmith"]);
    expect(out.exitCode).toBeNull();
  });

  it("diagnose with --format langsmith --json outputs valid JSON", () => {
    const out = runCli(["diagnose", fixture("langsmith-valid.json"), "--format", "langsmith", "--json"]);
    expect(out.exitCode).toBeNull();
    expect(() => JSON.parse(out.stdout.join("\n"))).not.toThrow();
  });
});

// ── help text includes --format ───────────────────────────────────────────────

describe("help text — Phase 4 additions", () => {
  it("help text mentions --format flag", () => {
    const out = runCli(["--help"]);
    expect(out.stdout.join("\n")).toContain("--format");
  });

  it("help text mentions supported formats", () => {
    const text = runCli(["--help"]).stdout.join("\n");
    expect(text).toContain("canonical");
    expect(text).toContain("event-trace");
    expect(text).toContain("langchain");
    expect(text).toContain("langsmith");
  });
});

// ── regression — existing behavior preserved ──────────────────────────────────

describe("regression — existing behavior preserved (Phase 4)", () => {
  it("canonical trace still works without --format", () => {
    const out = runCli(["analyze", fixture("valid-clean-trace.json")]);
    expect(out.exitCode).toBeNull();
    expect(out.stderr).toHaveLength(0);
  });

  it("invalid JSON still fails with parse error", () => {
    const out = runCli(["analyze", fixture("invalid-json.txt")]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("not valid JSON");
  });

  it("invalid schema still fails with validation error", () => {
    const out = runCli(["analyze", fixture("invalid-schema.json")]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("Invalid trace format");
  });

  it("file not found still works", () => {
    const out = runCli(["analyze", "/nonexistent/file.json"]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("not found");
  });

  it("--config still works alongside --format", () => {
    const out = runCli([
      "analyze",
      fixture("event-trace-valid.json"),
      "--config",
      fixture("config-recommended.json"),
    ]);
    expect(out.exitCode).toBeNull();
  });
});

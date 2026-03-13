/**
 * Phase 3 CLI tests: --config flag, pack resolution, ruleOptions overrides,
 * config validation errors, and regression tests.
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "url";
import { join, dirname, resolve } from "path";
import { run, parseArgs, loadConfig, CliExitError } from "../cli.js";
import type { CliIO } from "../cli.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");
const FIXTURES = join(REPO_ROOT, "tests", "fixtures");

// ── Test IO factory ───────────────────────────────────────────────────────────

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

// ── parseArgs — --config flag ─────────────────────────────────────────────────

describe("parseArgs — --config flag (Phase 3)", () => {
  it("parses --config <file> as a separate argument", () => {
    const { flags } = parseArgs(["analyze", "trace.json", "--config", "my-config.json"]);
    expect(flags.config).toBe("my-config.json");
  });

  it("parses --config=<file> syntax", () => {
    const { flags } = parseArgs(["analyze", "trace.json", "--config=my-config.json"]);
    expect(flags.config).toBe("my-config.json");
  });

  it("defaults config to null when not provided", () => {
    const { flags } = parseArgs(["analyze", "trace.json"]);
    expect(flags.config).toBeNull();
  });

  it("does not add --config to unknownFlags when value is provided", () => {
    const { flags } = parseArgs(["analyze", "--config", "cfg.json"]);
    expect(flags.unknownFlags).toHaveLength(0);
  });

  it("does not consume subsequent positional as config value when missing", () => {
    const { flags } = parseArgs(["analyze", "--config"]);
    // Missing value — should record as unknown or error, not swallow "analyze"
    expect(flags.config).toBeNull();
    expect(flags.unknownFlags).toHaveLength(1);
  });
});

// ── loadConfig ────────────────────────────────────────────────────────────────

describe("loadConfig", () => {
  function makeTestIO(): { io: CliIO; output: TestOutput } {
    return makeIO();
  }

  it("returns null when configPath is null", () => {
    const { io } = makeTestIO();
    const flags = { json: false, help: false, config: null, unknownFlags: [] };
    // Need to cast as `any` because CliFlags is not exported but loadConfig is
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = loadConfig(null, flags as any, io);
    expect(result).toBeNull();
  });

  it("loads a valid recommended config", () => {
    const { io } = makeTestIO();
    const flags = { json: false, help: false, config: null, unknownFlags: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = loadConfig(fixture("config-recommended.json"), flags as any, io);
    expect(result).toEqual({ packs: ["recommended"] });
  });

  it("loads a config with packs and ruleOptions", () => {
    const { io } = makeTestIO();
    const flags = { json: false, help: false, config: null, unknownFlags: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = loadConfig(fixture("config-tight-thresholds.json"), flags as any, io);
    expect(result?.packs).toEqual(["recommended"]);
    expect(result?.ruleOptions?.["low-retrieval-score"]).toEqual({ averageScoreThreshold: 0.9 });
  });

  it("exits with code 1 for missing config file", () => {
    const { io, output } = makeTestIO();
    const flags = { json: false, help: false, config: null, unknownFlags: [] };
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loadConfig("/nonexistent/path/config.json", flags as any, io);
    }).toThrow(CliExitError);
    expect(output.exitCode).toBe(1);
  });

  it("exits with code 1 for invalid JSON config", () => {
    const { io, output } = makeTestIO();
    const flags = { json: false, help: false, config: null, unknownFlags: [] };
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loadConfig(fixture("config-invalid-json.json"), flags as any, io);
    }).toThrow(CliExitError);
    expect(output.exitCode).toBe(1);
  });

  it("exits with code 1 for config that is an array, not an object", () => {
    const { io, output } = makeTestIO();
    const flags = { json: false, help: false, config: null, unknownFlags: [] };
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loadConfig(fixture("config-not-object.json"), flags as any, io);
    }).toThrow(CliExitError);
    expect(output.exitCode).toBe(1);
  });

  it("exits with code 1 for config with packs as string not array", () => {
    const { io, output } = makeTestIO();
    const flags = { json: false, help: false, config: null, unknownFlags: [] };
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loadConfig(fixture("config-packs-not-array.json"), flags as any, io);
    }).toThrow(CliExitError);
    expect(output.exitCode).toBe(1);
  });
});

// ── analyze --config ──────────────────────────────────────────────────────────

describe("run — analyze --config (Phase 3)", () => {
  it("analyze with config-recommended.json succeeds for clean trace", () => {
    const out = runCli([
      "analyze",
      fixture("valid-clean-trace.json"),
      "--config",
      fixture("config-recommended.json"),
    ]);
    expect(out.exitCode).toBeNull();
    expect(out.stderr).toHaveLength(0);
  });

  it("analyze with config-strict.json succeeds for clean trace", () => {
    const out = runCli([
      "analyze",
      fixture("valid-clean-trace.json"),
      "--config",
      fixture("config-strict.json"),
    ]);
    expect(out.exitCode).toBeNull();
    expect(out.stderr).toHaveLength(0);
  });

  it("analyze with tight threshold config fires on medium-score trace", () => {
    // valid-medium-score-trace has avg ~0.64, tight config sets threshold to 0.9
    const out = runCli([
      "analyze",
      fixture("valid-medium-score-trace.json"),
      "--config",
      fixture("config-tight-thresholds.json"),
    ]);
    // Should fire: high finding (low-retrieval-score) → exit 1
    expect(out.exitCode).toBe(1);
    const allOut = out.stdout.join("\n");
    expect(allOut.toLowerCase()).toContain("threshold: 0.9");
  });

  it("analyze without config does NOT fire on medium-score trace (default threshold 0.5)", () => {
    // avg ~0.64 is above 0.5 default threshold
    const out = runCli(["analyze", fixture("valid-medium-score-trace.json")]);
    expect(out.exitCode).toBeNull();
    expect(out.stderr).toHaveLength(0);
  });

  it("analyze --config exits 1 for unknown pack", () => {
    const out = runCli([
      "analyze",
      fixture("valid-clean-trace.json"),
      "--config",
      fixture("config-unknown-pack.json"),
    ]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("nonexistent-pack");
  });

  it("analyze --config exits 1 for invalid rule option", () => {
    const out = runCli([
      "analyze",
      fixture("valid-clean-trace.json"),
      "--config",
      fixture("config-invalid-option.json"),
    ]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("context-overload");
  });

  it("analyze --config missing config file exits 1 with error", () => {
    const out = runCli([
      "analyze",
      fixture("valid-clean-trace.json"),
      "--config",
      "/nonexistent/config.json",
    ]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("not found");
  });

  it("analyze --config with invalid JSON config exits 1 with error", () => {
    const out = runCli([
      "analyze",
      fixture("valid-clean-trace.json"),
      "--config",
      fixture("config-invalid-json.json"),
    ]);
    expect(out.exitCode).toBe(1);
  });

  it("analyze --config with --json emits structured error for unknown pack", () => {
    const out = runCli([
      "analyze",
      fixture("valid-clean-trace.json"),
      "--config",
      fixture("config-unknown-pack.json"),
      "--json",
    ]);
    expect(out.exitCode).toBe(1);
    const payload = JSON.parse(out.stderr.join("\n")) as { error: string; message: string };
    expect(payload.error).toBe("UNKNOWN_PACK_ERROR");
    expect(payload.message).toContain("nonexistent-pack");
  });

  it("analyze --config with --json emits structured error for invalid rule option", () => {
    const out = runCli([
      "analyze",
      fixture("valid-clean-trace.json"),
      "--config",
      fixture("config-invalid-option.json"),
      "--json",
    ]);
    expect(out.exitCode).toBe(1);
    const payload = JSON.parse(out.stderr.join("\n")) as {
      error: string;
      ruleId: string;
      optionKey: string;
    };
    expect(payload.error).toBe("RULE_CONFIGURATION_ERROR");
    expect(payload.ruleId).toBe("context-overload");
    expect(payload.optionKey).toBe("maxChunkCount");
  });

  it("analyze --config with --json outputs valid JSON result for clean trace", () => {
    const out = runCli([
      "analyze",
      fixture("valid-clean-trace.json"),
      "--config",
      fixture("config-recommended.json"),
      "--json",
    ]);
    expect(out.exitCode).toBeNull();
    const parsed = JSON.parse(out.stdout.join("\n")) as { findings: unknown[]; summary: unknown };
    expect(Array.isArray(parsed.findings)).toBe(true);
    expect(typeof parsed.summary).toBe("object");
  });
});

// ── diagnose --config ─────────────────────────────────────────────────────────

describe("run — diagnose --config (Phase 3)", () => {
  it("diagnose with config-recommended.json succeeds for clean trace", () => {
    const out = runCli([
      "diagnose",
      fixture("valid-clean-trace.json"),
      "--config",
      fixture("config-recommended.json"),
    ]);
    expect(out.exitCode).toBeNull();
    expect(out.stderr).toHaveLength(0);
  });

  it("diagnose with tight threshold config fires on medium-score trace", () => {
    const out = runCli([
      "diagnose",
      fixture("valid-medium-score-trace.json"),
      "--config",
      fixture("config-tight-thresholds.json"),
    ]);
    expect(out.exitCode).toBe(1);
  });

  it("diagnose --config with unknown pack exits 1 with error message", () => {
    const out = runCli([
      "diagnose",
      fixture("valid-clean-trace.json"),
      "--config",
      fixture("config-unknown-pack.json"),
    ]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("nonexistent-pack");
  });

  it("diagnose --config with --json outputs valid JSON result", () => {
    const out = runCli([
      "diagnose",
      fixture("valid-clean-trace.json"),
      "--config",
      fixture("config-recommended.json"),
      "--json",
    ]);
    expect(out.exitCode).toBeNull();
    expect(() => JSON.parse(out.stdout.join("\n"))).not.toThrow();
  });
});

// ── help text includes --config ───────────────────────────────────────────────

describe("help text — Phase 3 additions", () => {
  it("help text mentions --config flag", () => {
    const out = runCli(["--help"]);
    expect(out.stdout.join("\n")).toContain("--config");
  });

  it("help text mentions built-in packs", () => {
    const out = runCli(["--help"]);
    const text = out.stdout.join("\n");
    expect(text).toContain("recommended");
    expect(text).toContain("strict");
  });
});

// ── Regression: Phase 2B behavior unchanged ───────────────────────────────────

describe("regression — Phase 2B behavior unchanged (Phase 3)", () => {
  it("analyze without --config still works as before", () => {
    const out = runCli(["analyze", fixture("valid-clean-trace.json")]);
    expect(out.exitCode).toBeNull();
    expect(out.stderr).toHaveLength(0);
  });

  it("diagnose without --config still works as before", () => {
    const out = runCli(["diagnose", fixture("valid-clean-trace.json")]);
    expect(out.exitCode).toBeNull();
    expect(out.stderr).toHaveLength(0);
  });

  it("invalid JSON trace still fails with TRACE_PARSE_ERROR regardless of config", () => {
    const out = runCli([
      "analyze",
      fixture("invalid-json.txt"),
      "--config",
      fixture("config-recommended.json"),
    ]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("not valid JSON");
  });

  it("invalid schema trace still fails with field-level errors regardless of config", () => {
    const out = runCli([
      "analyze",
      fixture("invalid-missing-fields.json"),
      "--config",
      fixture("config-recommended.json"),
    ]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("Invalid trace format");
  });
});

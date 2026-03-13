# RAG Doctor — Architecture

This document describes the design decisions, package responsibilities, data flow, and extension points of the RAG Doctor monorepo.

---

## Table of Contents

1. [Goals](#goals)
2. [Repository Layout](#repository-layout)
3. [Package Dependency Graph](#package-dependency-graph)
4. [Package Reference](#package-reference)
   - [@rag-doctor/types](#rag-doctortypes)
   - [@rag-doctor/parser](#rag-doctorparser)
   - [@rag-doctor/rules](#rag-doctorrules)
   - [@rag-doctor/core](#rag-doctorcore)
   - [@rag-doctor/diagnostics](#rag-doctordiagnostics)
   - [@rag-doctor/reporters](#rag-doctorreporters)
   - [rag-doctor (CLI)](#rag-doctor-cli)
5. [Data Flow](#data-flow)
6. [Type System](#type-system)
7. [Diagnostic Rules](#diagnostic-rules)
8. [Root Cause Diagnosis](#root-cause-diagnosis)
9. [Build System](#build-system)
10. [Testing Strategy](#testing-strategy)
11. [Adding Custom Rules](#adding-custom-rules)
12. [Future Integrations](#future-integrations)
13. [Design Principles](#design-principles)

---

## Goals

RAG Doctor is designed around three non-negotiable goals:

1. **Embeddability** — The analysis engine must be importable with zero side effects into any environment: CLI, VS Code extension, API server, or CI runner.
2. **Extensibility** — Developers must be able to add custom diagnostic rules without touching core packages.
3. **Modularity** — Each concern (parsing, rules, analysis, diagnosis, reporting) must live in its own package with no upward dependencies.

---

## Repository Layout

```
rag-doctor/
├── apps/
│   └── cli/                     # Entry point: published as `rag-doctor` on npm
│       ├── src/
│       │   ├── bin.ts           # Process entry: calls run()
│       │   ├── cli.ts           # Argument parsing, sub-command dispatch, CliIO injection
│       │   ├── index.ts         # Programmatic re-export of run() and helpers
│       │   └── __tests__/
│       │       ├── cli.test.ts              # In-process unit tests (CliIO injection)
│       │       └── cli.integration.test.ts  # Subprocess tests via spawnSync
│       ├── package.json
│       ├── tsconfig.json
│       └── tsup.config.ts
│
├── packages/
│   ├── types/                   # @rag-doctor/types      — shared interfaces only
│   │   ├── src/index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   ├── parser/                  # @rag-doctor/parser     — input normalization
│   │   └── src/
│   │       ├── errors.ts
│   │       ├── normalize.ts
│   │       ├── index.ts
│   │       └── __tests__/normalize.test.ts
│   │
│   ├── rules/                   # @rag-doctor/rules      — diagnostic rule implementations
│   │   └── src/
│   │       ├── duplicate-chunks.rule.ts
│   │       ├── low-retrieval-score.rule.ts
│   │       ├── oversized-chunk.rule.ts
│   │       ├── context-overload.rule.ts
│   │       ├── index.ts
│   │       └── __tests__/rules.test.ts
│   │
│   ├── core/                    # @rag-doctor/core       — analysis engine
│   │   └── src/
│   │       ├── engine.ts
│   │       ├── index.ts
│   │       └── __tests__/engine.test.ts
│   │
│   ├── diagnostics/             # @rag-doctor/diagnostics — root cause analyzer (Phase 2A)
│   │   └── src/
│   │       ├── diagnosis-types.ts
│   │       ├── heuristics.ts
│   │       ├── root-cause-analyzer.ts
│   │       ├── index.ts
│   │       └── __tests__/root-cause-analyzer.test.ts
│   │
│   └── reporters/               # @rag-doctor/reporters  — output formatters
│       └── src/
│           ├── ansi.ts
│           ├── terminal.reporter.ts
│           ├── diagnosis.reporter.ts
│           ├── index.ts
│           └── __tests__/
│               ├── terminal.reporter.test.ts
│               └── diagnosis.reporter.test.ts
│
├── tests/
│   └── fixtures/                # Shared JSON fixtures for CLI tests
│       ├── valid-basic-trace.json
│       ├── valid-clean-trace.json
│       ├── broken-low-score-trace.json
│       ├── broken-duplicate-trace.json
│       ├── context-overload-trace.json
│       ├── oversized-chunk-trace.json
│       ├── multi-rule-trace.json
│       ├── invalid-json.txt
│       └── invalid-schema.json
│
├── examples/
│   ├── basic-trace.json
│   ├── low-score-trace.json
│   └── context-overload-trace.json
│
├── docs/
│   ├── ARCHITECTURE.md          # this file
│   └── CONTRIBUTING.md
│
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── package.json
├── LICENSE
└── README.md
```

---

## Package Dependency Graph

Arrows represent `import` dependencies (pointing from consumer to dependency).

```
rag-doctor (CLI)
    │
    ├──▶ @rag-doctor/core
    │         │
    │         ├──▶ @rag-doctor/rules
    │         │         │
    │         │         └──▶ @rag-doctor/types
    │         │
    │         └──▶ @rag-doctor/types
    │
    ├──▶ @rag-doctor/diagnostics
    │         │
    │         └──▶ @rag-doctor/types
    │
    ├──▶ @rag-doctor/parser
    │         │
    │         └──▶ @rag-doctor/types
    │
    └──▶ @rag-doctor/reporters
              │
              ├──▶ @rag-doctor/diagnostics
              │         │
              │         └──▶ @rag-doctor/types
              │
              └──▶ @rag-doctor/types
```

**Key rules:**

- `@rag-doctor/core` has **no dependency on the CLI, parser, diagnostics, or reporters**. It only depends on `rules` and `types`. It is safe to embed in any host environment.
- `@rag-doctor/diagnostics` depends only on `@rag-doctor/types`. It does **not** depend on `core`, `parser`, `reporters`, or the CLI. It accepts a plain `AnalysisResult` object and is therefore embeddable anywhere.
- `@rag-doctor/reporters` depends on `@rag-doctor/diagnostics` so it can type-check the `DiagnosisResult` parameter of `printDiagnosisReport`. This is a one-way type dependency only.

---

## Package Reference

### @rag-doctor/types

**Role:** Single source of truth for all shared TypeScript interfaces.

**Exports:**

| Symbol | Kind | Description |
|---|---|---|
| `RetrievedChunk` | interface | A single chunk from the vector store |
| `NormalizedTrace` | interface | The normalized representation of one RAG execution |
| `Severity` | type | `"low" \| "medium" \| "high"` |
| `DiagnosticFinding` | interface | One finding produced by a rule |
| `DiagnosticRule` | interface | Contract that every rule must implement |
| `SeveritySummary` | interface | Counts of findings per severity |
| `AnalysisResult` | interface | The return type of the core engine |

**Has no runtime code.** All exports are TypeScript type/interface declarations. The compiled `dist/index.js` is a single empty re-export file.

---

### @rag-doctor/parser

**Role:** Converts arbitrary JSON input into a validated, typed `NormalizedTrace`. This is the only package that knows about raw input formats.

**Exports:**

| Symbol | Kind | Description |
|---|---|---|
| `normalizeTrace(input: unknown)` | function | Validates and normalizes raw trace JSON |
| `ParseError` | class | Thrown when validation fails; includes `field` for the offending field |

**Design decisions:**

- `input` is typed as `unknown`, forcing explicit validation of every field before use.
- All validation errors throw `ParseError` (not generic `Error`) so callers can distinguish parse failures from unexpected exceptions.
- Three internal assertion helpers (`assertObject`, `assertString`, `assertArray`) are defined in `errors.ts` and used throughout `normalize.ts` to keep validation code concise.
- The function is synchronous and has zero side effects — no file I/O, no logging.
- Future trace formats (e.g. LangSmith, LlamaIndex, Haystack) are isolated here. Adding a new format means adding a new normalizer function without touching the engine or rules.

**Validation rules:**

- `query`: required, non-empty string (whitespace trimmed)
- `retrievedChunks`: required array (may be empty)
- `retrievedChunks[n].id`: required non-empty string
- `retrievedChunks[n].text`: required string
- `retrievedChunks[n].score`: optional finite number (rejects `Infinity`, `NaN`, and string representations)
- `retrievedChunks[n].source`: optional string
- `finalAnswer`: optional string
- `metadata`: optional plain object passed through as-is; silently ignored if `null` or an array

---

### @rag-doctor/rules

**Role:** Implements all built-in diagnostic rules. Each rule is an object literal conforming to `DiagnosticRule`.

**Exports:**

| Symbol | Description |
|---|---|
| `DuplicateChunksRule` | Detects near-duplicate chunks via Jaccard token similarity |
| `LowRetrievalScoreRule` | Flags traces where average chunk score < 0.5 |
| `OversizedChunkRule` | Flags chunks longer than 1200 characters |
| `ContextOverloadRule` | Flags traces with more than 10 retrieved chunks |
| `defaultRules` | Array of all four rules above |

**Built-in rule details:**

#### `duplicate-chunks` (medium)

Uses Jaccard similarity on whitespace-tokenized, lowercased text. Two chunks are considered near-duplicates when their token-set overlap is ≥ 0.8. The finding includes the IDs of all duplicate pairs and their similarity scores.

> **Why Jaccard?** It is O(n) in set operations, requires no external dependencies, and works well on short text spans. Future versions may offer cosine similarity on embeddings as an optional enhancement.

#### `low-retrieval-score` (high)

Computes the arithmetic mean of all chunks that have a `score` field. Chunks without scores are excluded from the calculation. If no chunks have a score, the rule is skipped entirely (no false positives on unscored traces).

Threshold: `0.5` (fires when average < 0.5). Returns the three lowest-scoring chunks in `details` for quick diagnosis. The `details` object also includes `averageScore`, `threshold`, and `chunksEvaluated`.

#### `oversized-chunk` (low)

Compares `chunk.text.length` against 1200 characters. This is a character count (not token count) so it is model-agnostic. The finding includes the chunk IDs, lengths, and source references. All oversized chunks are reported in a single finding.

#### `context-overload` (medium)

Counts the total number of retrieved chunks. Fires when count > 10. Motivated by research on the "lost in the middle" phenomenon in LLM context handling. The `details` object includes `chunkCount` and `threshold`.

**Rule contract (`DiagnosticRule`):**

```typescript
interface DiagnosticRule {
  id: string;                                     // unique kebab-case identifier
  name: string;                                   // human-readable label
  run(trace: NormalizedTrace): DiagnosticFinding[];  // pure function, no side effects
}
```

Rules are plain object literals — no classes, no inheritance. `run()` must be a pure function: given the same trace, it must return the same findings.

---

### @rag-doctor/core

**Role:** Orchestrates rule execution and aggregates findings into an `AnalysisResult`. This is the library API that all integrations should depend on.

**Exports:**

| Symbol | Description |
|---|---|
| `analyzeTrace(trace, options?)` | Runs all rules, returns `AnalysisResult` |
| `AnalyzeOptions` | `{ rules?: DiagnosticRule[]; silent?: boolean }` |

Re-exports all types from `@rag-doctor/types` for consumer convenience.

**Engine algorithm:**

```
analyzeTrace(trace, options):
  rules = options.rules ?? defaultRules
  findings = []
  for each rule in rules:
    findings.push(...rule.run(trace))
  summary = count findings by severity
  return { findings, summary }
```

Rules are executed sequentially. There is no parallelism — rules are expected to be fast synchronous operations.

**`AnalyzeOptions.rules`** allows full replacement of the rule set. To extend the defaults:

```typescript
analyzeTrace(trace, { rules: [...defaultRules, myCustomRule] });
```

**Zero I/O guarantee:** `@rag-doctor/core` does not import `fs`, `path`, `process`, or any Node.js built-in. It is safe to bundle for browser environments.

---

### @rag-doctor/diagnostics

**Role:** Accepts an `AnalysisResult` and infers the most likely root cause(s) of the observed findings using a static heuristic table. This is Phase 2A of the RAG Doctor roadmap.

**Exports:**

| Symbol | Kind | Description |
|---|---|---|
| `diagnoseTrace(result)` | function | Infers root cause(s) from an `AnalysisResult`, returns `DiagnosisResult` |
| `DiagnosisResult` | interface | Complete diagnosis output (see type system below) |
| `RootCause` | interface | A single identified root cause with id, title, confidence, and summary |
| `DiagnosisEvidence` | interface | A finding projected into evidence form (ruleId, message, severity) |

**Design decisions:**

- Accepts `AnalysisResult` directly — it does **not** re-run analysis. The caller always runs `analyzeTrace` first and passes the result in. This preserves the single-responsibility boundary between analysis (rules) and diagnosis (heuristics).
- Contains **no I/O, no file system, no process references**. It is a pure, side-effect-free function. It can be embedded in a VS Code extension, a serverless function, or a browser app.
- Depends only on `@rag-doctor/types` — not on `@rag-doctor/core`, `@rag-doctor/parser`, `@rag-doctor/reporters`, or the CLI.
- All logic is deterministic: the same `AnalysisResult` will always produce the same `DiagnosisResult`.
- Heuristics are defined in a static table (`HEURISTICS` in `heuristics.ts`). Adding a new rule → diagnosis mapping requires only a new entry in that table.

**Diagnosis algorithm (`diagnoseTrace`):**

```
diagnoseTrace(analysisResult):
  if findings is empty → return null primary cause, empty arrays

  for each finding:
    evidence.push({ findingRuleId, findingMessage, severity })
    if heuristic exists for finding.ruleId:
      add finding to causeMap[causeId]

  if causeMap is empty → return null primary cause, evidence only

  for each candidate in causeMap:
    score = maxFindingSeverity(triggeringFindings) × 10
          + confidenceWeight(entry.confidence)

  sort candidates descending by score

  primaryCause   = candidates[0]
  contributing   = candidates[1..]

  recommendations = deduplicated union of all candidates' recommendation lists
                    (primary first, then contributing, preserving insertion order)

  return { primaryCause, contributingCauses, evidence, recommendations }
```

**Scoring formula:**

```
score(candidate) = max(SEVERITY_WEIGHT[finding.severity] for each triggering finding) × 10
                 + CONFIDENCE_WEIGHT[entry.confidence]

SEVERITY_WEIGHT:   { high: 3, medium: 2, low: 1 }
CONFIDENCE_WEIGHT: { high: 3, medium: 2, low: 1 }
```

The `× 10` multiplier ensures that a finding's severity always dominates the confidence tie-breaker. When two causes have the same score, the sort is stable (preserves the insertion order of `HEURISTICS`), which keeps output fully deterministic.

**Root cause categories (Phase 2A):**

| Cause ID | Triggered by rule | Confidence | Description |
|---|---|---|---|
| `retrieval-quality-degradation` | `low-retrieval-score` | high | Retriever returned low-relevance chunks |
| `duplicate-context-pollution` | `duplicate-chunks` | medium | Near-duplicate chunks dilute context quality |
| `oversized-chunking-strategy` | `oversized-chunk` | low | Chunks are too large, inflating token usage |
| `excessive-context-volume` | `context-overload` | medium | Too many chunks increase noise in the prompt |

**`DiagnosisResult` shape:**

```typescript
interface DiagnosisResult {
  primaryCause: RootCause | null;
  contributingCauses: RootCause[];
  evidence: DiagnosisEvidence[];
  recommendations: string[];
}

interface RootCause {
  id: string;
  title: string;
  confidence: "low" | "medium" | "high";
  summary: string;
}

interface DiagnosisEvidence {
  findingRuleId: string;
  findingMessage: string;
  severity: "low" | "medium" | "high";
}
```

---

### @rag-doctor/reporters

**Role:** Formats `AnalysisResult` and `DiagnosisResult` for different output targets. Ships two reporters; designed for future reporters (JSON file, Markdown, GitHub Annotations).

**Exports:**

| Symbol | Description |
|---|---|
| `printTerminalReport(result, options?)` | Renders a color-coded ANSI analysis report |
| `TerminalReportOptions` | `{ write?: (line: string) => void }` |
| `printDiagnosisReport(result, options?)` | Renders a color-coded ANSI diagnosis report |
| `DiagnosisReportOptions` | `{ write?: (line: string) => void }` |

**Terminal reporter output sections (`printTerminalReport`):**

1. Header with `RAG Doctor Report`
2. Separator line (`─`)
3. Severity summary table (Total / High / Medium / Low counts)
4. If no findings: a green `✓ No issues detected` message
5. If findings: sorted findings list (high → medium → low), each with severity label, message, and (if present) a `→` prefixed recommendation

**Diagnosis reporter output sections (`printDiagnosisReport`):**

1. Header with `RAG Doctor Diagnosis`
2. Separator line (`─`)
3. If no primary cause: a green `✓ No root cause identified` message
4. If primary cause: `Primary root cause:` block with confidence label, bold title, and prose summary
5. If contributing causes: `Contributing causes:` block listing each cause with its confidence label, title, and summary
6. If evidence: `Evidence:` block listing each finding with its severity label and message
7. If recommendations: `Recommendations:` block listing each item with a `→` prefix

Both reporters use the same `write` injection pattern for testability.

**ANSI color scheme:**

| Severity / Confidence | Color |
|---|---|
| HIGH | Red |
| MEDIUM | Yellow |
| LOW | Green |

Colors are implemented as inline ANSI escape sequences in `src/ansi.ts` — no external color library dependency. Helper functions exported: `bold`, `dim`, `red`, `yellow`, `green`, `cyan`.

---

### rag-doctor (CLI)

**Role:** User-facing command-line tool. Wires together parser → core → diagnostics → reporters and handles all process-level concerns (argv, file I/O, exit codes).

**Binary:** `rag-doctor` (registered in `package.json` `bin` field, pointing to `dist/bin.js`)

**Commands:**

```
rag-doctor analyze  <traceFile> [--json]
rag-doctor diagnose <traceFile> [--json]
rag-doctor --help
```

**`CliIO` interface:**

```typescript
interface CliIO {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  exit(code: number): never;
}
```

Production code uses `processIO` (backed by `process.stdout`, `process.stderr`, `process.exit`). Tests inject a custom `CliIO` that captures output and throws `CliExitError` instead of killing the process, enabling fast in-process testing without subprocess overhead.

**Shared file-loading helper (`loadAndAnalyze`):**

Both `analyze` and `diagnose` commands share a single internal helper that encapsulates the common file-load pipeline. This eliminates duplication and ensures error handling is identical across both commands:

```
loadAndAnalyze(filePath, io):
  1. resolve absolute path from cwd
  2. check file existence → exit 1 with "File not found" error if missing
  3. readFileSync → exit 1 if unreadable
  4. JSON.parse → exit 1 if not valid JSON
  5. normalizeTrace() → exit 1 with ParseError message if invalid
  6. analyzeTrace()
  7. return AnalysisResult
```

**`analyze` command execution flow:**

```
1. loadAndAnalyze(filePath, io) → AnalysisResult
2. if --json: JSON.stringify(result) to stdout; return
   else: printTerminalReport(result)
3. if result.summary.high > 0: exit 1  (CI gate)
   Note: --json does NOT trigger exit 1 on high severity
```

**`diagnose` command execution flow:**

```
1. loadAndAnalyze(filePath, io) → AnalysisResult
2. diagnoseTrace(analysisResult) → DiagnosisResult
3. if --json: JSON.stringify(diagnosis) to stdout; return
   else: printDiagnosisReport(diagnosis)
4. if analysisResult.summary.high > 0: exit 1  (CI gate)
   Note: --json does NOT trigger exit 1 on high severity
```

Exit codes are driven by the underlying `AnalysisResult` severity — the diagnose command gates on the same `high > 0` condition as analyze. This ensures consistent CI behavior regardless of which command is used.

**Exit codes:**

| Code | Meaning |
|---|---|
| `0` | Command ran successfully; zero high-severity findings (or `--json` mode regardless of findings) |
| `1` | One or more high-severity findings in terminal mode, OR an error occurred (file not found, invalid JSON, invalid schema) |

**`tsup` build config:** Two entries (`bin` and `index`). The `bin` entry uses a `banner: { js: "#!/usr/bin/env node" }` to inject the shebang into `dist/bin.js`, and `onSuccess` makes it executable (`chmod 755 dist/bin.js`).

**Programmatic exports** (`src/index.ts`): `run`, `parseArgs`, `buildHelpText`, `runAnalyzeCommand`, `runDiagnoseCommand`, `CliExitError`, `CliIO`.

---

## Data Flow

### `analyze` command

```
User
  │
  │  trace.json (raw JSON file)
  ▼
apps/cli  ──readFileSync──▶  raw string
                │
                │  JSON.parse
                ▼
          raw unknown object
                │
                │  normalizeTrace()       @rag-doctor/parser
                ▼
          NormalizedTrace
                │
                │  analyzeTrace()         @rag-doctor/core
                ▼
          AnalysisResult
         { findings[], summary }
                │
         ┌──────┴──────┐
         │             │
  --json flag      terminal
         │             │
  JSON to stdout  printTerminalReport()   @rag-doctor/reporters
                        │
                   ANSI output to stdout
```

### `diagnose` command

```
User
  │
  │  trace.json (raw JSON file)
  ▼
apps/cli  ──readFileSync──▶  raw string
                │
                │  JSON.parse + normalizeTrace()   @rag-doctor/parser
                ▼
          NormalizedTrace
                │
                │  analyzeTrace()                  @rag-doctor/core
                ▼
          AnalysisResult
         { findings[], summary }
                │
                │  diagnoseTrace()                 @rag-doctor/diagnostics
                ▼
          DiagnosisResult
    { primaryCause, contributingCauses,
      evidence, recommendations }
                │
         ┌──────┴──────┐
         │             │
  --json flag      terminal
         │             │
  JSON to stdout  printDiagnosisReport()           @rag-doctor/reporters
                        │
                   ANSI output to stdout
```

---

## Type System

The entire codebase runs under TypeScript `strict: true` with three additional flags:

| Flag | Effect |
|---|---|
| `exactOptionalPropertyTypes` | Prevents assigning `undefined` to optional fields explicitly |
| `noUncheckedIndexedAccess` | Array/object index access returns `T \| undefined`, forcing null checks |
| `noImplicitOverride` | Class method overrides must be explicitly marked |

`moduleResolution: "bundler"` is used so that TypeScript resolves `.js` import extensions to `.ts` source files — allowing standard ESM imports with `.js` suffixes in source that will resolve correctly after compilation.

All packages output **ESM only** (`"type": "module"` in every `package.json`). CommonJS interop is left to consumers via their own build tools.

---

## Diagnostic Rules

### Rule Interface

```typescript
interface DiagnosticRule {
  id: string;
  name: string;
  run(trace: NormalizedTrace): DiagnosticFinding[];
}
```

### Finding Interface

```typescript
interface DiagnosticFinding {
  ruleId: string;
  ruleName: string;
  severity: "low" | "medium" | "high";
  message: string;
  recommendation?: string;
  details?: Record<string, unknown>;
}
```

The `details` field carries structured data (e.g. duplicate pair IDs, average scores, oversized chunk IDs) for programmatic consumers such as a VS Code extension or dashboard.

### Built-in Thresholds

| Rule | Threshold | Configurable |
|---|---|---|
| Jaccard duplicate similarity | ≥ 0.8 | Not yet — planned via rule options |
| Low retrieval score | avg < 0.5 | Not yet |
| Oversized chunk | > 1200 chars | Not yet |
| Context overload | > 10 chunks | Not yet |

Per-rule configuration is planned for a future release via an options parameter on `DiagnosticRule.run()`.

---

## Root Cause Diagnosis

The diagnosis layer sits **above** the analysis engine and **below** the reporters. It takes findings as input and reasons about their likely systemic cause.

### Why a separate package?

- `@rag-doctor/core` is intentionally rule-only. Adding heuristic reasoning there would conflate two distinct concerns: what is wrong (rules) vs. why it is wrong (diagnosis).
- `@rag-doctor/diagnostics` can be versioned and extended independently. New heuristics can be shipped without touching the rules or the engine.
- Keeping it dependency-free (except `@rag-doctor/types`) ensures it remains embeddable in any environment where `@rag-doctor/core` is used.

### Heuristic table

All rule → cause mappings live in the `HEURISTICS` constant in `heuristics.ts`. Each entry is a `HeuristicEntry`:

```typescript
interface HeuristicEntry {
  ruleId: string;          // matches DiagnosticFinding.ruleId
  causeId: string;         // stable identifier for the root cause category
  causeTitle: string;      // human-readable title
  confidence: "low" | "medium" | "high";
  summary: string;         // prose explanation for the diagnosis report
  recommendations: string[];
}
```

Adding a new diagnosis mapping requires only a new object in the `HEURISTICS` array — no code changes elsewhere.

### Prioritization

When multiple rules fire simultaneously, the analyzer scores each candidate cause and sorts descending. The highest-scoring cause becomes `primaryCause`; the rest become `contributingCauses`.

**Score formula:** `maxFindingSeverity × 10 + confidence`

Where severity and confidence are mapped: `high = 3, medium = 2, low = 1`. The `× 10` multiplier guarantees that finding severity always dominates over confidence as a tie-breaker.

**Example — multi-finding trace:**

| Rule fires | Cause candidate | Max finding severity | Confidence | Score |
|---|---|---|---|---|
| `low-retrieval-score` | `retrieval-quality-degradation` | high (3) | high (3) | 33 |
| `duplicate-chunks` | `duplicate-context-pollution` | medium (2) | medium (2) | 22 |
| `context-overload` | `excessive-context-volume` | medium (2) | medium (2) | 22 |

Result: `retrieval-quality-degradation` is primary; the other two are contributing (stable-sorted by `HEURISTICS` insertion order).

### Recommendations deduplication

Recommendations are collected from all matched causes in score order (primary first, then contributing). A `Set<string>` tracks seen strings so that identical recommendations from different causes are never repeated. Insertion order is preserved, giving a deterministic, deduplicated list.

---

## Build System

Every package uses **tsup** for compilation.

**Why tsup?** It wraps esbuild for fast bundling and uses the TypeScript compiler only for declaration (`.d.ts`) generation, giving the best of both worlds: esbuild speed for JS, tsc accuracy for types.

**Per-package tsup config (packages):**

```typescript
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
});
```

**CLI tsup config** (`apps/cli/tsup.config.ts`) uses two entries:

```typescript
export default defineConfig({
  entry: { bin: "src/bin.ts", index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  onSuccess: "chmod 755 dist/bin.js",
});
```

**Root `tsconfig.base.json`** sets the shared compiler options (`target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, strict flags). Each package extends it and sets its own `outDir` and `rootDir`. The `types: ["node"]` override is applied only to packages that use Node.js APIs (`reporters`, `cli`).

**pnpm workspaces** link packages locally using the `workspace:*` protocol, so changes in `packages/types` are immediately reflected in `packages/core` without re-publishing.

**Build order** is handled automatically by pnpm's dependency graph — `types` builds first, then `parser`/`rules`/`diagnostics` in parallel, then `core`/`reporters` in parallel, then `cli`.

---

## Testing Strategy

All tests use **Vitest**. The suite contains approximately 367 tests across eight test files.

| Package | Test file | Tests | Coverage |
|---|---|---|---|
| `parser` | `normalize.test.ts` | ~50 | Valid input, field trimming, missing fields, type errors, optional fields, score edge cases (Infinity, NaN, 0, 1), metadata passthrough and silent-ignore, `ParseError` properties |
| `rules` | `rules.test.ts` | ~56 | Each rule: fires / does not fire, correct severity, threshold boundaries, structured `details` fields, edge cases (empty list, single chunk, no scores) |
| `core` | `engine.test.ts` | ~23 | Default rules, custom rule injection, empty rule set, summary correctness, real rule scenarios against fixtures |
| `diagnostics` | `root-cause-analyzer.test.ts` | ~29 | All four heuristic mappings, multi-finding with primary + contributing, no findings, unknown rule ID, determinism |
| `reporters` | `terminal.reporter.test.ts` | ~29 | Output structure, zero-findings path, severity labels, sort order, recommendation rendering, injectable `write` |
| `reporters` | `diagnosis.reporter.test.ts` | ~23 | Header, confidence labels, primary cause, contributing causes, evidence, recommendations, healthy path, injectable `write` |
| `cli` (unit) | `cli.test.ts` | ~98 | `parseArgs`, `buildHelpText`, all `analyze` and `diagnose` command paths, all error paths, `--json` mode, exit codes, in-process via `CliIO` injection |
| `cli` (integration) | `cli.integration.test.ts` | ~35 | End-to-end subprocess via `spawnSync`; skipped unless `dist/bin.js` exists (`describe.skipIf`) |

**Test fixtures** (`tests/fixtures/`):

| File | Triggers |
|---|---|
| `valid-basic-trace.json` | Nothing (clean trace with high scores) |
| `valid-clean-trace.json` | Nothing (minimal clean trace) |
| `broken-low-score-trace.json` | `low-retrieval-score` (HIGH) — avg ≈ 0.22 |
| `broken-duplicate-trace.json` | `duplicate-chunks` (MEDIUM) — 3 identical chunks |
| `context-overload-trace.json` | `context-overload` (MEDIUM) — 12 chunks |
| `oversized-chunk-trace.json` | `oversized-chunk` (LOW) — one chunk > 1200 chars |
| `multi-rule-trace.json` | `low-retrieval-score` + `duplicate-chunks` + `context-overload` |
| `invalid-json.txt` | Parse error (not valid JSON) |
| `invalid-schema.json` | Schema error (valid JSON, wrong shape) |

**Testing philosophy:**

- Rules are tested as pure functions against constructed `NormalizedTrace` fixtures — no file I/O.
- The `diagnoseTrace` function is tested as a pure function against constructed `AnalysisResult` fixtures — no file I/O, no rule execution.
- Both reporters use the injected `write` function to capture output into an array — no stdout mocking.
- The core engine is tested with both default and custom rule sets to verify the injection point works correctly.
- CLI unit tests use `CliIO` injection and catch `CliExitError` for controlled exit assertions — no subprocess overhead.
- CLI integration tests use `spawnSync` against the compiled `dist/bin.js` and are guarded by `describe.skipIf(!binExists)` so they are skipped in CI environments where the build has not yet run.
- No snapshot tests — string content assertions are used so tests remain readable and refactor-friendly.

---

## Adding Custom Rules

### 1. Implement the interface

```typescript
// my-rules/src/empty-answer.rule.ts
import type { DiagnosticRule, DiagnosticFinding, NormalizedTrace } from "@rag-doctor/types";

export const EmptyAnswerRule: DiagnosticRule = {
  id: "empty-answer",
  name: "Empty Final Answer",

  run(trace: NormalizedTrace): DiagnosticFinding[] {
    if (trace.finalAnswer && trace.finalAnswer.trim().length > 0) {
      return [];
    }

    return [
      {
        ruleId: this.id,
        ruleName: this.name,
        severity: "high",
        message: "The pipeline produced no final answer.",
        recommendation:
          "Check that your LLM call is completing and that the response is being captured correctly.",
      },
    ];
  },
};
```

### 2. Pass it to the engine

```typescript
import { analyzeTrace } from "@rag-doctor/core";
import { defaultRules } from "@rag-doctor/rules";
import { EmptyAnswerRule } from "./empty-answer.rule.js";

const result = analyzeTrace(trace, {
  rules: [...defaultRules, EmptyAnswerRule],
});
```

### 3. Optionally extend the heuristic table

If you want `diagnoseTrace` to recognize your custom rule, add an entry to `HEURISTICS` in `packages/diagnostics/src/heuristics.ts`:

```typescript
{
  ruleId: "empty-answer",
  causeId: "missing-llm-response",
  causeTitle: "Missing LLM Response",
  confidence: "high",
  summary: "The LLM call completed but produced no answer.",
  recommendations: [
    "Verify the LLM API response format matches your parser",
    "Check for silent failures in your answer extraction logic",
  ],
},
```

No other code changes are required — the analyzer will automatically pick up the new mapping.

### 4. Use it from the CLI (programmatic wrapper)

The CLI's `run()` function is exported for programmatic use:

```typescript
import { run } from "rag-doctor";
run(["diagnose", "trace.json"]);
```

For a custom CLI that injects rules, import `analyzeTrace` and `diagnoseTrace` directly and bypass the CLI entirely.

---

## Future Integrations

The architecture is specifically designed to make these integrations straightforward:

### VS Code Extension

- Import `@rag-doctor/core`, `@rag-doctor/parser`, and `@rag-doctor/diagnostics` directly — all three are browser-safe (no Node.js built-ins).
- Call `analyzeTrace()` when the user saves a `.json` trace file.
- Call `diagnoseTrace()` on the result to surface root cause hints in the editor sidebar.
- Map `DiagnosticFinding.severity` to VS Code `DiagnosticSeverity`.
- Use `finding.details` for hover tooltips.

### GitHub Action

```yaml
- name: Diagnose RAG trace
  run: npx rag-doctor diagnose trace.json
```

Exit code 1 on `high`-severity findings makes this a natural CI gate with no additional configuration. Use `--json` for structured output in downstream steps:

```yaml
- name: Diagnose RAG trace (JSON)
  run: npx rag-doctor diagnose trace.json --json > diagnosis.json
```

### Cloud Dashboard

- Call `analyzeTrace()` inside a serverless function or API route.
- Call `diagnoseTrace()` on the result.
- Serialize `DiagnosisResult` alongside `AnalysisResult` to a database.
- Aggregate `primaryCause.id` counts across traces to surface the most common root causes in production.

### Custom Reporters

Add a new file to `@rag-doctor/reporters`:

```typescript
export function printMarkdownReport(result: AnalysisResult): string {
  // ...
}

export function printMarkdownDiagnosisReport(result: DiagnosisResult): string {
  // ...
}
```

Both reporters receive plain value objects — they have no knowledge of how the analysis or diagnosis was performed.

---

## Design Principles

### 1. Parse at the boundary, trust internally

`normalizeTrace()` in `@rag-doctor/parser` is the only place that touches `unknown` typed data. Once a `NormalizedTrace` is returned, all downstream code operates on fully typed values.

### 2. Rules are data, not classes

Rules are plain object literals implementing a two-field interface. No abstract base classes, no inheritance, no decorators. This keeps rules trivially portable — a rule can live in a separate npm package, a private repository, or a local file.

### 3. The engine is a pure function

`analyzeTrace()` takes a trace and options and returns a result. It has no global state, no module-level side effects, and no I/O. Calling it twice with the same input will always produce the same output.

### 4. Diagnosis is a pure function

`diagnoseTrace()` takes an `AnalysisResult` and returns a `DiagnosisResult`. It has no global state, no I/O, and no external dependencies beyond `@rag-doctor/types`. Like `analyzeTrace`, it is safe to call from any host environment.

### 5. Reporters are injectable

All reporters accept a `write` function parameter. This decouples the formatting logic from process I/O, making reporters fully testable and reusable in non-terminal environments.

### 6. Findings carry structured data

Every `DiagnosticFinding` includes an optional `details` field for machine-readable context (e.g. which chunk IDs were duplicates, what the average score was). This allows programmatic consumers to act on findings without parsing human-readable messages.

### 7. The CLI is an injectable seam

`CliIO` decouples process-level I/O from command logic. The production `processIO` object is swapped out in tests for a captured-output implementation, enabling fast in-process unit tests alongside the subprocess-based integration suite.

### 8. Shared logic is extracted, not duplicated

The `loadAndAnalyze` helper in the CLI encapsulates the file-load → parse → normalize → analyze pipeline once. Both the `analyze` and `diagnose` commands call it, ensuring error messages, exit codes, and validation behavior remain identical across commands without copy-paste.

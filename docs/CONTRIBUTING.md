# Contributing to RAG Doctor

Thank you for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/your-org/rag-doctor.git
cd rag-doctor
pnpm install
pnpm build
```

## Project Structure

Each package in `packages/` is independently versioned and publishable. The `apps/cli` package is the user-facing CLI.

## Adding a New Diagnostic Rule

1. Create a file in `packages/rules/src/my-rule.rule.ts`
2. Implement the `DiagnosticRule` interface from `@rag-doctor/types`
3. Export it from `packages/rules/src/index.ts`
4. Add it to the `defaultRules` array
5. Write tests in `packages/rules/src/__tests__/`

## Code Style

- All code is TypeScript with strict mode enabled
- Run `pnpm lint` and `pnpm typecheck` before submitting
- Write tests for any new rules or features

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-rule`
3. Make your changes with tests
4. Run `pnpm build && pnpm test`
5. Submit a pull request

## Releasing

This project uses changesets for versioning. Add a changeset with `pnpm changeset` before submitting significant changes.

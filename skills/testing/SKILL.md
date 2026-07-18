---
name: testing
description: Use when writing tests, running tests, adding test coverage, or debugging test failures. Detects the language and its test runner (JS/TS, Python, Go, Rust) for unit and component testing.
allowed-tools: Read Glob Grep Write Edit Bash(pnpm:*) Bash(npm:*) Bash(bun:*) Bash(yarn:*) Bash(pytest:*) Bash(python:*) Bash(python3:*) Bash(go:*) Bash(cargo:*)
model: haiku
effort: medium
compatibility: Any language with a test runner; JS/TS (Vitest/Jest/node:test) is best-supported, Python (pytest/unittest), Go (go test) and Rust (cargo test) covered via references/
---

You are an expert test engineer. You detect the project's language and test runner, then write, run, or review tests using that ecosystem's idioms.

## Routing

Determine the test type from the user's request:

- **E2E / browser testing** (keywords: "e2e", "end-to-end", "browser", "playwright", "page interaction", "screenshot") → Out of scope for this skill. Point the user to their agent's own browser/E2E automation tooling (e.g. Playwright, or a dedicated browser-automation capability) and stop.
- **Unit / component testing** → Proceed with the workflow below.

## Mode Detection

Classify the request before acting, and default to read-only when intent is ambiguous or diagnostic:

- **Review (read-only, default)** — "review", "audit", "check", or "assess" test quality or coverage. Read the tests and source, then produce an evidence-backed report (gaps, weak assertions, missing edge cases) and make NO file edits. Skip Steps 4-5.
- **Run** — the user explicitly asks to run or execute the existing tests. Run Step 5 (run and verify) and report the results; do not write new tests or edit failing ones unless also asked.
- **Write / Fix** — the user explicitly asks to write, add, create, or fix tests, to debug failing tests, or to increase/improve coverage or cover edge cases. Run Step 4 (write test files) and Step 5 (run and verify). Running tests to observe failures, then editing tests, is allowed in this mode.

When intent is ambiguous, stay in Review mode and end the report by offering to write or run the tests.

## Universal Rules (apply to every language)

These rules carry the language-neutral principles — read them regardless of ecosystem:

| Rule | Impact | File |
|------|--------|------|
| Test structure | HIGH | `rules/test-structure.md` |
| Test quality | MEDIUM | `rules/test-quality.md` |

## Workflow

### Step 1: Detect Language and Runner

Detect the project's language from its manifest/lockfile, then load the matching ecosystem guide:

| Language | Detected by | Runner(s) | Ecosystem guide |
|----------|-------------|-----------|-----------------|
| **JS/TS** | `package.json` | Vitest · Jest · node:test | `rules/js-runner-patterns.md` (+ `rules/component-testing.md` for UI components) |
| **Python** | `pyproject.toml`, `requirements*.txt`, `setup.py`, `setup.cfg`, `tox.ini` | pytest · unittest | `references/python.md` |
| **Go** | `go.mod` | `go test` (stdlib `testing`) | `references/go.md` |
| **Rust** | `Cargo.toml` | `cargo test` (built-in `#[test]`) | `references/rust.md` |

Load **only** the guide for the detected language — do not read the others. If a project mixes languages, handle the one the user's target file belongs to. For a language not listed above (e.g. Ruby), apply the Universal Rules and the project's existing test conventions; note that first-class support for it is not yet bundled.

### Step 2: Detect Project Setup

Scan the project to match existing conventions:

1. **Runner**: identify the runner per the ecosystem guide (e.g. Vitest vs Jest vs node:test for JS/TS; pytest vs unittest for Python)
2. **Existing tests**: find the naming and location convention already in use (`*.test.ts`, `*.spec.ts`, `test_*.py`, `*_test.go`, colocated vs a `tests/` directory)
3. **Package manager / toolchain**: for JS/TS check `pnpm-lock.yaml`, `bun.lock`, `yarn.lock`, or `package-lock.json`

Match the project's existing patterns for naming, location, and imports.

### Step 3: Read Relevant Rules

- Always: the Universal Rules (`rules/test-structure.md`, `rules/test-quality.md`)
- The detected language's ecosystem guide from Step 1
- For JS/TS UI components: also `rules/component-testing.md`

### Step 4: Write Tests

Create the test file following project conventions:
1. Place the file according to the project's test location pattern
2. Use the project's naming convention
3. Follow the AAA pattern (Arrange, Act, Assert)
4. Cover the happy path, edge cases, and error cases — in the detected runner's idioms

### Step 5: Run and Verify

Run the tests using the project's test command:

```bash
# JS/TS — use the project's package manager
pnpm run test          # or npm/bun/yarn equivalent

# Python
pytest                 # or: python -m unittest

# Go
go test ./...
```

Report results. In **Write / Fix** mode only, if tests fail, read the error output, fix the test, and re-run. In **Run** mode, report the failures without editing any files.

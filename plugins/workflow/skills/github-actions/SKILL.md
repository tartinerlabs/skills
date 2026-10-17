---
name: github-actions
description: Use when adding CI/CD, creating workflows, auditing GitHub Actions, or fixing action pinning. Creates and audits workflows for SHA pinning and permissions.
license: MIT
allowed-tools: Read Glob Grep Edit Write Bash(gh:*)
model: sonnet
effort: high
context: fork
agent: general-purpose
compatibility: Targets GitHub Actions (GitHub-native); uses gh for SHA lookups; auto-detects project language (Node/JS-TS, Go, Python, Rust, Ruby)
metadata:
  short-description: Create and audit CI workflows.
---

## Mode Detection

Audit and report by default. Generate workflows only when asked to create, add, or set up CI — and **never merely because `.github/workflows/` is absent**; report that none were found instead. Apply fixes only when asked to fix or pin. When the ask is unclear, report and offer to apply the fixes.

## Create Mode

### 1. Detect Project Type

Scan for project indicators:
- `package.json` → Node.js/JS/TS
- `go.mod` → Go
- `requirements.txt` / `pyproject.toml` / `setup.py` → Python
- `Cargo.toml` → Rust
- `Gemfile` → Ruby

### 2. Detect Package Manager (JS/TS projects)

Detect the package manager from the lockfile, in this order: `nub.lock`, `pnpm-lock.yaml`, `bun.lock`/`bun.lockb`, `yarn.lock`, `package-lock.json`. With no lockfile, ask.

A `devEngines.packageManager` or `packageManager` field in `package.json` outranks any lockfile. For pnpm, prefer `devEngines.packageManager` over `packageManager`: pnpm 11+ and the `pnpm/setup` action read it first, and pnpm records the resolved version in `pnpm-lock.yaml`. Pin an exact version rather than a range, so every machine and CI run uses the same pnpm — resolve the current latest at setup time (`pnpm view pnpm version`) and write it as `{ "name": "pnpm", "version": "<latest>", "onFail": "download" }`. The same goes for the runtime: declare Node in `devEngines.runtime` (pnpm 10.14+ downloads it and records its checksum in the lockfile) rather than `.nvmrc` or `engines.node`, pinned to the current LTS resolved at setup time — `pnpm runtime set node lts` (pnpm 11.4+) writes the field; confirm the saved `version` is exact, not a range. Write that field when declaring pnpm; migrating a legacy `"packageManager": "pnpm@…"` is worthwhile but optional. Keep one declaration, not both — version switchers refuse a project whose two fields disagree. Yarn still needs `packageManager`, the only field it reads. Nub runs in compat-mode over another manager's lockfile, so `nub.lock` alongside `pnpm-lock.yaml` means nub — check the field before concluding from lockfiles alone.

### 3. Generate Workflow

Read each rule file in `rules/` and apply all of them when generating workflows.

Pin every action per `rules/action-pinning.md` before writing the workflow, including GitHub-owned `actions/*`. Resolve the intended release or source ref to a full commit SHA with `gh api repos/{owner}/{repo}/commits/{ref} --jq '.sha'`, then retain the release or source ref in a comment.

When the project commits migrations from a migration tool, also add a separate `migration-drift` job per `rules/migration-drift.md`, and tell the user to make it a required status check.

### 4. Workflow Template

Route by the language detected in Step 1. The template below is the **JS/TS default**; for any other detected language, load `references/<lang>.md` and use its template instead:

| Language | Template |
|----------|----------|
| **JS/TS** (Node) | the template below |
| **Go** | `references/go.md` |
| **Python** | `references/python.md` |
| **Rust** | `references/rust.md` |
| **Ruby** | `references/ruby.md` |

Every template applies the same `rules/` (action pinning, `permissions`, concurrency). Adapt the JS/TS template to the detected package manager (replace `<pm>` with the detected package manager):

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020  # v7.0.0
        with:
          node-version: 'lts/*'
          cache: '<pm>'
      - run: <pm> install --frozen-lockfile
      - run: <pm> check
      - run: <pm> test
      - run: <pm> build
```

For pnpm, replace the `actions/setup-node` and install steps with a single `pnpm/setup` step on its default settings (`rules/node-version.md`): with no inputs it installs pnpm from `devEngines.packageManager` and Node from `devEngines.runtime`, then runs `pnpm install`.

## Audit Mode

### 1. Scan Workflows

Read all `.yml` and `.yaml` files in `.github/workflows/` and audit against every rule in the `rules/` directory.

### 2. Report Format

Report each finding as `path:line` — what is wrong → the fix, grouped by severity, and close with per-severity counts and the number of files scanned.

Report **all** rule violations found, not just pinning and permissions — migration drift, concurrency, node version, caching, triggers, matrix, and parallel steps too.

### 3. Auto-Fix

When fixing, look up commit SHAs for pinning using `gh api`.

## Rules

| Rule | Impact | File |
|------|--------|------|
| Action pinning | HIGH | `rules/action-pinning.md` |
| Permissions | HIGH | `rules/permissions.md` |
| Migration drift | HIGH | `rules/migration-drift.md` |
| Concurrency | MEDIUM | `rules/concurrency.md` |
| Node version | MEDIUM | `rules/node-version.md` |
| Caching | MEDIUM | `rules/caching.md` |
| Triggers | LOW | `rules/triggers.md` |
| Matrix strategy | LOW | `rules/matrix.md` |
| Parallel steps | LOW | `rules/parallel-steps.md` |

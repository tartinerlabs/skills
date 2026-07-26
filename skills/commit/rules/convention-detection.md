---
title: Convention Detection
impact: HIGH
tags: detection, commitlint, commitizen, cocogitto, history, git-log, ecosystem
---

**Rule**: Determine the repository's commit convention before writing a message, using a strict precedence chain. Enforced tooling wins over observed history; observed history wins over ecosystem defaults. Never assume conventional commits because the project is JS/TS, and never assume plain format merely because no commitlint config exists.

### Why This Matters

Commit style tracks a project's release tooling and upstream culture, not its programming language. A Go CLI with `cog.toml` wants `feat:`; the Go standard library wants `math: improve Sin precision`; a Swift package on GitHub usually wants neither. Guessing from the manifest alone produces messages that CI rejects or that read as foreign to every other line of `git log`.

Work down the tiers and stop at the first that yields an answer.

### Tier 1 — Enforced Tooling (wins outright)

A tool that validates or consumes commit messages is a hard requirement, not a hint. Look for:

| Tool | Files |
|------|-------|
| commitlint | `commitlint.config.{ts,cts,mts,js,cjs,mjs}`, `.commitlintrc`, `.commitlintrc.{ts,cts,mts,js,cjs,mjs,json,yaml,yml}`, `commitlint` key in `package.json`/`package.yaml` |
| commitizen | `.cz.toml`, `.cz.json`, `.cz.yaml`, `[tool.commitizen]` in `pyproject.toml` |
| cocogitto | `cog.toml` |
| git-cliff | `cliff.toml`, `.git-cliff.toml`, `[tool.git-cliff]` in `pyproject.toml` |
| release-please | `release-please-config.json`, `.release-please-manifest.json` |
| semantic-release | `.releaserc`, `.releaserc.{json,yaml,yml,js,cjs}`, `release` key in `package.json` |
| gitlint | `.gitlint` |
| commit-msg hook | `.githooks/commit-msg`, `.husky/commit-msg`, `core.hooksPath` target |

- Any of the first six → **conventional commits** (see `rules/message-format.md`). These tools parse types to generate changelogs and version bumps; a non-conforming message breaks the release.
- A `commit-msg` hook or `.gitlint` → **read the file** and follow what it actually enforces. It may enforce conventional commits, a header length, or a custom regex.
- `CONTRIBUTING.md` (or `docs/contributing.md`) containing a commit-message section → read it and follow it. An explicit written rule outranks inferred history.

Check whether the tool restricts the type list or scope enumeration (commitlint `type-enum`/`scope-enum`, commitizen `bump_map`) and stay within it.

### Tier 2 — Observed History

With no enforcing tooling, the repository's own log is the authority. The Git project's contributor guide instructs contributors to do exactly this to find the right prefix.

```
git log --no-merges -n 30 --format=%s
```

Require at least 10 non-merge commits for a verdict. Classify each subject:

| Family | Pattern | Example |
|--------|---------|---------|
| Conventional | `^(feat\|fix\|docs\|style\|refactor\|perf\|test\|build\|ci\|chore\|revert)(\(.+\))?!?: ` | `fix(auth): handle expired token` |
| Area prefix | `^[a-z0-9][a-z0-9._/-]*: ` and not conventional | `math: improve Sin precision` |
| Bracket tag | `^\[[^\]]+\] ` | `[stdlib] Fix Comparable conformance` |
| Tracker ID | `^(gh-\d+\|#\d+\|[A-Z][A-Z0-9]+-\d+): ` | `gh-12345: Make spam module spammy` |
| Plain | none of the above | `Fix auth redirect for expired tokens` |

If one family covers **70% or more** of the sample, adopt it. Otherwise fall through to Tier 3.

When the winner is area prefix or bracket tag, extract two sub-conventions — they are where otherwise-similar projects diverge:

1. **Prefix vocabulary** — collect the distinct prefixes in use and pick the one matching the files being staged. Narrow the sample if helpful: `git log --no-merges -n 20 --format=%s -- <path>`.
2. **Capitalisation of the first word after the prefix** — Go and Git require lowercase; Swift, Chromium, and CPython capitalise. Do not guess; count.

Also note from the sample whether subjects carry trailing periods (they should not) and whether `Signed-off-by` trailers appear in `git log -n 10 --format=%b` — some projects require them.

### Tier 3 — Ecosystem Default

Only when Tiers 1 and 2 are both silent — a fresh repository, a shallow clone, or a log with no clear majority. Read the manifest as prose and load **only** the matching guide:

| Signal | Guide |
|--------|-------|
| `go.mod` | `references/go.md` |
| `Package.swift`, `*.xcodeproj`, `*.xcworkspace` | `references/swift.md` |
| `pyproject.toml`, `setup.py`, `setup.cfg` | `references/python.md` |
| `Makefile` + `MAINTAINERS`/`Kbuild`, or a mirror of git/linux/chromium | `references/systems.md` |

This tier is a weak signal by design. Ecosystem upstreams and the applications written in those languages frequently disagree — most Go and Python *applications* use conventional commits even though their language upstreams do not. When the decision rests on Tier 3, say which convention was chosen and why in the response to the user, so a wrong guess is visible and correctable.

### Tier 4 — Plain Format

Nothing detected: plain imperative subject, 50/72. See `rules/message-format.md`.

### Do Not

- Do not create, edit, or install commit tooling to force a convention. If the project lacks a `commit-msg` hook, report it and point to the `setup` skill.
- Do not switch a repository's convention. If history is plain and the user asks for a commit, write plain — even if conventional commits would be "better".

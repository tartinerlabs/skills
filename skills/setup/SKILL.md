---
name: setup
description: Use when setting up a project, adding linting, formatting, git hooks, or type checking. Detects the language and installs that ecosystem's lint/format/hooks toolchain (JS/TS, Python, Go).
allowed-tools: Read Glob Write Edit Bash(pnpm:*) Bash(pnx:*) Bash(npm:*) Bash(bun:*) Bash(yarn:*) Bash(uv:*) Bash(poetry:*) Bash(pip:*) Bash(ruff:*) Bash(go:*) Bash(golangci-lint:*) Bash(pre-commit:*)
model: haiku
effort: low
compatibility: Any language project; sets up that ecosystem's lint/format/hooks + git secret scanning (JS/TS best-supported, Python and Go via references/)
---

You are a tooling setup assistant. Detect the project's language, then auto-detect what's missing and install everything that's not already configured for that ecosystem.

## 0. Detect Language and Route

Detect the project's language from its manifest, then follow the matching setup guide:

| Language | Detected by | Setup guide |
|----------|-------------|-------------|
| **JS/TS** | `package.json` | the `rules/*.md` files below (Biome · Husky · commitlint · lint-staged · GitLeaks · TypeScript) |
| **Python** | `pyproject.toml`, `requirements*.txt`, `setup.py`, `setup.cfg` | `references/python.md` (Ruff · mypy · pre-commit · GitLeaks) |
| **Go** | `go.mod` | `references/go.md` (gofmt · golangci-lint · pre-commit · GitLeaks) |

Load **only** the guide for the detected language. For a language not listed (e.g. Rust, Ruby), set up its standard formatter/linter and wire GitLeaks into a pre-commit hook, following the same shape; note that first-class support for it is not yet bundled. GitLeaks (secret scanning) is set up in **every** ecosystem — it is cross-language.

The rest of this file (Steps 1-5) is the **JS/TS** path. For Python or Go, follow the referenced guide, then jump to Step 5 (Supply Chain Hardening) which applies to any ecosystem.

## 1. Detect Package Manager

Check for lockfiles in this order:
1. `pnpm-lock.yaml` → **pnpm**
2. `bun.lock` / `bun.lockb` → **bun**
3. `yarn.lock` → **yarn**
4. `package-lock.json` → **npm**
5. No lockfile → ask the user

Use the detected package manager for all install commands. Replace `<pm>` in rule files with the detected manager.

## 2. Detect Existing Tooling

Before installing anything, scan for existing configurations:
- `biome.json` / `biome.jsonc` → Biome already configured
- `.husky/` directory → Husky already configured
- commitlint config listed in `rules/commitlint.md` → commitlint already configured
- `.lintstagedrc*` / `lint-staged` key in `package.json` → lint-staged already configured
- `gitleaks` in `.husky/pre-commit` → GitLeaks already configured
- `tsconfig.json` → TypeScript already configured
- `.eslintrc*` / `eslint.config.*` → ESLint present (suggest migration to Biome)
- `.prettierrc*` / `prettier.config.*` → Prettier present (suggest migration to Biome)

**Skip tools that are already configured.** Report what was skipped at the end.

## 3. Install Tools

Read each rule file for detailed setup instructions and config files.

> These tables use a `Purpose` column rather than the `Impact` column found in audit skills — setup rules are install guides for tools to add, not severity-ranked findings, so there is no impact level to report.

### Auto-install (always set up when missing)

| Tool | Purpose | Rule |
|------|---------|------|
| Biome | Linting + formatting | `rules/biome.md` |
| Husky | Git hooks | `rules/husky.md` |
| commitlint | Conventional commits | `rules/commitlint.md` |
| lint-staged | Pre-commit linting | `rules/lint-staged.md` |
| GitLeaks | Secrets detection | `rules/gitleaks.md` |
| TypeScript | Type checking | `rules/typescript.md` |

### Opt-in (only when explicitly requested)

| Tool | Purpose | Rule |
|------|---------|------|
| semantic-release | Automated versioning | `rules/semantic-release.md` |

## 4. Output Summary

After all tools are installed, display a summary:

```
## Setup Complete

### Installed
- [list of tools installed]

### Skipped (already configured)
- [list of tools skipped with reason]

### Next Steps
- Run `<pm> run check` to verify Biome is working
- Make a test commit to verify git hooks
```

## 5. Supply Chain Hardening

After tooling setup is complete, check if the `deps` skill is available by looking for `skills/deps/SKILL.md` relative to this skill's directory. If it exists, run `/deps` to harden the ecosystem's dependency supply chain (it detects the language too). If it does not exist, skip this step silently.

## Compatibility

Works on any language project — detect the ecosystem (Step 0) and install its lint/format/hooks toolchain: JS/TS is the best-supported path (`rules/*.md`), with Python and Go covered via `references/`. Requirements: Git is initialised in the project, and a secret scanner (GitLeaks default) is installed on the system (`brew install gitleaks` or equivalent) — GitLeaks is wired into the pre-commit hook in every ecosystem.

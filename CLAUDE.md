# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Repository:** https://github.com/tartinerlabs/skills
**Package:** `@tartinerlabs/skills`

A collection of agent skills distributed via Claude Code, Codex, Cursor, and [skills.sh](https://skills.sh). Each skill is a markdown file with YAML frontmatter following the [Agent Skills spec](https://agentskills.io).

## Development

- **Tooling:** stdlib-only Go plus plain shell git hooks — the repo deliberately avoids npm dependencies to keep the supply-chain surface minimal
- **Git hooks:** plain shell hooks in `.githooks/` (enable with `git config core.hooksPath .githooks`) — `commit-msg` enforces conventional commits (no scope, max 50-char header), `pre-commit` runs GitLeaks secrets detection
- **Validation:** `go run ./scripts/validate-skills` checks skill structure, manifest versions, symlinks, and action pinning; `go test ./...` runs its test suite. Stdlib-only Go — no module dependencies to install
- **Releases:** Automated via release-please on push to `main` — maintains a release PR from conventional commits; merging it bumps versions, updates `CHANGELOG.md`, and creates the GitHub release

## Skill Format

Each skill lives in `skills/<name>/SKILL.md` with this structure:

```markdown
---
name: skill-name
description: What it does and when to use it
allowed-tools: Space-delimited list of permitted tools
model: sonnet
effort: medium
---

[Instructions Claude follows when the skill is active]
```

### Frontmatter Fields

- `name` — Skill identifier, invoked as `/skill-name` in Claude Code
- `description` — Purpose and trigger conditions
- `allowed-tools` — Scoped tool permissions (e.g., `Bash(git status)` for specific commands, `Read` for full tool access)
- `model` — Model preference. Low/medium-effort skills default to `haiku` (cheaper, separate rate-limit bucket); high-effort skills that need deeper reasoning (forked subagents, complex audits) use `sonnet`
- `effort` — Reasoning effort level (`low`, `medium`, `high`, `max`). Overrides the session effort level while the skill is active
- `compatibility` — Portable Agent-Skills-spec field declaring the skill's real requirements (e.g. `Requires git`, `Any language project; detects the ecosystem`). Every in-scope skill carries one. Unlike `model`/`effort`/`context: fork` (Claude-Code-only, ignored gracefully elsewhere), `compatibility` is portable across all distribution channels

### Language-aware, JS/TS-first model

Every skill is **language-aware with JS/TS as the first-class default** — no skill assumes React or a single framework/host. Skills **detect, don't assume**: read the project's manifest (`package.json`/`pyproject.toml`/`go.mod`/…) as prose (never `!`-shell-injection, which is Claude-Code-only) and adapt. The general workflow/audit skills work in any language, gating framework-specific rules behind detection. The ecosystem tooling (`setup`, `deps`, `testing`) is polyglot. `tailwind` is the one inherent JS/CSS specialist (out of scope for the platform-agnostic pass). Secret scanning is abstracted: `commit`/`security`/`setup`/`deps` accept any scanner (GitLeaks default, TruffleHog accepted), not a hard-coded tool.

### Rules and References Pattern

Skills with multiple checks use a `rules/` subdirectory alongside `SKILL.md`. The main skill file references rules via a table and tells Claude to read them at runtime. Each rule file is a standalone markdown document with severity, examples, and fix instructions. This keeps skills modular — rules can be added, removed, or edited independently.

Polyglot skills add a `references/` subdirectory for **progressive disclosure**: SKILL.md detects the language and loads **only** the matching `references/<lang>.md` (e.g. `references/python.md`, `references/go.md`), so a JS project never loads Go content. The asymmetry is intentional — the first-class JS/TS path stays in modular `rules/`; other ecosystems live in `references/<lang>.md`; truly universal checks stay in `rules/` and are cross-linked from each language guide. `references/` is also the most portable component across distribution channels. The Go validator (`scripts/validate-skills/`, run with `go run ./scripts/validate-skills`) enforces the same existence + orphan discipline on both `rules/*.md` and `references/*.md` (template placeholders like `references/<lang>.md` are ignored).

## Distribution

The skills ship as four themed **collection plugins** — `workflow` (commit, create-branch, create-pr, github-actions, github-issues), `quality` (refactor, naming-format, project-structure, tailwind), `security` (security, deps), and `tooling` (setup, testing, update-project). The original all-in-one `tartinerlabs` plugin is **deprecated** but still published for a transition period; its removal is a future release. The collection assignment is the `collections` table in `scripts/validate-skills/main.go` — every skill must belong to exactly one collection (validated in CI).

Skills are distributed through five channels:
- **Claude Code plugin** — `claude plugin marketplace add tartinerlabs/skills`, then `claude plugin install <collection>@tartinerlabs` (skills invoked as `/<collection>:<skill-name>`, e.g. `/workflow:commit`)
- **Codex plugin** — plugin metadata in `plugins/<collection>/.codex-plugin/plugin.json` with marketplace metadata in `.agents/plugins/marketplace.json`
- **Cursor plugin** — plugin metadata in `plugins/<collection>/.cursor-plugin/plugin.json` with marketplace metadata in `.cursor-plugin/marketplace.json`
- **[skills.sh](https://skills.sh)** — `pnx skills add tartinerlabs/skills`
- **[Context7](https://context7.com)** — `pnx ctx7 skills install /tartinerlabs/skills --all --universal`

The `Skills` CI workflow validates skills.sh and Context7 distribution on push to `main`.

## Plugin

Every plugin lives in its own `plugins/<name>/` wrapper holding the four per-channel manifests (`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `.antigravity-plugin/plugin.json`) plus a `skills` entry exposing its skill source. Two wrapper shapes exist:

- **Collection wrappers** — `plugins/workflow/`, `plugins/quality/`, `plugins/security/`, `plugins/tooling/` each have a real `skills/` directory containing one symlink per member skill (`skills/<skill>` → `../../../skills/<skill>`). Each wrapper's `assets/icon.svg` is the Codex `composerIcon`.
- **Whole-directory wrappers** — `plugins/tartinerlabs/` (deprecated monolith, `skills` → `../../skills`) and `plugins/xcode-skills/` (Xcode export, `skills` → `../../xcode-skills`) expose an entire source directory through a single dir symlink.

The repo root's `.claude-plugin/` and `.cursor-plugin/` hold **only** their `marketplace.json`; the Codex marketplace is `.agents/plugins/marketplace.json`. Each marketplace references every plugin as `./plugins/<name>`. Keeping every plugin subdirectory-sourced (no `source: "./"` at the marketplace root) is required — the Claude Code loader silently drops a root-sourced plugin when another plugin exists.

Plugin metadata is intentionally hand-maintained. `.release-please-manifest.json` is the shared source of truth for the released version, and release-please (`extra-files` in `release-please-config.json`) syncs the `plugins/**/plugin.json` manifest versions in the release PR.

## Xcode Skill Export

The root-level `xcode-skills/` directory is generated exclusively by `xcrun agent skills export`. After an export, do not edit, add, remove, rename, move, reformat, or manually clean up anything inside that directory. Future exports must write directly to the same `xcode-skills/` path and remain untouched afterward.

All Codex, Claude, and Cursor metadata for this collection belongs in `plugins/xcode-skills/`. Its `skills` symlink points to `../../xcode-skills`; wrapper metadata and documentation may change, but the exported directory may not.

## GitHub Actions

- All actions: pin to a full commit SHA with a version or source-ref comment (e.g., `@9fd676a...  # v4.2.0`), including GitHub-owned `actions/*`

## Conventions

- GitHub-related skills auto-assign to current user via `@me` or `get_me`
- PR and issue titles use natural language, NOT conventional commit prefixes
- The `/commit` skill enforces max 50-character commit messages, detects commitlint to choose conventional vs plain format, and ensures GitLeaks is configured before committing
- Skills can use both CLI tools (`gh`, `git`) and MCP tools (`mcp__github__*`) depending on the operation
- **Commit type for skill content:** Skill markdown files (`skills/**/*.md`) are the product, not documentation. Changes to skill behaviour use `feat`/`fix`/`refactor` — never `docs`. Reserve `docs:` for `README.md`, `CLAUDE.md`, `CHANGELOG.md`, and similar meta-documentation

# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**Repository:** https://github.com/tartinerlabs/skills
**Package:** `@tartinerlabs/skills`

A collection of agent skills distributed via Codex, Claude Code, Cursor, Antigravity, and [skills.sh](https://skills.sh). Each skill is a markdown file with YAML frontmatter following the [Agent Skills spec](https://agentskills.io).

## Development

- **Tooling:** stdlib-only Go plus plain shell git hooks — the repo deliberately avoids npm dependencies to keep the supply-chain surface minimal
- **Git hooks:** plain shell hooks in `.githooks/` (enable with `git config core.hooksPath .githooks`) — `commit-msg` enforces conventional commits (no scope, max 50-char header), `pre-commit` runs GitLeaks secrets detection
- **Checks:** `go run ./scripts/validate-skills` and `go test ./...` (stdlib-only Go — no module dependencies)
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

[Instructions Codex follows when the skill is active]
```

### Frontmatter Fields

- `name` — Skill identifier, invoked as `/skill-name` in Codex
- `description` — Purpose and trigger conditions
- `allowed-tools` — Scoped tool permissions (e.g., `Bash(git status)` for specific commands, `Read` for full tool access)
- `model` — Model preference. Low/medium-effort skills default to `haiku` (cheaper, separate rate-limit bucket); high-effort skills that need deeper reasoning (forked subagents, complex audits) use `sonnet`
- `effort` — Reasoning effort level (`low`, `medium`, `high`, `max`). Overrides the session effort level while the skill is active

### Rules Pattern

Skills with multiple checks use a `rules/` subdirectory alongside `SKILL.md`. The main skill file references rules via a table and tells Codex to read them at runtime. Each rule file is a standalone markdown document with severity, examples, and fix instructions. This keeps skills modular — rules can be added, removed, or edited independently.

## Distribution

The skills ship as four themed **collection plugins** — `workflow` (commit, create-branch, create-pr, github-actions, github-issues), `quality` (refactor, naming-format, project-structure, tailwind), `security` (security, deps), and `tooling` (setup, testing, update-project). The original all-in-one `tartinerlabs` plugin is **deprecated** but still published for a transition period. The collection assignment is the `collections` table in `scripts/validate-skills/main.go` — every skill must belong to exactly one collection (validated in CI).

Skills are distributed through six channels:
- **Codex plugin** — plugin metadata in `plugins/<collection>/.codex-plugin/plugin.json` with marketplace metadata in `.agents/plugins/marketplace.json`
- **Claude Code plugin** — `claude plugin marketplace add tartinerlabs/skills`, then `claude plugin install <collection>@tartinerlabs`
- **Cursor plugin** — plugin metadata in `plugins/<collection>/.cursor-plugin/plugin.json` with marketplace metadata in `.cursor-plugin/marketplace.json`
- **Antigravity plugin** — plugin metadata in `plugins/<collection>/.antigravity-plugin/plugin.json`
- **[skills.sh](https://skills.sh)** — `pnpm dlx skills add tartinerlabs/skills`
- **[Context7](https://context7.com)** — `pnpm dlx ctx7 skills install /tartinerlabs/skills --all --universal`

The `Skills` CI workflow validates skills.sh and Context7 distribution on push to `main`.

## Plugin Metadata

Plugin metadata is maintained manually by design. Every plugin lives in its own `plugins/<name>/` wrapper holding the four per-channel manifests plus a `skills` entry exposing its skill source. Two wrapper shapes exist:

- **Collection wrappers** — `plugins/workflow/`, `plugins/quality/`, `plugins/security/`, `plugins/tooling/` each have a real `skills/` directory containing one symlink per member skill (`skills/<skill>` → `../../../skills/<skill>`)
- **Whole-directory wrappers** — `plugins/tartinerlabs/` (deprecated monolith, `skills` → `../../skills`) and `plugins/xcode-skills/` (`skills` → `../../xcode-skills`) expose an entire source directory through a single dir symlink

Per-channel metadata for every plugin:

- `plugins/<name>/.codex-plugin/plugin.json` is the Codex plugin manifest; `plugins/<name>/assets/icon.svg` is its Codex `composerIcon`
- `.agents/plugins/marketplace.json` is the repo-scoped Codex marketplace entry
- `plugins/<name>/.claude-plugin/plugin.json` is the Claude plugin manifest; the root `.claude-plugin/marketplace.json` is the Claude marketplace
- `plugins/<name>/.cursor-plugin/plugin.json` is the Cursor plugin manifest; the root `.cursor-plugin/marketplace.json` is the Cursor marketplace
- `plugins/<name>/.antigravity-plugin/plugin.json` is the Antigravity plugin manifest
- Each marketplace references every plugin as `./plugins/<name>`. Keep every plugin subdirectory-sourced — the Claude Code loader silently drops a plugin sourced at the marketplace root (`source: "./"`) when another plugin exists
- `.release-please-manifest.json` is the canonical version source; release-please (`extra-files` in `release-please-config.json`) syncs the `plugins/**/plugin.json` manifest versions in the release PR

When plugin copy changes, update Codex, Claude, Cursor, and Antigravity plugin manifests intentionally. Do not expose Claude-only hooks in Cursor metadata unless they have been ported to Cursor's runtime.

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


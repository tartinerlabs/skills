# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Repository:** https://github.com/tartinerlabs/skills
**Package:** `@tartinerlabs/skills`

A collection of agent skills distributed via Claude Code, Codex, Cursor, and [skills.sh](https://skills.sh). Each skill is a markdown file with YAML frontmatter following the [Agent Skills spec](https://agentskills.io).

## Development

- **Package manager:** pnpm (v11+) — use `pnx` instead of `npx` or `pnpm dlx`
- **Git hooks:** Husky with commitlint (conventional commits via `@commitlint/config-conventional`) and GitLeaks secrets detection on pre-commit
- **No build/test/lint steps** — this is a content-only repo of markdown skill files
- **Releases:** Automated via semantic-release on push to `main` — bumps version in `package.json`, updates `CHANGELOG.md`, creates GitHub release

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

### Rules Pattern

Skills with multiple checks use a `rules/` subdirectory alongside `SKILL.md`. The main skill file references rules via a table and tells Claude to read them at runtime. Each rule file is a standalone markdown document with severity, examples, and fix instructions. This keeps skills modular — rules can be added, removed, or edited independently.

## Distribution

Skills are distributed through five channels:
- **Claude Code plugin** — `claude plugin install tartinerlabs/skills` (plugin name: `tartinerlabs`, skills invoked as `/tartinerlabs:<skill-name>`)
- **Codex plugin** — plugin metadata in `plugins/tartinerlabs/.codex-plugin/plugin.json` with marketplace metadata in `.agents/plugins/marketplace.json`
- **Cursor plugin** — plugin metadata in `plugins/tartinerlabs/.cursor-plugin/plugin.json` with marketplace metadata in `.cursor-plugin/marketplace.json`
- **[skills.sh](https://skills.sh)** — `pnx skills add tartinerlabs/skills`
- **[Context7](https://context7.com)** — `pnx ctx7 skills install /tartinerlabs/skills --all --universal`

The `Skills` CI workflow validates skills.sh and Context7 distribution on push to `main`.

## Plugin

Every plugin lives in its own `plugins/<name>/` wrapper holding the three per-channel manifests (`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json`) plus a `skills` symlink to the skill source. Both plugins use this identical shape:

- `plugins/tartinerlabs/` wraps the main collection (`skills` → `../../skills`) under the `tartinerlabs` namespace. Its `assets/icon.svg` is the Codex `composerIcon`.
- `plugins/xcode-skills/` wraps the Xcode export (`skills` → `../../xcode-skills`).

The repo root's `.claude-plugin/` and `.cursor-plugin/` hold **only** their `marketplace.json`; the Codex marketplace is `.agents/plugins/marketplace.json`. Each marketplace references both plugins as `./plugins/<name>`. Keeping every plugin subdirectory-sourced (no `source: "./"` at the marketplace root) is required — the Claude Code loader silently drops a root-sourced plugin when another plugin exists.

Plugin metadata is intentionally hand-maintained. `package.json.version` is the shared source of truth between plugin manifests, and semantic-release (`scripts/sync-plugin-versions.mjs`) syncs the six `plugins/**/plugin.json` manifest versions during release.

## Xcode Skill Export

The root-level `xcode-skills/` directory is generated exclusively by `xcrun agent skills export`. After an export, do not edit, add, remove, rename, move, reformat, or manually clean up anything inside that directory. Future exports must write directly to the same `xcode-skills/` path and remain untouched afterward.

All Codex, Claude, and Cursor metadata for this collection belongs in `plugins/xcode-skills/`. Its `skills` symlink points to `../../xcode-skills`; wrapper metadata and documentation may change, but the exported directory may not.

## GitHub Actions

- All actions: pin to full commit hash with version comment (e.g., `@9fd676a...  # v4.2.0`), including GitHub-owned `actions/*`

## Conventions

- GitHub-related skills auto-assign to current user via `@me` or `get_me`
- PR and issue titles use natural language, NOT conventional commit prefixes
- The `/commit` skill enforces max 50-character commit messages, detects commitlint to choose conventional vs plain format, and ensures GitLeaks is configured before committing
- Skills can use both CLI tools (`gh`, `git`) and MCP tools (`mcp__github__*`) depending on the operation
- **Commit type for skill content:** Skill markdown files (`skills/**/*.md`) are the product, not documentation. Changes to skill behaviour use `feat`/`fix`/`refactor` — never `docs`. Reserve `docs:` for `README.md`, `CLAUDE.md`, `CHANGELOG.md`, and similar meta-documentation

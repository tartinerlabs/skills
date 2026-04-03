# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Repository:** https://github.com/tartinerlabs/skills
**Package:** `@tartinerlabs/skills`

A collection of Claude Code skills distributed via [skills.sh](https://skills.sh). Each skill is a markdown file with YAML frontmatter following the [Agent Skills spec](https://agentskills.io).

## Development

- **Package manager:** pnpm (v10.16.1)
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
- `model` — Model preference (typically `sonnet` for cost efficiency)
- `effort` — Reasoning effort level (`low`, `medium`, `high`, `max`). Overrides the session effort level while the skill is active

### Rules Pattern

Skills with multiple checks use a `rules/` subdirectory alongside `SKILL.md`. The main skill file references rules via a table and tells Claude to read them at runtime. Each rule file is a standalone markdown document with severity, examples, and fix instructions. This keeps skills modular — rules can be added, removed, or edited independently.

## Distribution

Skills are distributed through three channels:
- **Claude Code plugin** — `claude plugin install tartinerlabs/skills` (plugin name: `tartinerlabs`, skills invoked as `/tartinerlabs:<skill-name>`)
- **[skills.sh](https://skills.sh)** — `pnpm dlx skills add tartinerlabs/skills`
- **[Context7](https://context7.com)** — `pnpm dlx ctx7 skills install /tartinerlabs/skills --all --universal`

The `Skills` CI workflow validates skills.sh and Context7 distribution on push to `main`.

## Plugin

The `.claude-plugin/` directory contains the Claude Code plugin manifest (`plugin.json`) and marketplace metadata (`marketplace.json`). The plugin wraps all skills under the `tartinerlabs` namespace without affecting existing distribution channels.

The `hooks/` directory contains a `UserPromptSubmit` hook (`prompt-skill-suggest.mjs`) that passively suggests relevant skills based on keyword matches in the user's prompt. The hook outputs suggestions via `additionalContext` — it does not auto-load skills.

## GitHub Actions

- `actions/*` (GitHub-owned): use version tags (e.g., `@v4`)
- Third-party actions: pin to full commit hash with version comment (e.g., `@9fd676a...  # v4.2.0`)

## Conventions

- Skills infer and match the target project's language variant (US/UK English) from existing commits, docs, and code
- GitHub-related skills auto-assign to current user via `@me` or `get_me`
- PR and issue titles use natural language, NOT conventional commit prefixes
- The `/commit` skill enforces max 50-character commit messages, detects commitlint to choose conventional vs plain format, and ensures GitLeaks is configured before committing
- Skills can use both CLI tools (`gh`, `git`) and MCP tools (`mcp__github__*`) depending on the operation

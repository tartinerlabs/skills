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
metadata:
  model: sonnet
---

[Instructions Claude follows when the skill is active]
```

### Frontmatter Fields

- `name` — Skill identifier, invoked as `/skill-name` in Claude Code
- `description` — Purpose and trigger conditions
- `allowed-tools` — Scoped tool permissions (e.g., `Bash(git status)` for specific commands, `Read` for full tool access)
- `metadata.model` — Model preference (typically `sonnet` for cost efficiency)

### Rules Pattern

Skills with multiple checks use a `rules/` subdirectory alongside `SKILL.md`. The main skill file references rules via a table and tells Claude to read them at runtime. Each rule file is a standalone markdown document with severity, examples, and fix instructions. This keeps skills modular — rules can be added, removed, or edited independently.

## Distribution

Skills are distributed through two channels, validated by the `Skills` CI workflow on push to `main`:
- **[skills.sh](https://skills.sh)** — `npx skills add tartinerlabs/skills`
- **[Context7](https://context7.com)** — `pnpm dlx ctx7 skills install /tartinerlabs/skills --all --universal`

## GitHub Actions

- `actions/*` (GitHub-owned): use version tags (e.g., `@v4`)
- Third-party actions: pin to full commit hash with version comment (e.g., `@9fd676a...  # v4.2.0`)

## Agentic Workflows

The repo uses [GitHub Agentic Workflows](https://github.com/github/gh-aw) (`gh-aw`) for automation:

- **Skill Validation** (`skill-validation.md`) — Runs on PRs touching `skills/**`, validates frontmatter fields and format
- **Issue Triage** (`issue-triage.md`) — Auto-labels new issues (`skill-request`, `bug`, `rule-update`, `ci`, `docs`, `question`)

Workflow `.md` files compile to `.lock.yml` files via `gh aw compile`. Lock files are marked `linguist-generated=true merge=ours` in `.gitattributes` — do not edit them manually.

## Conventions

- Skills infer and match the target project's language variant (US/UK English) from existing commits, docs, and code
- GitHub-related skills auto-assign to current user via `@me` or `get_me`
- PR and issue titles use natural language, NOT conventional commit prefixes
- The `/commit` skill enforces max 50-character commit messages and ensures GitLeaks is configured before committing
- Skills can use both CLI tools (`gh`, `git`) and MCP tools (`mcp__github__*`) depending on the operation

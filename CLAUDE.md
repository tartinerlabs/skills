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

## Conventions

- Skills infer and match the target project's language variant (US/UK English) from existing commits, docs, and code
- GitHub-related skills auto-assign to current user via `@me` or `get_me`
- PR and issue titles use natural language, NOT conventional commit prefixes
- The `/commit` skill enforces max 50-character commit messages and ensures GitLeaks is configured before committing
- Skills can use both CLI tools (`gh`, `git`) and MCP tools (`mcp__github__*`) depending on the operation

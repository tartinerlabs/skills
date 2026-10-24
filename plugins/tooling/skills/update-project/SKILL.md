---
name: update-project
description: Use when updating docs, syncing AGENTS.md, CLAUDE.md, or README.md, fixing stale documentation, or refreshing project rules and skills. Keeps docs aligned with code changes.
license: MIT
allowed-tools: Read Glob Edit Write Bash(git:*)
model: haiku
effort: low
compatibility: Any project with agent docs (AGENTS.md, or a legacy CLAUDE.md) and/or a README; language-agnostic
metadata:
  short-description: Keep docs in sync with code.
---

You keep project documentation synchronized with recent code changes and git commits.

Run after significant code changes, before a release, or whenever docs may be stale.

Update only what the project actually changed. Verify a claim against the tree before you write it, and leave sections you cannot verify alone.

`AGENTS.md` is the agent instruction file — the cross-agent standard, read by Claude Code, Codex, and other hosts. Treat `CLAUDE.md` as legacy: maintain one that exists, but do not create a new one. Component directories follow the same split — `.claude/` for Claude Code, `.agents/skills/` for Codex and other hosts that use the cross-agent skills path. Do not invent `.agents/agents` or `.agents/rules`.

## Rules Overview

| Rule | Impact | File |
|------|--------|------|
| Agent docs (AGENTS.md / CLAUDE.md / README.md) | HIGH | `rules/agent-docs.md` |
| Components (agents, skills, rules) | MEDIUM | `rules/components.md` |

## Workflow

### Step 1: Detect

- Run `git log --oneline -20` and `git diff` to identify recent changes
- Check which agent instruction files exist (`AGENTS.md`, `CLAUDE.md`) and whether README.md exists (create if missing)
- Scan `.claude/agents/*.md`, `.claude/skills/*/SKILL.md`, `.claude/rules/*.md`, and `.agents/skills/*/SKILL.md`
- Compare documented instructions against actual project state to find stale sections
- Flag any new tools, removed dependencies, changed paths, or renamed commands

### Step 2: Update

Read the relevant rule file and apply updates:
- `rules/agent-docs.md` for AGENTS.md / CLAUDE.md / README.md changes
- `rules/components.md` for `.claude/` agents, skills, and rules, and for `.agents/skills/`

### Step 3: Validate

- Run project commands mentioned in docs to verify they work
- Check that instructions match current project setup
- Ensure the agent instruction file (AGENTS.md), README.md, agents, skills, and rules complement each other without duplication
- If both AGENTS.md and CLAUDE.md exist, propose consolidating into AGENTS.md per `rules/agent-docs.md` rather than keeping divergent copies

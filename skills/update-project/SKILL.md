---
name: update-project
description: Update and maintain CLAUDE.md, README.md, agents, skills, and rules to match current project state. Use when docs are stale, the project structure changed, agents, skills, or rules reference outdated paths, or the user asks to update project documentation.
allowed-tools: Read(*) Write(*) Edit(*) MultiEdit(*) Glob(*) Grep(*) Bash(npm*) Bash(yarn*) Bash(find*) Bash(ls*) WebFetch(*)
metadata:
  model: sonnet
---

You update and maintain project documentation. Infer the project's language variant (US/UK English) from existing docs, commits, and code, and match it in all output.

Read individual rule files in `rules/` for detailed requirements.

## Rules Overview

| Rule | Impact | File |
|------|--------|------|
| CLAUDE.md | HIGH | `rules/claude-md.md` |
| README.md | HIGH | `rules/readme-md.md` |
| Agents | MEDIUM | `rules/agents.md` |
| Skills | MEDIUM | `rules/skills.md` |
| Rules | MEDIUM | `rules/rules.md` |

## Workflow

### Step 1: Detect

- Check if CLAUDE.md and README.md exist (create if missing)
- Scan for `.claude/agents/*.md`, `.claude/skills/*/SKILL.md`, and `.claude/rules/*.md` files
- Scan project structure for changes since last update
- Cross-reference documented instructions with actual project state

### Step 2: Update

Read the relevant rule file for each document and apply updates:
- `rules/claude-md.md` for CLAUDE.md changes
- `rules/readme-md.md` for README.md changes
- `rules/agents.md` for `.claude/agents/` changes
- `rules/skills.md` for `.claude/skills/` changes
- `rules/rules.md` for `.claude/rules/` changes

### Step 3: Validate

- Run project commands mentioned in docs to verify they work
- Check that instructions match current project setup
- Ensure CLAUDE.md, README.md, agents, skills, and rules complement each other without duplication

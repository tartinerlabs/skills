---
name: sync-docs
description: Update and maintain CLAUDE.md and README.md documentation. Use when docs are stale, the project structure changed, or the user asks to sync documentation.
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

## Workflow

### Step 1: Detect

- Check if CLAUDE.md and README.md exist (create if missing)
- Scan project structure for changes since last update
- Cross-reference documented instructions with actual project state

### Step 2: Update

Read the relevant rule file for each document and apply updates:
- `rules/claude-md.md` for CLAUDE.md changes
- `rules/readme-md.md` for README.md changes

### Step 3: Validate

- Run project commands mentioned in docs to verify they work
- Check that instructions match current project setup
- Ensure both files complement each other

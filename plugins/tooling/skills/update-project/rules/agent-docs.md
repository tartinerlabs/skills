---
title: Agent Docs and README Maintenance
impact: HIGH
tags: project-instructions, claude-md, agents-md, readme, documentation
---

Covers the prose documents a human or agent reads to understand the project.

## Agent instruction file

**Rule**: Keep the project's agent instruction file current and accurate by scanning the project and updating relevant sections.

Prefer `AGENTS.md` — the cross-agent standard, read by Claude Code, Codex, and other hosts — so one file serves every agent. Create `AGENTS.md`, never a new `CLAUDE.md`.

A project that only has `CLAUDE.md` keeps working: maintain it in place, and suggest renaming it to `AGENTS.md` rather than doing it unasked. When both exist, propose folding the `CLAUDE.md` content into `AGENTS.md` and removing the duplicate, so the two cannot drift. Keep a `CLAUDE.md` the project deliberately retains — Claude-Code-only instructions, or a team on a Claude Code version without `AGENTS.md` support — and keep its shared guidance consistent with `AGENTS.md`.

### What to scan

- **Build and tooling commands**: manifest scripts, Makefile targets, lint/test/deploy commands
- **Project structure**: new directories, moved files, changed organisation
- **Environment setup**: installation steps, required tools, prerequisites
- **Coding conventions**: patterns, file naming, import styles

### What to update

- Add tools, scripts, or commands discovered in the project; remove references to deleted files and deprecated commands
- Fix file paths that have changed
- Add conventions observed in recent code

Spend the file's tokens on what an agent cannot discover by looking — non-obvious gotchas, silent failure modes, deliberate choices that look like mistakes. Structure that is evident from the file tree does not need restating. Keep implementation detail out of `README.md` and project-specific instructions out of the README's public-facing sections.

## README.md

**Rule**: Keep public project documentation accurate by verifying each section against actual project state.

### What to scan and update

- **Installation**: refresh steps to match current tooling and dependencies
- **Usage examples**: update code samples to reflect the current API
- **Links and badges**: fix broken or outdated references, update version references
- **Features**: add new ones, remove deprecated ones

Preserve the existing structure unless it is clearly outdated — a README's shape usually reflects a deliberate choice about what readers meet first.

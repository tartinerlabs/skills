---
name: commit
description: Clean git commits with conventional commit detection and GitLeaks secret scanning. Use when the user wants to commit changes, stage files, or create git commits.
allowed-tools: Bash(git status) Bash(git add) Bash(git diff) Bash(git commit) Bash(git log) Bash(git pull) Bash(git stash) Bash(gitleaks) Read Edit Glob
metadata:
  model: sonnet
---

You create git commits with short, readable messages. Infer the project's language variant (US/UK English) from existing commits, docs, and code, and match it in all output.

Read individual rule files in `rules/` for detailed requirements and examples.

## Rules Overview

| Rule | Impact | File |
|------|--------|------|
| Message format | HIGH | `rules/message-format.md` |
| Issue references | MEDIUM | `rules/issue-references.md` |
| Change scope | MEDIUM | `rules/change-scope.md` |

## Pre-Commit Security Check

Before committing, ensure GitLeaks is configured:

1. Check for `.husky/pre-commit` containing `gitleaks protect`
2. If missing, add `gitleaks protect --staged --verbose` before any `lint-staged` command
3. If `.husky/` doesn't exist, run `npx husky init` first

## Workflow

1. **Pull remote changes before committing:**
   - Run `git status` to check for uncommitted changes
   - If the working tree is dirty, run `git stash` first
   - Run `git pull` to sync with remote
   - If you stashed, run `git stash pop` to restore changes
2. Show current `git status` and analyse all changes
3. Detect commitlint config to determine message format (see `rules/message-format.md`)
4. Check conversation context for GitHub issue references (see `rules/issue-references.md`)
5. Assess scope of changes (see `rules/change-scope.md`)
6. Stage files and create commit with message following `rules/message-format.md`

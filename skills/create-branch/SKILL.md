---
name: create-branch
description: Create and checkout a new git branch with smart validation. Use when the user wants to create a branch, start work on an issue, or set up a feature branch.
allowed-tools: Bash(git status) Bash(git branch) Bash(git checkout) Bash(git push) Bash(git rev-parse) Bash(git ls-remote) Bash(gh issue develop) Bash(gh issue list) Bash(gh issue view)
metadata:
  model: sonnet
---

You create and checkout git branches with validation. Infer the project's language variant (US/UK English) from existing branches, commits, and docs, and match it in all output.

Read individual rule files in `rules/` for detailed requirements and examples.

## Rules Overview

| Rule | Impact | File |
|------|--------|------|
| Branch naming | HIGH | `rules/branch-naming.md` |
| Prefix detection | MEDIUM | `rules/prefix-detection.md` |

## Workflow

1. If an issue number is provided, use `gh issue develop <number> -c` to create a linked branch and skip to step 4
2. Auto-detect prefix from user input (see `rules/prefix-detection.md`), validate name (see `rules/branch-naming.md`), and check for duplicates locally and remotely
3. Create and checkout from `main` → `master` → current HEAD: `git checkout -b <name> <base>`
4. Offer remote push: `git push -u origin <name>`

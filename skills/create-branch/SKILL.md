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

## Priority: GitHub Issue Integration

If the user provides an issue number (e.g., "#123", "123", or "issue 123"):

1. Verify issue exists: `gh issue view <number>`
2. Create linked branch: `gh issue develop <number> -c`
3. Skip to remote push step

## Manual Branch Creation Workflow

1. **Check repository status** — verify clean working directory
2. **Get branch name** from user input
3. **Auto-detect prefix** using keyword mapping (see `rules/prefix-detection.md`)
4. **Validate name** against naming rules (see `rules/branch-naming.md`)
5. **Check for duplicates** — local and remote branches
6. **Determine base branch** — `main` → `master` → current HEAD
7. **Create and checkout**: `git checkout -b <name> <base>`
8. **Offer remote push**: `git push -u origin <name>`

## Error Handling

- **Not a git repository**: Suggest `git init`
- **GitHub CLI not available**: Fall back to manual creation
- **Issue not found**: Suggest checking issue number or manual creation
- **Branch exists**: Offer to checkout existing or choose different name

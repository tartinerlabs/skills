---
name: create-issue
description: Create a GitHub issue with template detection and auto-assignment. Use when the user wants to file a bug, request a feature, or create a tracking issue.
allowed-tools: Bash(gh repo view) mcp__github__list_issue_types mcp__github__issue_write mcp__github__get_me
metadata:
  model: sonnet
---

You create GitHub issues. Infer the project's language variant (US/UK English) from existing issues, docs, and code, and match it in all output.

Read individual rule files in `rules/` for detailed requirements and examples.

## Rules Overview

| Rule | Impact | File |
|------|--------|------|
| Issue title | HIGH | `rules/issue-title.md` |
| Template adherence | MEDIUM | `rules/template-adherence.md` |

## Workflow

1. Check if we're in a GitHub repository and get owner/repo info
2. Check for organisation issue types via `github/list_issue_types` (fails for user-owned repos — expected, proceed without)
3. Check for issue templates in `.github/ISSUE_TEMPLATE/` or `.github/`
4. Generate title following `rules/issue-title.md`
5. Generate body following template if found (see `rules/template-adherence.md`), otherwise use clear structured format
6. Get current user via `github/get_me` for self-assignment
7. Create issue via `github/issue_write` with `method: "create"`, including `assignees` array with current user's login

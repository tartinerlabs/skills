---
name: update-issue
description: Update a GitHub issue with new title, body, labels, or assignees. Use when the user wants to edit an issue, change labels, or update issue details.
allowed-tools: Bash(gh issue view) Bash(gh issue edit) Bash(gh repo view)
metadata:
  model: sonnet
---

You update GitHub issues. Infer the project's language variant (US/UK English) from existing issues, docs, and code, and match it in all output.

Read individual rule files in `rules/` for detailed requirements and examples.

## Rules Overview

| Rule | Impact | File |
|------|--------|------|
| Title format | HIGH | `rules/title-format.md` |
| Template preservation | MEDIUM | `rules/template-preservation.md` |

## Workflow

1. Identify the issue to update (from user input or ask)
2. View current issue details: `gh issue view <number>`
3. Check for issue templates in `.github/ISSUE_TEMPLATE/`
4. Determine what to update (title, body, labels, assignees, state)
5. Apply updates following rules, using `gh issue edit`
6. Display summary of changes with link to updated issue

## Validation

- For titles: follow `rules/title-format.md`
- For body with template: follow `rules/template-preservation.md`
- For labels: only use labels that already exist in the repository
- For assignees: only assign valid repository collaborators

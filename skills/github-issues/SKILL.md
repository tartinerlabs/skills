---
name: github-issues
description: Use when filing a bug, requesting a feature, creating an issue, or updating issue details. Manages GitHub issues with templates, formatting, and auto-assignment.
allowed-tools: Read Bash(gh repo view) mcp__github__list_issue_types mcp__github__issue_write mcp__github__issue_read mcp__github__sub_issue_write mcp__github__get_me mcp__github__search_issues mcp__github__list_issues mcp__github__add_issue_comment
metadata:
  model: sonnet
---

You create, update, query, and comment on GitHub issues. Infer the project's language variant (US/UK English) from existing issues, docs, and code, and match it in all output.

Read individual rule files in `rules/` for detailed requirements and examples.

## Rules Overview

| Rule | Impact | File |
|------|--------|------|
| Issue title | HIGH | `rules/issue-title.md` |
| Template adherence | MEDIUM | `rules/template-adherence.md` |
| No checklists | MEDIUM | `rules/no-checklists.md` |

## Workflow

1. Determine action: create, update, query, or comment
2. Check if we're in a GitHub repository and get owner/repo info
3. Check for issue templates in `.github/ISSUE_TEMPLATE/` or `.github/`
4. Check for organisation issue types via `mcp__github__list_issue_types` (fails for user-owned repos — expected, proceed without)
5. For creation or update via `mcp__github__issue_write`:
   - For updates: fetch current issue first via `mcp__github__issue_read` with `method: "get"`
   - When issue types are available, select the most appropriate type (e.g. Bug for defects, Feature for new functionality, Task for general work) and pass it as `type`
   - Generate title following `rules/issue-title.md`
   - Generate body following template if found (see `rules/template-adherence.md`), otherwise use clear structured format
   - For creation: get current user via `mcp__github__get_me` and include in `assignees` array
   - If the user specifies a parent issue, link the created/updated issue as a sub-issue via `mcp__github__sub_issue_write` with `method: "add"` (use the issue's **node ID**, not its number)
6. For parent/sub-issue management:
   - To list sub-issues: use `mcp__github__issue_read` with `method: "get_sub_issues"`
   - To add a sub-issue: use `mcp__github__sub_issue_write` with `method: "add"`, passing the parent `issue_number` and the child's `sub_issue_id` (node ID)
   - To remove a sub-issue: use `mcp__github__sub_issue_write` with `method: "remove"`
   - To reorder sub-issues: use `mcp__github__sub_issue_write` with `method: "reprioritize"` and either `after_id` or `before_id`
   - When creating multiple related issues, prefer structuring them as a parent with sub-issues rather than flat independent issues
7. For queries:
   - Use `mcp__github__issue_read` with `method: "get"` for a specific issue number
   - Use `mcp__github__issue_read` with `method: "get_sub_issues"` to inspect sub-issue hierarchy
   - Use `mcp__github__search_issues` for filters, keywords, and cross-repo lookups
   - Use `mcp__github__list_issues` for repository issue lists
8. For comments:
   - Fetch issue context first when needed via `mcp__github__issue_read` with `method: "get"`
   - Add the comment using `mcp__github__add_issue_comment`
9. Display a summary with issue links and what changed

## Validation

- For titles: follow `rules/issue-title.md`
- For body with template: follow `rules/template-adherence.md`
- For labels: only use labels that already exist in the repository
- For assignees: only assign valid repository collaborators

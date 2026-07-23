---
name: github-issues
description: Use when filing a bug, requesting a feature, creating an issue, or updating issue details. Manages issues on GitHub (and GitLab via glab) with templates, formatting, and auto-assignment.
allowed-tools: Read Bash(gh:*) Bash(glab:*) mcp__github__list_issue_fields mcp__github__issue_read
model: haiku
effort: medium
compatibility: Requires a GitHub (gh) or GitLab (glab) remote; GitHub is best-supported (issue types, sub-issues, templates); a GitHub MCP server is optional and unlocks typed issue-field support
---

You create, update, query, and comment on GitHub (or GitLab) issues.

Read individual rule files in `rules/` for detailed requirements and examples.

## Rules Overview

| Rule | Impact | File |
|------|--------|------|
| Issue title | HIGH | `rules/issue-title.md` |
| Template adherence | MEDIUM | `rules/template-adherence.md` |
| No checklists | MEDIUM | `rules/no-checklists.md` |

## CLI vs MCP Precedence

Use the CLI (`gh`/`glab`) for every operation it natively supports — it is the default interface throughout this skill. For operations with **no native CLI subcommand** (currently: issue fields — structured priority/effort/date/custom metadata on issues), fall back in this order:

1. **GitHub MCP server tools**, if such a server is connected. In Claude Code its tools are typically named `mcp__github__*` (`list_issue_fields`, `issue_read`, `issue_write`), but the name depends on how the server was registered — detect by capability, not exact ID. Never assume the server is available. Only the read tools are pre-approved in `allowed-tools`; write tools prompt for permission as usual.
2. **`gh api`** against the REST/GraphQL API. Discover the schema at runtime (`gh api` with introspection or the documented endpoints) — do not rely on memorised queries.
3. **Graceful skip**: complete the rest of the operation, report which fields could not be set, and note that connecting the GitHub MCP server unlocks typed issue-field support.

## Workflow

1. Determine action: create, update, query, or comment
2. Detect the remote host from `git remote get-url origin` (github.com → gh, gitlab.com → glab; default GitHub) and use that CLI throughout. Get owner/repo (or group/project) info. **GitHub-only features** — organisation issue types, issue fields, sub-issues, and `.github/ISSUE_TEMPLATE/` — do not exist on GitLab: on GitLab skip the issue-type, issue-field, and sub-issue steps and use `.gitlab/issue_templates/` plus description checklists instead
3. Check for issue templates in the host's conventional location: on GitHub `.github/ISSUE_TEMPLATE/` or `.github/`; on GitLab `.gitlab/issue_templates/`
4. List available organisation issue types (fails for user-owned repos — expected, proceed without)
5. List available issue fields (organisation-level, inherited by repositories) via the CLI vs MCP precedence above — no native CLI subcommand exists, so use the MCP server or `gh api` (fails for user-owned repos — expected, proceed without)
6. For creation or update:
   - For updates: fetch the current issue first
   - When issue types are available, select the most appropriate type (e.g. Bug for defects, Feature for new functionality, Task for general work)
   - When the user specifies field values (priority, effort, dates, custom), set them via the CLI vs MCP precedence above — values must match the field's declared type (single-select option name, text, number, `YYYY-MM-DD` date)
   - Generate title following `rules/issue-title.md`
   - Generate body following template if found (see `rules/template-adherence.md`), otherwise use clear structured format
   - For creation: get the current authenticated user and include in assignees
   - If the user specifies a parent issue, link the created/updated issue as a sub-issue (use the issue's **node ID**, not its number)
7. For parent/sub-issue management:
   - To list sub-issues: get the parent issue's sub-issues
   - To add a sub-issue: pass the parent issue number and the child's node ID
   - To remove a sub-issue: unlink the child from the parent
   - To reorder sub-issues: reprioritise with `after_id` or `before_id`
   - When creating multiple related issues, prefer structuring them as a parent with sub-issues rather than flat independent issues
8. For queries:
   - Fetch a specific issue by number
   - Inspect sub-issue hierarchy on a parent issue
   - Search issues for filters, keywords, and cross-repo lookups
   - Filter by issue-field values (MCP `field_filters` or the API; no native CLI equivalent — degrade gracefully per the precedence above)
   - List repository issues
9. For comments:
   - Fetch issue context first when needed
   - Add the comment to the issue
10. Display a summary with issue links and what changed

## Validation

- For titles: follow `rules/issue-title.md`
- For body with template: follow `rules/template-adherence.md`
- For labels: only use labels that already exist in the repository
- For fields: only set fields that already exist in the organisation or repository; never invent field names or single-select options
- For assignees: only assign valid repository collaborators

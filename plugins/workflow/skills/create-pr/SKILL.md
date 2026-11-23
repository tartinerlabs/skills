---
name: create-pr
description: Use when opening a PR, submitting for review, pushing a branch, or creating a pull request. Pushes and creates GitHub PRs with auto-assignment and description.
license: MIT
allowed-tools: Read Skill Bash(git:*) Bash(gh:*) Bash(glab:*)
model: haiku
effort: medium
compatibility: Requires git and a GitHub (gh) or GitLab (glab) remote
metadata:
  short-description: Push a branch and open a pull request.
---

You push branches and create pull/merge requests.

## Rules Overview

| Rule | Impact | File |
|------|--------|------|
| PR title | HIGH | `rules/pr-title.md` |
| Migration drift | HIGH | `rules/migration-drift.md` |
| PR description | MEDIUM | `rules/pr-description.md` |

## Workflow

1. Check `git status` and the current branch, and determine the base: the one the user names (e.g. a release branch for a hotfix), otherwise the default branch
2. **Get off the base branch before anything else.** A PR needs a head branch that differs from its base, so never push the base branch or open a PR from it. If the current branch is the base, create a branch now with the `create-branch` skill — in Claude Code invoke it through the Skill tool as `workflow:create-branch`; on hosts without skills, follow its branch-naming and prefix-detection rules directly (a prefixed kebab-case name such as `feature/order-search`). Derive the name from the changes or commits. Then:
   - Uncommitted changes carry over to the new branch on checkout
   - Commits already on the local base branch (ahead of `origin/<base>`) are on the new branch too, since it starts at the same HEAD. Tell the user their local base is still ahead of the remote; do not reset or rewrite it
3. If there are uncommitted changes, commit them via the `commit` skill (`workflow:commit` in Claude Code) — never with a raw `git commit` here. Ask first only if some changes look unrelated to the rest
4. Run the migration drift pre-flight per `rules/migration-drift.md`. If a schema changed without a migration, stop and ask before pushing
5. Push the current branch to remote (with `-u` flag if needed)
6. Analyse recent commits to generate PR title and description
7. Detect the remote host from `git remote get-url origin` (github.com → gh, gitlab.com → glab; default GitHub) and create the PR/MR with the matching CLI. The body is concise bullet points only (no `## Summary`, `## Test Plan`, checklists, or other heading sections):
   - **GitHub**: `gh pr create --assignee @me` (`@me` resolves to the authenticated user).
     - **Base selection**: use the base from step 1. If the branch was cut from a non-default branch that itself has an open PR (check the merge base, then `gh pr list --head <parent>`), create with `--base <parent-branch>` — the diff stays scoped to this layer, and GitHub links the PRs into a stack (public preview) automatically. Stacks are same-repository only; on repos where the preview has not rolled out this degrades to a plain dependent PR, which is the correct base regardless.
     - If the `gh stack` extension is installed (`gh extension list`), it may be used for stack navigation and local cascading rebases. Do not install it, and defer stack management (rebase order, merging layers) to it rather than retargeting branches manually — GitHub rebases and retargets upper layers itself when a lower one merges.
     - PRs opened by `gh stack submit` carry auto-generated titles and bodies that will not match the rules. After submitting, rewrite only the PRs that submit just created with `gh pr edit <number> --title "..." --body "..."` following `rules/pr-title.md` and `rules/pr-description.md`, scoping each title and description to that layer's diff (its commits against its base), not the whole stack. Leave pre-existing layers untouched — submit does not regenerate their copy, and it may have been edited in review.
   - **GitLab**: `@me` is a list filter, not valid for MR creation — resolve the username first with `glab api user --jq .username`, then `glab mr create --assignee <username> --target-branch <base>` with the base from step 1.

Auto-assign to the current user. If assignment fails (user not a collaborator/member), the PR/MR is still created without assignment.

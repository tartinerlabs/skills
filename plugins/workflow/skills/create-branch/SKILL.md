---
name: create-branch
description: Use when creating a branch, starting work on an issue, checking out a new feature branch, or about to commit or open a PR while on main or the default branch. Validates branch naming and links to GitHub issues automatically.
license: MIT
allowed-tools: Read Bash(git:*) Bash(gh:*) Bash(glab:*)
model: haiku
effort: low
compatibility: Requires git; issue-linking uses a GitHub (gh) or GitLab (glab) remote
metadata:
  short-description: Validated branch names linked to issues.
---

You create and checkout git branches with validation.

## Rules Overview

| Rule | Impact | File |
|------|--------|------|
| Branch naming | HIGH | `rules/branch-naming.md` |
| Prefix detection | MEDIUM | `rules/prefix-detection.md` |

## Workflow

1. **Find the issue** so the branch is linked whenever one exists. Detect the remote host from `git remote get-url origin` (github.com → gh, gitlab.com → glab; default GitHub)
   - Use an issue the user gave or the conversation names (`#123`, an issue URL, "fixes …")
   - Otherwise search open issues for the work's key terms: `gh issue list --search "<keywords> in:title" --limit 5` or `glab issue list --search "<keywords>"`. Link only a single clear match; ask when several fit; continue unlinked when none does
   - Skip the search when the user says there is no issue or the repo has issues disabled. Never create an issue here — that is the `github-issues` skill's job
2. Auto-detect prefix from user input (see `rules/prefix-detection.md`), validate name (see `rules/branch-naming.md`), and check for duplicates locally and remotely. On **GitLab**, put the issue number after the prefix (e.g. `feature/123-description`) so the MR auto-links
3. Pick the base: `main` → `master` → current HEAD. **Exception**: when the current branch has an open unmerged PR and the new work builds on it (the user says "on top of this" / "next part", or the change depends on unmerged work), base on the current branch instead — the diff stays scoped to the new layer, and on GitHub the resulting PRs link into a stack automatically. **Moving work off a base branch** (called from `commit` or `create-pr` while on it): base on the current HEAD, so commits not yet pushed to the remote come along; uncommitted changes carry over on checkout either way
4. Create and checkout:
   - **GitHub with an issue**: `gh issue develop <number> --name <name> --base <base> -c`. `gh issue develop` creates the branch on the remote from the remote base, so when moving work off a base branch drop `-c` (it would check out the remote base and leave unpushed commits behind), then `git checkout -b <name>` from the current HEAD — the later push fast-forwards the linked remote branch
   - **Otherwise**: `git checkout -b <name> <base>`
5. Offer remote push: `git push -u origin <name>`

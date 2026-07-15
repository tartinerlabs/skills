---
name: commit
description: Use when committing changes, staging files, saving work, or making a git commit. Creates clean commits with conventional commit format and GitLeaks scanning.
allowed-tools: Read Bash(git:*) Bash(gitleaks:*)
model: haiku
effort: low
---

You create git commits with short, readable messages.

Read ALL rule files before proceeding — do not skip or ask:

- `rules/message-format.md`
- `rules/issue-references.md`
- `rules/change-scope.md`

## Rules Overview

| Rule | Impact | File |
|------|--------|------|
| Message format | HIGH | `rules/message-format.md` |
| Issue references | MEDIUM | `rules/issue-references.md` |
| Change scope | MEDIUM | `rules/change-scope.md` |

## Pre-Commit Security Check

Scan staged changes for secrets before every commit:

1. Run `gitleaks git --staged --redact --verbose` after staging.
2. If GitLeaks reports a leak, **STOP** — do not commit. Report the finding and ask the user to remove the secret (and rotate it if it was ever pushed).
3. If GitLeaks is not installed (command not found), **STOP** — do not commit and do not install it implicitly. Tell the user to install it (`brew install gitleaks` or equivalent) and re-run.

Never edit `.husky/`, `commitlint`, or other project tooling as part of a commit. If pre-commit hooks are missing, report that and point the user to the `setup` skill instead of configuring it yourself.

## Workflow

A commit request stages and commits only — it must never pull, stash, restore stashes, or rewrite project tooling.

1. Show current `git status` and analyse all changes
2. Detect commitlint config to determine message format (see `rules/message-format.md`)
3. Check conversation context for GitHub issue references (see `rules/issue-references.md`)
4. Assess scope of changes (see `rules/change-scope.md`)
5. Stage only the explicit, related paths for this change — never blanket-stage unrelated modifications
6. Run the Pre-Commit Security Check above
7. Create the commit with a message following `rules/message-format.md`

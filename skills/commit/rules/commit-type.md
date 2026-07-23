---
title: Commit Type Selection
impact: HIGH
tags: type, fix, feat, branch, pr, base-branch, wip, semver
---

**Rule**: Choose the commit type from what the change means relative to the base branch, not from the staged diff alone. Adjusting code you introduced earlier in this same, unmerged branch — whether correcting, restructuring, or documenting it — is iteration on that work: use the branch's existing type (usually `feat`), not `fix`, `refactor`, or `docs`.

This rule applies whichever format `rules/message-format.md` detected — it never introduces conventional commits or commitlint where they aren't already in use. In plain format the same logic picks the leading verb: describe WIP iteration as part of the work ("add date parsing utility"), not as a fix.

### Why This Matters

Conventional commit types drive changelogs and semantic version bumps (semantic-release, release-please, or equivalent). Typing commits from the diff alone mislabels WIP iteration: a `fix` implies a released bug is being patched, a `refactor` implies shipped code was restructured — when the code in question never shipped and is just an earlier draft of the current work.

### Find the Base Branch

```
git symbolic-ref refs/remotes/origin/HEAD   # → refs/remotes/origin/main
```

If that fails (no remote, or origin/HEAD was never set), fall back through `origin/main` → `origin/master` → local `main` → local `master`, whichever exists. Prefer the remote-tracking ref when available — it reflects what's actually merged, not a possibly-stale local branch.

**Skip this rule** (use normal type judgement) when:
- The current branch *is* the base branch (`git branch --show-current` matches it) — no PR context to compare against
- No base branch can be resolved at all (fresh repo, no remote, single branch)
- HEAD is detached

### Check Where the Touched Code Came From

```
git merge-base HEAD <base>               # commit where this branch diverged
git log <merge-base>..HEAD -- <file>     # commits on this branch touching the file
git diff <merge-base>...HEAD -- <file>   # what this branch added/changed since diverging
```

- If the changed lines only appear as `+` in `<merge-base>...HEAD` (this branch introduced them) → the change is iteration on this branch's own work. Use the type matching that work: check `git log <merge-base>..HEAD --oneline` for the dominant conventional type used so far; default to `feat` if mixed or unclear.
- If the changed lines already existed at `<merge-base>` (present before this branch started) → the change touches already-merged behaviour, so type it on its own merits (`fix`, `refactor`, `docs`, …) even while working inside this PR.

### Examples

```
# Branch added parseDate() yesterday; today's staged diff fixes a typo inside it
→ feat: add date parsing utility          (not fix — parseDate() isn't shipped yet)
```

```
# parseDate() has existed on main for months; staged diff fixes a timezone bug in it
→ fix: correct timezone offset in parseDate
```

---
title: Issue References
impact: MEDIUM
tags: issues, github, closes, fixes, resolves, refs
---

**Rule**: When a GitHub issue is mentioned in conversation context, add a footer reference using a GitHub-recognised closing keyword.

This is the GitHub default. Some conventions place issue references differently — check `rules/convention-detection.md` first and defer to the project's own form when one was detected:

- **Go** — `Fixes #159` / `Updates #12345` in the body (`references/go.md`)
- **Chromium** — `Bug:` / `Fixed:` footer tags (`references/systems.md`)
- **CPython and tracker-ID projects** — the ID goes in the *subject* as `gh-12345: ` (`references/python.md`)
- **rust-lang and similar** — issue references are deliberately kept out of the commit and put in the PR description instead, because rebasing spams the issue thread

Never invent an issue number. Reference an issue only when one appears in conversation context or the branch name.

### Closing Keywords (GitHub auto-closes the issue on merge)

```
Closes #123
Fixes #123
Resolves #123
```

Use whichever reads most naturally for the change:
- `Fixes` — for bug fixes
- `Closes` — for features or tasks
- `Resolves` — for anything else

### When to Use

- **Closes / Fixes / Resolves #N**: The changes fully resolve the issue — GitHub will auto-close it when merged to the default branch
- **No footer**: Changes are partial or no issue was mentioned in conversation context

### Format

Footer goes after a blank line following the body (or subject if no body):

```
fix login timeout bug

Fixes #123
```

```
feat(auth): add OAuth2 login

Adds Google and GitHub OAuth providers. Token refresh
is handled automatically via the session middleware.

Closes #89
```

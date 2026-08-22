---
title: Commit Message Format
impact: HIGH
tags: commit, message, format, conventional, area-prefix, 50-char
---

**Rule**: Write the subject in the family `rules/convention-detection.md` identified. Use imperative mood, no trailing period, and keep the subject within that family's length budget.

Detection comes first — this rule only describes how to render each outcome.

### Universal Rules (all families)

- **Imperative mood**: "add", not "added" or "adds". The subject completes "This change will \_\_\_\_".
- **No trailing period.**
- **Blank line** between subject and body.
- **Body wrapped at 72 columns**, explaining *why*; the diff already shows the how.
- Subject describes the *what*; never a complete sentence with a full stop.

### Family 1 — Conventional Commits

```
fix: handle auth redirect for expired tokens
feat: add user search endpoint
feat(payments)!: drop support for Stripe v2 tokens
```

- Structure: `type[(scope)][!]: description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert` — narrowed to the tool's `type-enum` when one is configured
- **50-character limit including the `type: ` prefix**
- Description starts with a **lowercase** verb
- Scope only when it adds clarity: `fix(auth): handle expired token redirect`
- Breaking changes: `!` after type/scope, or a `BREAKING CHANGE:` footer. `feat` → MINOR, `fix` → PATCH, breaking → MAJOR

### Family 2 — Area Prefix

The dominant style in systems, compiler, and language-upstream repositories.

```
math: improve Sin, Cos and Tan precision for very large arguments
refs: HEAD is also treated as a ref
ext2: improve scalability of bitmap searching
```

- Structure: `area: description`, where `area` is the package, subsystem, or file being changed
- Take the area from the observed prefix vocabulary, not invention
- **Capitalisation is project-specific and must come from history** — Go and Git require lowercase after the colon (`doc: Clarify …` is explicitly wrong there); Chromium capitalises
- Length: 50 where history is tight, up to 70–75 in kernel-style repositories
- See `references/go.md`, `references/systems.md`

### Family 3 — Bracket Tag

```
[stdlib] Fix Comparable conformance for Optional
[SILGen] Correctly compute 'is dependent type' bits in 'Type'
```

- Structure: `[tag] Description`, tag drawn from the project's existing tags
- Typically capitalised after the tag
- See `references/swift.md`

### Family 4 — Tracker ID

```
gh-12345: Make the spam module more spammy
PROJ-482: Reject expired refresh tokens
```

- Structure: `<id>: Description`, capitalised, imperative, no period
- Use only when history shows it and an ID is actually known — never fabricate one
- See `references/python.md`

### Family 5 — Plain

```
Fix auth redirect for expired tokens
Add user search endpoint
```

- Start with an imperative verb: add, fix, update, remove, refactor
- 50-character subject, 72-column body
- Capitalisation follows history; capitalised is the common default
- No prefixes of any kind

### Incorrect (every family)

```
Updated the authentication flow to handle edge cases with expired tokens and added retry logic
```

Past tense, far over budget, and describes the diff rather than the change.

### Commit Body

**Default to a single subject line — no body.** The vast majority of commits should be subject-only. Only add a body for:

- Breaking changes
- Non-obvious design decisions
- Security-related context that shouldn't be lost

```
feat(payments): switch from Stripe v2 to v3 SDK

v2 is deprecated and loses security patches in Q3.
The new SDK uses a promise-based API and removes the
manual webhook signature workaround in utils/stripe.ts.

Closes #412
```

### Trailers

Some projects require `Signed-off-by` (Linux, Git, and DCO-gated repositories). If Tier 2 detection found sign-off trailers in recent commit bodies, or the repository has a DCO check, commit with `git commit -s`. Do not add trailers a project does not use.

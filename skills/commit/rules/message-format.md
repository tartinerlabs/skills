---
title: Commit Message Format
impact: HIGH
tags: commit, message, format, 50-char
---

**Rule**: Maximum 50 characters. Use present tense verbs. Be specific but concise.

### Detect commitlint

Before formatting the message, check for commitlint in the project:

1. Look for `commitlint.config.*` (`.ts`, `.js`, `.cjs`, `.mjs`) or `commitlint` key in `package.json`
2. If found, use **conventional commit** format: `type: description` (or `type(scope): description`)
3. If not found, use **plain** format (no prefix)

### Conventional Commit Format (when commitlint is present)

```
fix: handle auth redirect for expired tokens
```

```
feat: add user search endpoint
```

```
docs: update API usage examples
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

- The 50-character limit includes the `type: ` prefix
- Use scope only when it adds clarity: `fix(auth): handle expired token redirect`
- Description starts with lowercase verb

### Plain Format (when no commitlint)

```
fix auth redirect for expired tokens
```

```
add user search endpoint
```

- Start with a verb: add, fix, update, remove, refactor
- No conventional commit prefixes

### Incorrect (either format)

```
Updated the authentication flow to handle edge cases with expired tokens and added retry logic
```

### Guidelines

- No trailing period
- Describe the "what", not the "how"
- Present tense: "add" not "added", "fix" not "fixed"

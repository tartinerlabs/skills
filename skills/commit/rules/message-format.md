---
title: Commit Message Format
impact: HIGH
tags: commit, message, format, 50-char
---

**Rule**: Maximum 50 characters. Use present tense verbs. Be specific but concise.

### Incorrect

```
Updated the authentication flow to handle edge cases with expired tokens and added retry logic
```

```
feat: add user authentication with OAuth2 support
```

### Correct

```
fix auth redirect for expired tokens
```

```
add user search endpoint
```

### Guidelines

- Start with a verb: add, fix, update, remove, refactor
- No conventional commit prefixes (`feat:`, `fix:`, `chore:`)
- No trailing period
- Describe the "what", not the "how"

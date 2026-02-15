---
title: Naming Conventions
impact: MEDIUM
tags: naming, kebab-case, files, conventions
---

**Rule**: Use consistent naming conventions for files and directories.

| Type | Convention | Example |
|------|------------|---------|
| Files | `kebab-case.ts` | `user-profile.ts` |
| Unit tests | `*.test.ts` | `user-profile.test.ts` |
| E2E tests | `*.e2e.ts` | `checkout.e2e.ts` |
| Schemas | `*.schema.ts` | `user.schema.ts` |
| Types | `*.types.ts` | `user.types.ts` |

### Directories

- Use `kebab-case` for directory names
- Exception: React component directories may use `PascalCase` if the project convention requires it
- Match the existing project convention before introducing a new one

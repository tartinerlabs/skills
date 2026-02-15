---
title: Colocation
impact: HIGH
tags: colocation, proximity, organisation
---

**Rule**: Place code as close to where it's relevant as possible. Things that change together should be located together.

### Incorrect

```
src/
├── components/
│   └── UserProfile.tsx
├── hooks/
│   └── useUser.ts
├── types/
│   └── user.ts
└── tests/
    └── UserProfile.test.tsx
```

### Correct

```
src/features/users/
├── UserProfile.tsx
├── UserProfile.test.tsx
├── useUser.ts
└── user.types.ts
```

### Where to Put Things

| Type | Location |
|------|----------|
| Shared types | `types/` or `packages/types/` |
| Utilities | `lib/` or `utils/` (split by domain) |
| Config | `config/` or root |
| Unit tests | Colocate: `foo.test.ts` next to `foo.ts` |
| E2E tests | `e2e/` or `tests/e2e/` |
| Mocks/fixtures | `__mocks__/` or `test/mocks/` |

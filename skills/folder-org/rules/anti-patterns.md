---
title: Anti-Patterns
impact: HIGH
tags: anti-patterns, catch-all, nesting, barrels
---

**Rule**: Avoid common structural anti-patterns that make codebases hard to navigate and maintain.

### Catch-All Files

Avoid generic `utils.ts`, `helpers.ts`, `common.ts`. Split by domain instead.

```
# Bad
src/utils.ts          # 500 lines of unrelated helpers

# Good
src/lib/date.ts       # Date formatting utilities
src/lib/currency.ts   # Currency formatting utilities
```

### Deep Nesting

Keep directory depth under 4 levels. Use descriptive names instead of deeper nesting.

```
# Bad
src/features/auth/components/forms/fields/inputs/TextInput.tsx

# Good
src/features/auth/components/AuthTextField.tsx
```

### Bloated Barrels

Avoid `index.ts` files with 50+ re-exports. They slow down tooling and create circular dependency risks.

### Separated Tests

Don't put all tests in a separate `__tests__/` directory. Colocate unit tests next to the code they test.

### Language Grouping in Monorepos

Group packages by domain, not by language.

```
# Bad
packages/typescript/
packages/go/

# Good
packages/auth/
packages/payments/
```

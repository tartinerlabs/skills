---
title: Remove Trivial Barrel Re-exports
impact: MEDIUM
tags: barrel-files, imports, bundle-size
---

**Rule**: Remove barrel `index.ts` files that only re-export from a single module or add no organisational value.

### Incorrect

```ts
// utils/index.ts
export * from "./format";
```

### Correct

```ts
// Import directly from the module
import { formatDate } from "./utils/format";
```

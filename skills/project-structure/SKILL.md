---
name: project-structure
description: Use when deciding where code should live, organising files, or auditing project structure. Checks colocation, grouping, and directory anti-patterns.
allowed-tools: Read Glob Grep Edit Bash(git:*) Bash(mkdir:*)
model: haiku
effort: medium
---

You are a project structure expert.

Read individual rule files in `rules/` for detailed explanations and examples.

## Rules Overview

| Rule | Impact | File |
|------|--------|------|
| Colocation | HIGH | `rules/colocation.md` |
| Anti-patterns | HIGH | `rules/anti-patterns.md` |
| Feature-based grouping | MEDIUM | `rules/feature-based.md` |
| Layer-based grouping | MEDIUM | `rules/layer-based.md` |
| Framework structure | MEDIUM | `rules/framework-structure.md` |

## Workflow

### Step 1: Detect Project Type

Scan for project indicators to determine the appropriate organisation approach:

- Frontend SPA / Next.js / React → feature-based
- Backend API / Express / Fastify / Hono → layer-based
- Monorepo (apps/ + packages/) → hybrid
- Existing structure → respect and extend current patterns

### Step 2: Audit

Check the existing structure against all rules. Report violations grouped by rule with directory paths:

```
## Project Structure Audit Results

### HIGH Severity
- `src/helpers/formatDate.ts` - Used only by `src/invoices/` → colocate with its consumer
- `src/components/Button/index.tsx` - Barrel-only directory → import the component directly

### MEDIUM Severity
- `src/` - Flat file dump with no feature or layer grouping → group by feature

### Summary
| Rule | Violations | Directories |
|------|-----------|-------------|
| Colocation | X | N |
| Anti-patterns | Y | N |
| **Total** | **X+Y** | **N** |
```

### Step 3: Recommend

Based on project type and existing patterns, recommend where new code should live. Always prioritise colocation.

### Step 4: Fix

Apply fixes for each violation:
1. Create the destination directory first if it does not exist (`mkdir -p <dest>`) — `git mv` fails when the target directory is missing
2. Move files to their correct location using `git mv` to preserve git history
3. Update all import paths in dependent files
4. Verify no broken imports remain after moves

---
name: naming-format
description: Use when reviewing file names, renaming files, fixing naming conventions, or auditing exports. Enforces consistent casing and suffix patterns.
allowed-tools: Read Glob Grep Edit Bash(git:*)
model: haiku
effort: medium
compatibility: Any language project; casing/suffix/export rules are language-neutral, framework naming rules apply only when that framework is detected
---

You are a naming conventions expert.

Read individual rule files in `rules/` for detailed explanations and examples.

## Rules Overview

| Rule | Impact | File |
|------|--------|------|
| Case consistency | HIGH | `rules/case-consistency.md` |
| File suffixes | HIGH | `rules/file-suffixes.md` |
| Export naming | HIGH | `rules/export-naming.md` |
| Index files | HIGH | `rules/index-files.md` |
| Framework conventions | MEDIUM | `rules/framework-conventions.md` (only when a supported framework is detected) |

## Mode Detection

Classify the request before acting, and default to read-only when intent is ambiguous or diagnostic:

- **Audit (read-only, default)** — "audit", "review", "check", "diagnose", or any unclear request. Produce an evidence-backed report and make NO file edits or renames.
- **Fix** — the user explicitly asks to fix, rename, apply, standardize naming, enforce a naming convention, or says "audit and fix". Only then apply the renames and import updates in the Fix step.

When intent is ambiguous, stay in Audit mode and end the report by offering to apply the fixes.

## Workflow

### Step 1: Detect

Scan the project to identify:

- Dominant filename casing convention (count files by pattern)
- Framework indicators (e.g. Next.js/Expo in `package.json`) — used only to decide whether to load `rules/framework-conventions.md`
- Existing suffix patterns (`.test.ts` vs `.spec.ts`, etc.)
- Export naming patterns across the codebase

The casing, suffix, export-naming, and index-file rules are language-neutral and always apply. Load `rules/framework-conventions.md` **only when a supported framework (Next.js / Expo) is detected**.

### Step 2: Audit

Check all files and exports against the rules. Report violations grouped by rule:

```
## Naming Audit Results

### HIGH Severity
- `src/components/userProfile.tsx` - File should be `user-profile.tsx` (kebab-case)
- `src/hooks/UseAuth.ts` - Hook export `UseAuth` should be `useAuth` (camelCase with `use` prefix)

### MEDIUM Severity
- `src/utils/index.ts` - Barrel file with 12 re-exports → use direct imports

### Summary
| Rule              | Violations | Files |
|-------------------|------------|-------|
| Case consistency  | X          | N     |
| Export naming     | Y          | N     |
| **Total**         | **X+Y**    | **N** |
```

### Step 3: Fix (fix mode only)

Skip this step entirely in Audit mode. Only apply renames when the request is in Fix mode (see Mode Detection).

Apply fixes for each violation:
1. Rename files using `git mv` to preserve git history
2. Update all import paths in dependent files
3. Verify no broken imports remain after renames

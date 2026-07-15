---
name: tailwind
description: Use when writing Tailwind classes, fixing spacing issues, reviewing CSS, or auditing Tailwind patterns. Enforces v4 best practices for grid and responsive.
allowed-tools: Read Glob Grep Edit
model: haiku
effort: medium
---

You are a Tailwind CSS v4 expert that detects and reports anti-patterns such as incorrect spacing, inconsistent sizing, desktop-first breakpoints, and non-GPU-accelerated animations.

Targets the current project by default — or specify a path to audit a subset of files.

Read individual rule files in `rules/` for detailed explanations and code examples.

## Rules Overview

| Rule | Impact | File |
|------|--------|------|
| Spacing direction | HIGH | `rules/spacing-direction.md` |
| Equal dimensions | HIGH | `rules/equal-dimensions.md` |
| 8px grid | HIGH | `rules/8px-grid.md` |
| Mobile-first responsive | MEDIUM | `rules/mobile-first.md` |
| Logical shorthands | MEDIUM | `rules/logical-shorthands.md` |
| GPU-accelerated animations | MEDIUM | `rules/gpu-animations.md` |

## Mode Detection

Classify the request before acting, and default to read-only when intent is ambiguous or diagnostic:

- **Audit (read-only, default)** — "audit", "review", "check", "diagnose", or any unclear request. Produce an evidence-backed report and make NO file edits.
- **Fix** — the user explicitly asks to write, add, create, fix, change, apply, clean up, or says "audit and fix". Only then apply the scoped changes in the Fix step.

When intent is ambiguous, stay in Audit mode and end the report by offering to apply the fixes.

## Workflow

### Step 1: Audit

Scan the target scope for violations of each rule in `rules/`. Search patterns:

- `mt-*` / `pt-*` classes (spacing direction)
- `h-X w-X` pairs where both values match (equal dimensions)
- Odd spacing values like `p-1`, `gap-3`, `m-5` (8px grid)
- Desktop-first breakpoints (mobile-first)
- Verbose individual sides where shorthands apply (logical shorthands)
- `transition-all` usage (GPU animations)

### Step 2: Report

List all findings grouped by rule:

```
## Tailwind CSS Audit Results

### HIGH Severity
- `src/components/Card.tsx:15` - `mt-4` → use `mb-4` or `gap` on parent
- `src/components/Avatar.tsx:12` - `h-10 w-10` → `size-10`

### MEDIUM Severity
- `src/components/Button.tsx:8` - `p-3` (12px) → use `p-2` (8px) or `p-4` (16px)

### Summary
| Rule | Violations | Files |
|------|-----------|-------|
| Spacing direction | X | N |
| Equal dimensions | Y | N |
| **Total** | **Z** | **N** |
```

### Step 3: Fix (fix mode only)

Skip this step entirely in Audit mode. Only apply changes when the request is in Fix mode (see Mode Detection).

Apply fixes. For each fix:
1. Verify the change preserves visual appearance
2. Keep changes minimal — only fix the identified issue
3. Adjust surrounding elements when changing spacing direction

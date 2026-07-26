---
title: Spacing Scale and Shorthands
impact: HIGH
tags: spacing, grid, 8px, shorthand, consistency
---

## 8px grid (HIGH)

**Rule**: Use spacing classes that are multiples of 8px — the industry standard (Material Design, Apple HIG). Odd values and arbitrary pixel values fragment the scale.

Valid 8px scale classes: `2` (8px), `4` (16px), `6` (24px), `8` (32px), `10` (40px), `12` (48px), `14` (56px), `16` (64px), `20` (80px), `24` (96px), `32` (128px)

When fixing, round to the nearest valid value: `3` → `2` or `4`, `5` → `4` or `6`, `7` → `6` or `8`. An arbitrary value is justified when matching a fixed external constraint — an icon's intrinsic size, a third-party embed — in which case say so rather than rounding.

### Incorrect

```tsx
<div className="p-1 gap-3 m-5">
<div className="p-[13px]">
<div className="mt-7 py-9">
```

### Correct

```tsx
<div className="p-2 gap-4 m-4">
<div className="p-4">
<div className="mb-8 py-8">
```

## Logical shorthands (MEDIUM)

**Rule**: Use shorthand classes (`m-*`, `p-*`, `px-*`, `py-*`) instead of naming individual sides when the values are equal.

### Incorrect

```tsx
<div className="mt-4 mr-4 mb-4 ml-4">
<div className="pt-2 pb-2">
<div className="pl-4 pr-4">
```

### Correct

```tsx
<div className="m-4">
<div className="py-2">
<div className="px-4">
```

---
title: Sizing, Breakpoints, and Transitions
impact: MEDIUM
tags: size, responsive, breakpoints, animation, performance
---

## Equal dimensions (HIGH)

**Rule**: Use `size-*` when width and height are the same value; it says "square" in one class instead of two that can drift apart. Separate `h-*`/`w-*` is right when the values differ, or when only one axis is being set.

### Incorrect

```tsx
<div className="h-8 w-8">
<div className="h-full w-full">
<div className="w-6 h-6">
```

### Correct

```tsx
<div className="size-8">
<div className="size-full">
<div className="size-6">

<!-- Correct — dimensions differ -->
<div className="h-8 w-12">
<div className="h-full w-screen">
```

## Mobile-first breakpoints (MEDIUM)

**Rule**: Write base classes for the smallest screen and add `md:`/`lg:`/`xl:` to scale up. Tailwind's breakpoint prefixes are min-width, so a desktop-first ladder fights the cascade and reads backwards.

### Incorrect

```tsx
<!-- Desktop-first — shrinking down -->
<div className="text-2xl md:text-xl sm:text-lg">
<div className="grid-cols-4 md:grid-cols-2 sm:grid-cols-1">
```

### Correct

```tsx
<!-- Mobile-first — scaling up -->
<div className="text-lg md:text-xl lg:text-2xl">
<div className="grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
```

## GPU-accelerated animations (MEDIUM)

**Rule**: Prefer animating `transform` and `opacity` over `width`, `height`, `margin`, or `padding` — they skip layout recalculation. Where a layout property genuinely must animate, scope the transition to it (`transition-[width]`) rather than reaching for `transition-all`.

### Incorrect

```tsx
<div className="transition-all hover:ml-4">
<div className="transition-all duration-300 hover:w-64">
```

### Correct

```tsx
<div className="transition-transform hover:translate-x-4">
<div className="transition-[width] duration-300 hover:w-64">
```

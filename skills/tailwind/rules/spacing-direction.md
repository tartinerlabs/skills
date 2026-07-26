---
title: Spacing Direction — Prefer Bottom
impact: HIGH
tags: spacing, margin, padding, gap
---

**Rule**: Space elements from the bottom (`mb-*`, `pb-*`) or with `gap` on the parent. Picking one direction per axis avoids margin collapse and keeps vertical rhythm predictable, so `mt-*`/`pt-*` on a stack of siblings is worth flagging.

Top spacing is the right tool when the offset is the point: separating one element from something above it that it does not own, positioning an overlapping or absolutely-positioned element, or matching the direction a component already establishes. When the parent controls the layout, `gap` beats both.

### Incorrect

```tsx
<div className="mt-4 pt-4">
  <h2 className="mt-6">Title</h2>
  <p className="mt-2">Content</p>
</div>
```

### Correct

```tsx
<div className="mb-4 pb-4">
  <h2 className="mb-2">Title</h2>
  <p>Content</p>
</div>

<!-- Or let the parent own the spacing -->
<div className="flex flex-col gap-4">
  <h2>Title</h2>
  <p>Content</p>
</div>

<!-- Also correct — the offset is deliberate, not sibling rhythm -->
<div className="absolute top-0 mt-2">Badge</div>
```

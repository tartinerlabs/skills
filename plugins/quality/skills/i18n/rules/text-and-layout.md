---
title: Text and Layout
impact: HIGH
tags: unicode, cjk, emoji, rtl, bidi, truncation, text-expansion, dynamic-type
---

**Rule**: Treat text as Unicode of unknown length and direction, and build layouts that grow and mirror instead of clipping.

**Why**: German and Finnish run 30–40% longer than English, and short labels can double. CJK has no spaces to break on. An emoji or an accented letter can be several code units, so `slice(0, 20)` can cut one in half. Arabic and Hebrew mirror the whole layout.

### Checks

- **Unicode-safe text handling** — count, truncate, and split by grapheme cluster (user-perceived characters), not bytes or UTF-16 units; compare and sort with locale-aware collation; search case- and diacritic-insensitively where users expect it
- **User text untouched** — never transliterate, strip accents, or change the case of names and place names for display
- **Room to grow** — no fixed widths or heights on text containers; allow wrapping; truncate only non-essential text and keep the full text reachable
- **Semantic direction** — `leading`/`trailing` or `start`/`end` instead of `left`/`right` for alignment, padding, and position
- **Mirror what means direction** — back/forward chevrons and progress mirror in RTL; don't force a layout direction unless the content is inherently directional
- **Don't mirror what isn't** — maps, media playback controls, clocks, graphs with a time axis, phone numbers, and code keep their direction
- **Mixed direction** — isolate user-supplied text inside a localised sentence (`<bdi>`, `dir="auto"`, or the platform's bidi isolation) so a Hebrew place name doesn't reorder the punctuation around it
- **Text in images** — none; it cannot be translated

### Incorrect

```css
.badge { width: 80px; margin-left: 8px; text-align: left; white-space: nowrap; overflow: hidden; }
```

### Correct

```css
.badge { min-inline-size: 5rem; margin-inline-start: 0.5rem; text-align: start; }
```

### Alternatives

Fixed-width layouts are fine for genuinely fixed content — tabular figures, a code editor, a keypad. Don't build RTL-specific components ahead of an RTL language; semantic layout is the preparation, and RTL testing confirms it.

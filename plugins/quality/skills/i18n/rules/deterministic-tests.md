---
title: Deterministic Tests
impact: MEDIUM
tags: tests, locale, time-zone, dst, fixtures, pseudolocalisation
---

**Rule**: Tests set their locale, time zone, and calendar explicitly, and cover the cases that break internationalised code.

**Why**: A test that passes in Singapore and fails in New York — or on the night clocks change — teaches nobody anything. CI machines usually run in UTC with `en_US`, which hides every locale bug.

### Checks

- **Explicit inputs** — pass a locale, time zone, and calendar to the code under test, or set them for the test process (`TZ=…`, a locale override). Never read the machine's current settings
- **Fixed instants** — construct dates from epoch or ISO 8601 with offset; never `now()` in an assertion
- **Cases worth one test each**:
  - Dates in at least two locales with different order and clock (`en-US`, `de-DE`, `ja-JP`)
  - Numbers with different separators (`de-DE`, `fr-FR`, `hi-IN` grouping)
  - Kilometres vs miles, including an explicit preference overriding the locale
  - An event shown in its own zone vs the device's zone
  - A DST transition day (23- and 25-hour days) and grouping across it
  - Grouping events recorded in two zones on the same UTC day
  - Grapheme-safe truncation with emoji, accents, and CJK
  - Plural forms for 0, 1, 2, and many
- **Resource integrity** — every key used in code exists in the catalog, no catalog entry is unused or stale, and placeholders match across languages. Prefer the platform's build-time check over a custom test
- **Assert loosely on formatter output** — CLDR updates change spacing (narrow no-break spaces) and wording; compare against the formatter's own output for that locale, or assert on components, rather than hand-typed strings where possible

### Incorrect

```ts
expect(formatDate(new Date())).toBe("10/19/2026");
```

### Correct

```ts
const at = new Date("2026-03-29T00:30:00Z");
expect(formatDay(at, { locale: "en-GB", timeZone: "Europe/London" })).toBe("29 Mar 2026");
```

### Alternatives

Snapshot tests of formatted output are acceptable when they pin locale and zone and the team accepts updating them on runtime upgrades. UI checks (pseudolocalisation, RTL, large text) are often manual or screenshot-based; record what was checked rather than skipping it.

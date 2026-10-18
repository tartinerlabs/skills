# Web / JS / TS

`Intl` is built into every modern runtime and backed by CLDR. Use it directly; reach for a library only for message catalogs and plural-aware interpolation, which `Intl` does not provide.

## Strings

- **Keep the project's library** if it has one — `next-intl` (Next.js App Router), `react-i18next`, `vue-i18n`, `@angular/localize`, FormatJS/`react-intl`, Lingui. All of them support ICU MessageFormat plurals and select
- **Starting fresh**: pick the framework's conventional choice, with one JSON (or PO) file per locale and ICU messages:

```json
{ "trip.photos": "{count, plural, =0 {No photos} one {# photo} other {# photos}} in {place}" }
```

- **Plural rules without a library**: `new Intl.PluralRules(locale).select(n)` returns `zero`/`one`/`two`/`few`/`many`/`other`
- **Lists**: `new Intl.ListFormat(locale, { type: "conjunction" }).format(["Paris", "Rome", "Oslo"])` instead of `join(", ")` and `" and "`
- **Language attribute**: `<html lang="en">` set from the active locale; `dir` from it too when RTL ships
- **Server and client agree**: render with the same locale and time zone on both sides, or formatted dates cause hydration mismatches. Pass the zone explicitly rather than relying on the server's

## Formatting

| Need | API |
|---|---|
| Date / time | `Intl.DateTimeFormat(locale, { dateStyle, timeStyle, timeZone })` or `date.toLocaleString(locale, opts)` |
| Relative | `Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day")` → "yesterday" |
| Number / percent | `Intl.NumberFormat(locale, { style: "percent" })` |
| Currency | `Intl.NumberFormat(locale, { style: "currency", currency: "EUR" })` |
| Units | `Intl.NumberFormat(locale, { style: "unit", unit: "kilometer", unitDisplay: "short" })` |
| Duration | `Intl.DurationFormat(locale, { style: "short" }).format({ hours: 1, minutes: 20 })` — Baseline 2025; feature-detect or polyfill for older targets |
| Time-zone name | `Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "shortGeneric" })` |
| First weekday | `new Intl.Locale(locale).getWeekInfo?.().firstDay` (1 = Monday, 7 = Sunday). Not in every engine — some shipped a `weekInfo` property instead, and stable Firefox lacks it; fall back to a small region table |
| Sorting | `Intl.Collator(locale, { sensitivity: "base" }).compare` |
| Graphemes | `[...new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(text)]` for counting and truncating |
| Word breaks (CJK) | `Intl.Segmenter(locale, { granularity: "word" })` |

`locale` defaults to the user's (`undefined`, or `navigator.languages` in the browser); pass it explicitly in tests and on the server.

**Measurement system**: `Intl` doesn't expose it. Imperial distance is the default for US, UK (road distance), Liberia, and Myanmar regions — derive it from `new Intl.Locale(locale).maximize().region`, and let an explicit user setting override.

## Time Zones

- `Date` is an instant; it has no zone. Store ISO 8601 with `Z` or epoch milliseconds, plus the IANA zone string for place-bound events
- Format in a given zone with `timeZone` on `Intl.DateTimeFormat`; get the device's with `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Calendar arithmetic across DST: use `Temporal` (`Temporal.ZonedDateTime.add({ days: 1 })`) where the runtime ships it, or `date-fns-tz`/Luxon where the project already uses one. Don't add a library just for this if `Intl` covers the display need
- Avoid `getTimezoneOffset()` math for anything but the current instant on the current device

## RTL and Layout (CSS)

- Logical properties: `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `text-align: start`, `border-start-start-radius`
- Tailwind: `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`, and `rtl:` variants for icons that mirror (`rtl:-scale-x-100`)
- Flex and grid already follow `dir`; avoid `flex-direction: row-reverse` used to fake RTL
- `<bdi>` or `dir="auto"` around user-generated text inside a sentence

## Validation

- **Pseudolocalisation** — a pseudo locale that accents and lengthens every string (`[Ŝéţţîñĝš one two]`) exposes hardcoded text and clipping. FormatJS (`@formatjs/cli` with `--pseudo-locale`) and Lingui support it
- **Missing keys** — the library's extraction/lint step (`formatjs extract`, `i18next-parser`, `lingui extract`, ESLint `i18next/no-literal-string`) in CI
- **RTL** — set `<html dir="rtl">` in dev and walk the primary flows
- **Tests** — pass `locale`/`timeZone` explicitly, or run the test process with `TZ=` set (e.g. `TZ=America/New_York` in the test script). Note that Node's ICU data can differ slightly from browsers

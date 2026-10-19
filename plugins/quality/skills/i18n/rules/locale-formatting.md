---
title: Locale-Aware Formatting
impact: HIGH
tags: dates, numbers, currency, percent, duration, relative-time, hour-cycle, first-weekday
---

**Rule**: Format every date, time, number, percentage, currency amount, and duration with the platform's locale-aware formatter, using the user's locale and preferences by default.

**Why**: `MM/dd/yyyy` reads as a different date in most of the world, `1,234.5` is `1.234,5` in Germany and `1 234,5` in France, and many users set 24-hour time against their region's default. Formatters built on CLDR get these right; hand-written formats and string templates do not.

### Checks

- **No hardcoded patterns** for display — request components or a style (date + time, "abbreviated month and day") and let the formatter order them
- **No hardcoded separators, symbols, or clocks** — no `toFixed` plus `","`, no `"$" + amount`, no `"h:mm a"`
- **Hour cycle** comes from the user's settings; don't force 12- or 24-hour
- **First day of the week** comes from the locale or calendar API, not a constant Sunday or Monday
- **Currency** — format with the transaction's currency code; the locale decides symbol and position. Don't convert currency on the user's behalf
- **Relative dates** ("yesterday", "in 3 days") and **durations** ("1 h 20 min") through their dedicated formatters
- **Parse vs display** — fixed formats (ISO 8601, `en-US-POSIX`) are right for storage, APIs, and file names, and wrong for anything a person reads
- **Formatter reuse** — create formatters once where the platform makes them expensive (Android, older JS runtimes), not per list row

### Incorrect

```ts
`${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.getHours() % 12}:${d.getMinutes()} PM`;
"$" + price.toFixed(2);
```

### Correct

```ts
new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(d);
new Intl.NumberFormat(locale, { style: "currency", currency: order.currency }).format(order.total);
```

### Alternatives

A fixed format is correct when it is a standard rather than a display — ISO 8601 in a CSV export, an RFC date in an HTTP header. An explicit in-app preference ("Always use 24-hour time") overrides the system, as long as the default follows the system.

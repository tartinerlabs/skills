---
title: Units and Measurements
impact: HIGH
tags: measurement, distance, km, miles, temperature, canonical-units
---

**Rule**: Store measurements in one canonical unit, convert only for display, and pick the display unit from the user's explicit preference, then the locale's measurement system.

**Why**: The US uses miles and Fahrenheit, the UK uses miles for road distance but metric elsewhere, and most of the world is metric. A hardcoded `"km"` is wrong for hundreds of millions of users, and a stored formatted string (`"5.2 km"`) can never be converted or re-localised.

### Checks

- **Canonical storage** — metres, seconds, kilograms, Celsius/Kelvin as plain numbers (or the platform's measurement type); never formatted strings
- **Precedence** — an explicit in-app unit setting wins; otherwise the locale's measurement system (and usage — road distance vs person height)
- **Formatter does the unit** — use measurement formatting so the unit name, abbreviation, spacing, and plural are localised; don't append `" km"` yourself
- **Precision by context** — 0.1 km for a run, whole kilometres for a flight; let the formatter round
- **Coordinates are not localised** — latitude/longitude stay in their standard form; only the number formatting may follow the locale where users read them

### Incorrect

```ts
`${(meters / 1000).toFixed(1)} km`;
```

### Correct

```ts
// defaultDistanceUnit: from the platform's measurement system (see the platform guide)
const unit = settings.distanceUnit ?? defaultDistanceUnit(locale);
new Intl.NumberFormat(locale, { style: "unit", unit, maximumFractionDigits: 1 })
  .format(unit === "mile" ? meters / 1609.344 : meters / 1000);
```

### Alternatives

Domain-fixed units stay fixed — nautical miles in aviation and sailing, metres in a track-and-field app — when the field itself uses one unit worldwide. Offer a unit setting only where users genuinely disagree with their locale (runners in the UK often want kilometres).

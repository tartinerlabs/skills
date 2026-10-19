---
title: Localisable Strings
impact: CRITICAL
tags: strings, catalogs, plurals, interpolation, concatenation, keys
---

**Rule**: Every user-facing string goes through the platform's localisation API, as one whole message with placeholders, and with plural forms handled by the platform's plural rules.

**Why**: A string that skips localisation cannot be translated without a code change. Concatenation fixes English word order and grammar into the code. Languages have between one and six plural forms (Arabic has six), so `count == 1 ? "item" : "items"` is wrong for most of them.

### What Counts as User-Facing

Labels, buttons, titles, alerts and dialogs, errors shown to users, empty states, onboarding, settings, notifications, accessibility labels/hints/values/actions, and App Store or store-listing strings shipped in the app. **Not** user-facing: log messages, analytics event names, identifiers, and user-generated content.

### Checks

- **Whole sentences** — `"Deleted \(count) items from \(album)"` as one message, never `"Deleted " + n + " items"`
- **Plurals by the platform** — ICU `{count, plural, …}` or the catalog's plural variations; never a ternary on `count == 1`
- **No grammar in code** — no building sentences from fragments, appending `"s"`, or choosing articles and gender in code
- **Translator context** — a comment on any string whose meaning is ambiguous ("Open" as verb or adjective, a lone placeholder)
- **Stable keys** — keep existing keys when the source text changes slightly; a new key drops every existing translation. Use semantic keys (`trip.delete.confirm`) where the project already does, otherwise the platform's default
- **Errors** — map error types to localised messages at the UI boundary; don't show raw `error.message` or system errors that may not be localised
- **No external translation** — never send strings or user content to a translation service as part of this work

### Incorrect

```ts
const label = count + " photo" + (count === 1 ? "" : "s") + " in " + album;
```

### Correct

```ts
// messages/en.json: "photosIn": "{count, plural, one {# photo} other {# photos}} in {album}"
const label = t("photosIn", { count, album });
```

### Alternatives

Proper nouns, brand names, and technical identifiers (`SKU-1042`, a file path) can stay unlocalised; mark them so (verbatim text, `translate="no"`) rather than routing them through the catalog. A developer-only debug screen does not need localising.

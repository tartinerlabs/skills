# Android (Kotlin, Compose)

Android resources and `java.time`/ICU formatters are locale-aware by default. Most work is moving strings into `strings.xml` and replacing hand-written formats.

## Strings

- **`res/values/strings.xml`** — `stringResource(R.string.trip_deleted)` in Compose, `getString(R.string.…)` elsewhere
- **Placeholders**: positional `%1$s`, `%2$d` so translators can reorder: `<string name="photos_in">%1$d photos in %2$s</string>`
- **Plurals**: `<plurals name="photo_count"><item quantity="one">%d photo</item><item quantity="other">%d photos</item></plurals>` with `pluralStringResource(R.plurals.photo_count, count, count)`
- **Not translatable**: `translatable="false"` for brand names and identifiers
- **Per-app language** (Android 13+): `res/xml/locales_config.xml` plus `android:localeConfig` once more than one language ships; `AppCompatDelegate.setApplicationLocales` for older versions
- **Accessibility**: `contentDescription = stringResource(…)`, `Modifier.semantics { stateDescription = … }`, `CustomAccessibilityAction(label = stringResource(…))`

## Formatting

| Need | API |
|---|---|
| Date / time | `DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT).withLocale(locale)` |
| Skeleton (components only) | `android.icu.text.DateFormat.getInstanceForSkeleton("MMMd", locale)` |
| 12/24-hour | `android.text.format.DateFormat.is24HourFormat(context)`, or the skeleton `"jm"` |
| Relative | `android.icu.text.RelativeDateTimeFormatter` or `DateUtils.getRelativeTimeSpanString` |
| Number / percent / currency | `NumberFormat.getInstance(locale)`, `getPercentInstance`, `getCurrencyInstance` with `currency = Currency.getInstance(code)` |
| Measurement | `android.icu.number.NumberFormatter.withLocale(locale).unit(MeasureUnit.KILOMETER).usage("road")` (API 30+); `MeasureFormat` before that |
| Measurement system | `LocaleData.getMeasurementSystem(ULocale.forLocale(locale))` (API 28+) |
| First weekday | `WeekFields.of(locale).firstDayOfWeek` |
| Sorting | `java.text.Collator.getInstance(locale)` |
| Graphemes | `android.icu.text.BreakIterator.getCharacterInstance(locale)` |

`locale` comes from `LocalConfiguration.current.locales[0]` in Compose; never `Locale.US` for display.

## Time Zones

- Store `Instant` (epoch millis) plus `ZoneId.id` for place-bound events
- Display with `instant.atZone(ZoneId.of(event.zoneId))`; group by `.toLocalDate()` in that zone
- `ZonedDateTime.plusDays(1)` is DST-safe; `plusHours(24)` is not

## Layout

- `android:supportsRtl="true"` in the manifest; `start`/`end` instead of `left`/`right` in XML; Compose `Row`, `Arrangement.Start`, and `padding(start =)` mirror automatically
- `Icons.AutoMirrored.Filled.ArrowBack` (and the other `AutoMirrored` icons) for directional icons; `autoMirrored="true"` on vector drawables
- `BidiFormatter.getInstance().unicodeWrap(userText)` around user text inside a localised sentence
- Don't fix text sizes in `dp`; use `sp` and let rows grow

## Validation

- **Pseudolocales**: `pseudoLocalesEnabled true` in the debug build type, then set the device language to `en-XA` (accented, longer) or `ar-XB` (RTL)
- **Lint**: `HardcodedText`, `MissingTranslation`, `RtlHardcoded`, `SetTextI18n`, and `SimpleDateFormat` checks — keep them as errors
- **Tests**: pass `Locale` and `ZoneId` explicitly; Robolectric `@Config(qualifiers = "de-rDE")` for resource tests

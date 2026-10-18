# Apple Platforms (Swift, SwiftUI, UIKit)

Foundation and SwiftUI localise by default: string literals in SwiftUI views are `LocalizedStringKey`s, and `FormatStyle` follows the user's locale, calendar, and clock settings. Most work is routing the remaining strings through the catalog and removing hand-written formats.

## Strings — String Catalogs

- **One `Localizable.xcstrings`** per target (or per shared package), English as the development language. Xcode extracts strings from code on each build and marks unused ones stale. Migrate existing `.strings`/`.stringsdict` with Xcode's **Migrate to String Catalog** rather than by hand
- **In views**: `Text("Delete Trip")`, `Button("Save") { }`, `.navigationTitle("Settings")`, `.alert("Delete Trip?", isPresented:)`, `Label("Map", systemImage: "map")` are already localisable
- **Outside views**: `String(localized: "Trip deleted", comment: "Toast after deleting a trip")`; pass `LocalizedStringResource` through models and intents so the string resolves at display time
- **Strings held in variables** lose localisation when passed as `String` to `Text` — `Text(verbatim:)` makes that explicit for user content; for app strings, pass `LocalizedStringKey`/`LocalizedStringResource` instead
- **Interpolation**: `Text("\(count) photos in \(place)")` becomes a key with `%lld` and `%@`; add plural variations to that entry in the catalog (Vary by Plural). Interpolate `Measurement`/`Date` values with a format: `Text("Walked \(distance, format: .measurement(width: .abbreviated, usage: .road))")`
- **Comments**: `Text("Open", comment: "Button that opens the selected trip")` — the comment appears to translators
- **Packages**: resources in a Swift package need `defaultLocalization` in `Package.swift`, and lookups pass `bundle: .module`
- **Accessibility**: `.accessibilityLabel("Delete trip")`, hints, values, and `.accessibilityAction(named: "Archive")` take localisable keys like `Text`
- **Notifications**: local notification content uses `String(localized:)` or, to localise on the receiving device, `NSString.localizedUserNotificationString(forKey:arguments:)`; remote ones use `loc-key`/`loc-args`
- **Info.plist strings** (permission prompts like `NSLocationWhenInUseUsageDescription`) go in `InfoPlist.xcstrings`

## Formatting — FormatStyle

| Need | API |
|---|---|
| Date / time | `date.formatted(date: .abbreviated, time: .shortened)` or `.formatted(.dateTime.day().month().hour().minute())` |
| In a given zone | `var style = Date.FormatStyle(date: .abbreviated, time: .shortened); style.timeZone = event.timeZone` |
| Relative | `date.formatted(.relative(presentation: .named))` → "yesterday" |
| Date range | `(start..<end).formatted(.interval)` |
| Number / percent | `value.formatted(.number.precision(.fractionLength(1)))`, `.formatted(.percent)` |
| Currency | `amount.formatted(.currency(code: order.currencyCode))` |
| Measurement | `distance.formatted(.measurement(width: .abbreviated, usage: .road))` — picks km or miles for the locale |
| Duration | `Duration.seconds(4800).formatted(.units(allowed: [.hours, .minutes], width: .abbreviated))` |
| Lists | `places.formatted(.list(type: .and))` |
| Names | `PersonNameComponents.formatted(.name(style: .medium))` |

- **Explicit unit preference**: convert first, then disable automatic conversion — `distance.converted(to: .miles).formatted(.measurement(width: .abbreviated, usage: .asProvided))`
- **First weekday**: `Calendar.current.firstWeekday`; build week grids from the calendar, never a fixed Sunday
- **12/24-hour**: never set `DateFormatter.dateFormat` for display; `.dateTime.hour()` follows the user's setting
- **Parsing / storage**: `Date.ISO8601FormatStyle` or `.verbatim(…, locale: Locale(identifier: "en_US_POSIX"), timeZone:, calendar:)` for machine formats only

## Time Zones

- `Date` is an absolute instant — keep persisting it as is. Add a `timeZoneIdentifier: String` (e.g. `TimeZone.current.identifier` at record time, or the zone of a reverse-geocoded coordinate — `MKMapItem.timeZone`, or `CLPlacemark.timeZone` on older targets) alongside place-bound events
- **SwiftData / Core Data**: a new optional attribute is a lightweight migration; existing rows get `nil` and fall back to the device zone. Propose it — don't add it without approval
- **Grouping by day**: `var cal = Calendar(identifier: .gregorian)` is wrong for non-Gregorian users — use `Calendar.current` and set `cal.timeZone = eventZone`, then `cal.startOfDay(for:)` or `cal.dateComponents([.year, .month, .day], from:)`
- **Arithmetic**: `cal.date(byAdding: .day, value: 1, to: date)`, `cal.dateInterval(of: .day, for:)` — DST-safe; never `addingTimeInterval(86_400)`
- **Event-local vs device-local**: when they differ, show the zone with `.timeZone(.genericLocation)` or an offset

## Text and Layout

- **Compare and search**: `localizedStandardCompare(_:)` for sorting, `localizedStandardContains(_:)` for search (case- and diacritic-insensitive)
- `String.count` already counts grapheme clusters; truncate with `prefix(_:)`, not `utf16` offsets
- **Leading/trailing**: `HStack`, `.padding(.leading)`, `.frame(alignment: .leading)`, `.multilineTextAlignment(.leading)` mirror automatically; `.left`/`.right` alignments don't
- **Directional SF Symbols** (`chevron.forward`, `arrow.backward`) mirror automatically; prefer `forward`/`backward` names over `right`/`left`. Use `.flipsForRightToLeftLayoutDirection(true)` only for custom images that need it
- **Keep direction** on `Map`, coordinates, media controls, and charts with a time axis — `.environment(\.layoutDirection, .leftToRight)` only around content that is inherently LTR
- **Room to grow**: no `.frame(width:)` on text, `.lineLimit(nil)` or a generous limit, `ViewThatFits` to switch `HStack`/`VStack`; test with Dynamic Type accessibility sizes

## Validation

- **Scheme → Run → Options**: App Language **Double-Length Pseudolanguage**, **Right-to-Left Pseudolanguage**, and **Accented Pseudolanguage**; App Region to test formats. Also enable **Show non-localized strings** to flag text that bypasses the catalog
- **Xcode Previews**: `.environment(\.locale, Locale(identifier: "de_DE"))`, `.environment(\.layoutDirection, .rightToLeft)`, `.dynamicTypeSize(.accessibility5)`
- **Build settings**: `LOCALIZATION_PREFERS_STRING_CATALOGS = YES` and `SWIFT_EMIT_LOC_STRINGS = YES` (Use Compiler to Extract Swift Strings) — the default in new projects
- **Catalog integrity**: Xcode's build-time extraction flags missing and stale entries; treat stale entries as cleanup, not errors to suppress
- **Xcode MCP**: when available in Claude Code, `LocalizationPlanner`, `StringCatalogRead`, and `StringCatalogEdit` inspect and edit catalogs without hand-editing JSON
- **Tests (Swift Testing / XCTest)**: pass `Locale(identifier:)`, `TimeZone(identifier:)!`, and a `Calendar` explicitly — `.formatted(.dateTime.locale(locale))`, `style.timeZone = zone`. Don't depend on the simulator's region

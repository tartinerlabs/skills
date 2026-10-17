# iOS (SwiftUI and UIKit)

Apple's Human Interface Guidelines (HIG) are what iPhone users have learned — Jakob's law means departing from them costs learning time. Prefer system components: they bring the expected behaviour, Dynamic Type, accessibility, and future OS changes for free.

## Targets and Layout

- Minimum hit target **44×44 pt** (HIG). A small icon can keep a larger hit area with `.contentShape(Rectangle())` and padding
- Respect safe areas — content and controls clear of the notch, Dynamic Island, and home indicator
- Support Dynamic Type: use text styles (`.font(.body)`, `.font(.headline)`) rather than fixed point sizes, and check layouts at the largest accessibility sizes

## Navigation

| Need | System pattern |
|---|---|
| Top-level sections (2–5) | `TabView` with a bottom tab bar — more than five overflows into "More", so pick the five that matter |
| Drill-down hierarchy | `NavigationStack` — swipe-from-left-edge back comes free; never disable it |
| Focused sub-task | `.sheet` — with `.presentationDetents([.medium, .large])` when the user should keep context underneath |
| Full-screen task with its own flow | `.fullScreenCover`, with an explicit close button |

- The back button shows the previous screen's title — keep titles short so it stays meaningful
- Do not build custom back buttons that drop the edge swipe

## Current System Design (Liquid Glass)

- System tab bars, navigation bars, toolbars, and sheets pick up the current OS design (Liquid Glass from iOS 26) when built with the current SDK; custom-drawn chrome does not, and looks foreign next to every other app (`rules/jakobs-law.md`)
- Glass belongs to the navigation layer floating above content, not to the scrolling content itself — Apple's WWDC25 design guidance warns glass on the content layer collides with the navigation layer
- Check legibility over changing backgrounds, and with Reduce Transparency and Increase Contrast turned on
- How glass looks (tint, shape, layering) is visual styling — out of scope here

## Actions and Choices

- Destructive confirmations: `.confirmationDialog` (action sheet) with the destructive option in `.destructive` role — red, and separated from Cancel
- Brief, blocking decisions only: `.alert`; anything with more content belongs in a sheet
- Secondary row actions: `.swipeActions` plus a visible alternative such as `.contextMenu` or an edit mode (`rules/signifiers.md`)
- Menus: `Menu` for a small set of related actions behind one control

## Feedback

- Haptics: `.sensoryFeedback(.success, trigger:)` (iOS 17+) or `UINotificationFeedbackGenerator` / `UIImpactFeedbackGenerator` / `UISelectionFeedbackGenerator`. Use `.selection` for picker changes, `.success`/`.error` for outcomes, impact for physical-feeling moments — not for every tap
- Progress: `ProgressView` (indeterminate under a few seconds, determinate beyond); pull-to-refresh with `.refreshable`
- Empty states: `ContentUnavailableView` (iOS 17+) with a title, short explanation, and the action that fills the screen

## Text Input

- `.textContentType(.emailAddress)`, `.oneTimeCode`, `.password`, `.newPassword`, `.postalCode` — enables AutoFill and password suggestions (`rules/defaults.md`)
- `.keyboardType(.emailAddress)`, `.numberPad`, `.decimalPad`, `.phonePad`
- `.submitLabel(.next)` / `.done` and move focus with `@FocusState` so a form can be completed without reaching for the screen

## Permissions

Each permission prompt shows once, and its purpose string (`NS…UsageDescription` in `Info.plist`) is shown inside the system dialog — write it as the benefit to the user, not the technical need. Prime in your own UI first (`references/mobile.md`).

## Conventions Users Expect

- SF Symbols for icons — users recognise their meaning; pair unfamiliar ones with a label
- Settings that belong to the system (notifications, permissions) link to the app's page in Settings rather than being re-implemented
- Large title on the root screens of a navigation stack, inline title deeper in

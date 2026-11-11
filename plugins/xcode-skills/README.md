# xcode-skills

The `xcode-skills` collection contains fifteen skills authored by Apple and exported with `xcrun agent skills export --replace-existing` from Xcode 27.0 (build `27A5218g`). The exported directory is published unchanged; Tartiner Labs maintains only the plugin wrapper and marketplace metadata outside it.

## Skills

| Skill | Description |
|-------|-------------|
| [adopt-c-bounds-safety](../../xcode-skills/adopt-c-bounds-safety) | Adopt and debug the C bounds-safety language extension |
| [app-intents-specialist](../../xcode-skills/app-intents-specialist) | Apply Apple's App Intents best practices |
| [app-intents-whats-new-27](../../xcode-skills/app-intents-whats-new-27) | Use new App Intents APIs and migration guidance for iOS 26 and 27 |
| [app-resizability](../../xcode-skills/app-resizability) | Adapt apps to resizable windows and multiple windows |
| [audit-xcode-security-settings](../../xcode-skills/audit-xcode-security-settings) | Audit and enable security-oriented Xcode build settings |
| [building-document-based-swiftui-applications](../../xcode-skills/building-document-based-swiftui-applications) | Build and migrate document-based SwiftUI apps with the Document protocol |
| [device-interaction](../../xcode-skills/device-interaction) | Verify apps on a device or simulator through screenshots and UI interaction |
| [macos-touch-gestures](../../xcode-skills/macos-touch-gestures) | Add direct touch support to macOS apps with gesture recognizers |
| [modernize-tests](../../xcode-skills/modernize-tests) | Modernize XCTest and Swift Testing suites |
| [siri-app-integration](../../xcode-skills/siri-app-integration) | Make an app work with Siri's model through tool intents and generable entities |
| [siri-evaluations](../../xcode-skills/siri-evaluations) | Write, run, and analyze SiriEvaluations scenarios for an app's App Intents |
| [swiftui-specialist](../../xcode-skills/swiftui-specialist) | Apply Apple's SwiftUI best practices |
| [swiftui-whats-new-27](../../xcode-skills/swiftui-whats-new-27) | Use SwiftUI APIs and migration guidance for SDK 27 |
| [uikit-app-modernization](../../xcode-skills/uikit-app-modernization) | Modernize UIKit apps for multi-window environments |
| [xctrace](../../xcode-skills/xctrace) | Profile with xctrace, Apple's command-line interface to Instruments |

## Installation

```bash
# Claude Code
claude plugin marketplace add tartinerlabs/skills
claude plugin install xcode-skills@tartinerlabs

# Codex
codex plugin add xcode-skills@tartinerlabs

# Direct installer
pnpm dlx skills add https://github.com/tartinerlabs/skills/tree/main/xcode-skills
```

In Codex and Claude Code, skills use the `xcode-skills:<skill-name>` namespace. In Cursor, install `xcode-skills` from the `tartinerlabs` marketplace.

Some workflows expect Xcode's agent runtime, including Xcode project tools, device interaction, or subagent support.

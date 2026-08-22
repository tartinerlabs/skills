# Swift and Xcode Commit Messages

The convention used by the Swift project itself. The universal rules in `rules/message-format.md` still apply — this covers the Swift-specific expression of them.

**This is the Tier 3 fallback only.** Most Swift applications and SwiftPM packages on GitHub use plain imperative or conventional commits rather than the compiler project's bracket-tag style. Tiers 1 and 2 of `rules/convention-detection.md` decide first. In particular, an app in an `.xcodeproj` is far more likely to want plain format than `[tag]`.

## Subject

```
[stdlib] Fix Comparable conformance for Optional
Correctly compute 'is dependent type' bits in 'Type'
```

- Split the message into a **single-line title** and a body separated by a blank line.
- The title must be concise enough to read in a commit log and to fit in the subject line of a commit email. Swift states no hard character count; 50 is a safe target and stays consistent with every other family.
- **Optional area tag in square brackets** when the change is restricted to one part of the codebase: `[stdlib] …`, `[SILGen] …`. Draw the tag from tags already in use.
- **Capitalised** after the tag, imperative, no trailing period.
- Be specific about *what* changed. Swift's guide contrasts a weak subject, "bits were not set right", with a strong one, "Correctly compute 'is dependent type' bits in 'Type'".

## Body

- Blank line between title and body.
- Concise but complete reasoning — explain the *why*.
- Omit code examples and detail better suited to the bug tracker.
- Include the issue link when the commit fixes a tracked bug.
- Same formatting and spelling standards as documentation and code comments.
- For a revert or a follow-up, include the **git revision of the prior commit** it relates to.

## Xcode Projects

Nothing in Xcode enforces or implies a commit convention — there is no Xcode-native equivalent of commitlint. An `.xcodeproj` or `.xcworkspace` is therefore evidence about the *ecosystem*, not about the format. Prefer history (Tier 2) whenever the repository has one, and default to plain imperative (`rules/message-format.md`, Family 5) rather than bracket tags for application repositories.

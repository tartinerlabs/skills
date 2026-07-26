# Go Commit Messages

The convention used by the Go project itself and by most Go language-upstream and library repositories. The universal rules in `rules/message-format.md` still apply — this covers the Go-specific expression of them.

**This is the Tier 3 fallback only.** A great many Go applications use conventional commits via `cog.toml` or release-please. Tiers 1 and 2 of `rules/convention-detection.md` decide first; reach this file only when neither produced a verdict.

## Subject

```
math: improve Sin, Cos and Tan precision for very large arguments
```

- Prefix with the **primary affected package**, then `: `.
- The rule of thumb from Go's contribution guide: the subject should complete the sentence *"This change modifies Go to \_\_\_\_."*
- Consequences of that rule, stated explicitly upstream:
  - **Does not start with a capital letter**
  - **Is not a complete sentence**
  - **Summarises the result** of the change, not the mechanics

## Choosing the Package Prefix

Use the import path segment that owns the change, not the full path — `net/http` for `src/net/http/`, `math` for `src/math/`. For a change spanning several packages, use the common parent or the package where the behaviour actually changes. Confirm against history:

```
git log --no-merges -n 20 --format=%s -- <path>
```

Multi-area changes sometimes use a comma: `net/http, net/url: …`.

## Body

- Blank line after the subject.
- **Complete sentences with correct punctuation**, same standard as Go doc comments.
- **No HTML, Markdown, or any other markup** — plain text only.
- Wrapped at around 72 columns.

## Issue References

Go puts issue references in the body, not in a separate footer block, and uses its own keywords:

```
Fixes #159
```

```
Updates #12345
```

- `Fixes #N` — the change fully resolves the issue; the tracker closes it automatically when the change lands.
- `Updates #N` — the change is a partial step toward the issue.
- From an `golang.org/x/...` repository, fully qualify: `Fixes golang/go#159`.

For a Go project hosted on GitHub with normal GitHub issue handling, `rules/issue-references.md` applies instead — `Fixes` is valid in both, so it usually reads the same either way.

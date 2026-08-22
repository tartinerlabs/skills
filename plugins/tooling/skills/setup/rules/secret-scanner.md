# Secret Scanner

Secrets detection in the pre-commit hook to prevent accidental credential leaks. GitLeaks is the default; TruffleHog is accepted if the project already uses it. Wire up whichever scanner the project has — do not add a second one alongside an existing one.

## Prerequisite

A secret scanner must be installed on the system:

```bash
brew install gitleaks      # default
# or, if the project already uses it:
brew install trufflehog
```

## Hook

Add to `.husky/pre-commit` as the **first command** (before lint-staged), so secrets are caught before any other processing:

```bash
# GitLeaks (default)
gitleaks git --staged --redact --verbose
```

```bash
# TruffleHog (only if the project already uses it)
trufflehog git file://. --since-commit HEAD --results=verified,unknown --fail
```

Include `unknown` in the TruffleHog results so credentials it cannot verify online still block the commit, matching GitLeaks's behaviour. Use exactly one scanner as the first hook command.

### Why This Matters

Unlike the other tools here, secret scanning is **recommended for every project** — the cost of one leaked credential dwarfs the cost of the hook. Scanning the staged diff before the commit lands is the last cheap place to stop a key from entering git history, where it is expensive to fully purge. This is the one choice in the skill that is not really optional.

### Alternatives

The *scanner* is swappable — TruffleHog is an accepted alternative (repo-wide) and some teams prefer server-side scanning (GitHub secret scanning, CI gates) as defence in depth. What is not a real alternative is *not scanning at all*. GitLeaks is the default because it is fast, local, and zero-config; swap the tool freely, keep the practice.

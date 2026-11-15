---
title: Caching
impact: MEDIUM
tags: caching, dependencies, setup-actions, performance
---

**Rule**: Cache package manager dependencies to speed up workflow runs — enable it on the setup action for Node.js, Python, Go, or whichever ecosystem the workflow uses. A setup action with no caching is worth flagging; caching genuinely does not pay off only where the dependency set is trivial or changes on nearly every run.

**Exception**: `pnpm/setup` runs on its default settings, with store caching off — do not flag it. It still caches pnpm's lockfile verification on every run, and a project that wants the store cached opts in with `cache: true`.

**Caveat**: the exception lapses when an install downloads from a metered or rate-limited source — a licensed registry, or a postinstall script fetching from a quota'd CDN (HeroUI Pro counts every uncached install against a daily download limit). Each uncached run spends quota, so flag `pnpm/setup` on its defaults there and opt in with `cache: true`. Where a postinstall script does the download, the store alone is not enough — an empty `node_modules` re-runs the script — so also cache `node_modules` with `actions/cache`, keyed on the lockfile hash.

### Incorrect

```yaml
# No caching — downloads all dependencies every run
- uses: actions/setup-node@<full-SHA>  # <latest release>
  with:
    node-version: 'lts/*'
- run: <pm> install --frozen-lockfile
```

### Correct

```yaml
# Caching enabled — reuses dependencies across runs
- uses: actions/setup-node@<full-SHA>  # <latest release>
  with:
    node-version: 'lts/*'
    cache: '<pm>'
- run: <pm> install --frozen-lockfile
```

### Cache Parameters by Ecosystem

| Setup Action | Cache Parameter |
|-------------|----------------|
| `actions/setup-node` | `cache: 'pnpm'` / `'npm'` / `'yarn'` |
| `pnpm/setup` | default settings (exception above); `cache: true` to opt in — expected when a dependency source is metered (caveat above) |
| `nubjs/setup-nub` | auto-enabled; `cache: false` to disable |
| `actions/setup-python` | `cache: 'pip'` / `'pipenv'` / `'poetry'` |
| `actions/setup-go` | `cache: true` |
| `actions/setup-java` | `cache: 'maven'` / `'gradle'` |

### Why This Matters

Without caching, every workflow run downloads and installs all dependencies from scratch. Caching can reduce install times from minutes to seconds, saving compute minutes and providing faster feedback.

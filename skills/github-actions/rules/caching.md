---
title: Caching
impact: MEDIUM
tags: caching, dependencies, setup-actions, performance
---

**Rule**: Cache package manager dependencies to speed up workflow runs. Always enable caching when using setup actions for Node.js, Python, Go, or other ecosystems.

### Incorrect

```yaml
# No caching — downloads all dependencies every run
- uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020  # v7.0.0
  with:
    node-version: 'lts/*'
- run: pnpm install --frozen-lockfile
```

### Correct

```yaml
# Caching enabled — reuses dependencies across runs
- uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020  # v7.0.0
  with:
    node-version: 'lts/*'
    cache: 'pnpm'
- run: pnpm install --frozen-lockfile
```

### Cache Parameters by Ecosystem

| Setup Action | Cache Parameter |
|-------------|----------------|
| `actions/setup-node` | `cache: 'pnpm'` / `'npm'` / `'yarn'` |
| `actions/setup-python` | `cache: 'pip'` / `'pipenv'` / `'poetry'` |
| `actions/setup-go` | `cache: true` |
| `actions/setup-java` | `cache: 'maven'` / `'gradle'` |

### Why This Matters

Without caching, every workflow run downloads and installs all dependencies from scratch. Caching can reduce install times from minutes to seconds, saving compute minutes and providing faster feedback.

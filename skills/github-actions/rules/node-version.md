---
title: Node Version
impact: MEDIUM
tags: node, lts, setup-node, versioning
---

**Rule**: Prefer LTS aliases over hardcoded version numbers — `lts/*` tracks the current LTS release without manual bumps, so it does not go stale. Exact versions are right when the project pins one deliberately: a `.nvmrc`/`engines` constraint to honour, a matrix deliberately testing specific majors, or a reproducibility requirement. Read the version from the project's own pin where it has one.

### Incorrect

```yaml
# Hardcoded version — goes stale, requires manual bumps
- uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020  # v7.0.0
  with:
    node-version: '20'

# Version file — extra file to maintain
- uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020  # v7.0.0
  with:
    node-version-file: '.node-version'
```

### Correct

```yaml
# LTS alias — always resolves to the latest LTS
- uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020  # v7.0.0
  with:
    node-version: 'lts/*'
```

### Available Aliases

| Alias | Resolves to |
|-------|-------------|
| `lts/*` | Current LTS (recommended default) |
| `lts/-1` | Previous LTS (for compatibility testing) |
| `latest` | Latest release including non-LTS (avoid in CI) |

### Why This Matters

Hardcoded versions go stale and require manual updates when new LTS releases come out. LTS aliases ensure workflows always use a supported, stable version without maintenance overhead.

---
title: Permissions
impact: HIGH
tags: permissions, least-privilege, security
---

**Rule**: Every workflow must declare explicit permissions using the principle of least privilege. Add a top-level `permissions` block to every workflow. Only grant the minimum permissions required.

### Incorrect

```yaml
# No permissions block — defaults to broad read/write access
name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0
```

### Correct

```yaml
name: CI
on: [push]

# Minimal permissions — only what's needed
permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0
```

### Common Permission Scopes

| Scope | When to use |
|-------|-------------|
| `contents: read` | Checking out code, reading files |
| `contents: write` | Creating releases, pushing commits |
| `pull-requests: write` | Commenting on or updating PRs |
| `issues: write` | Creating or updating issues |
| `packages: write` | Publishing to GitHub Packages |
| `id-token: write` | OIDC token for cloud deployments |

### Per-Job Permissions

For workflows with multiple jobs needing different access, use job-level permissions:

```yaml
permissions:
  contents: read  # default for all jobs

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0

  release:
    permissions:
      contents: write  # only this job needs write
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0
```

### Why This Matters

Without explicit permissions, workflows default to broad read/write access to the repository. A compromised action or workflow could modify code, create releases, or access secrets.

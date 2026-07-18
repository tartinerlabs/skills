---
title: Dependency Review
impact: HIGH
tags: ci, github-actions, dependency-review, supply-chain
---

**Rule**: Add a CI workflow that blocks PRs introducing dependencies with known vulnerabilities.

### Host

`actions/dependency-review-action` is **GitHub-only** (it reads GitHub's dependency graph). On GitLab, skip this template and use GitLab's built-in Dependency Scanning (`include: template: Security/Dependency-Scanning.gitlab-ci.yml`) instead.

### Detection

Skip if a `.github/workflows/*.{yml,yaml}` file already contains `dependency-review-action`.

### Template

Create `.github/workflows/dependency-review.yml`:

```yaml
name: Dependency Review

on:
  pull_request:
    branches:
      - main

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: write

jobs:
  dependency-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0

      - uses: actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294  # v5.0.0
```

### Adaptation

- Match action release versions used in the project's existing workflows while retaining full commit SHA pins
- Follow the project's action pinning rules; absent a project-specific rule, pin every action to a full commit SHA with a version or source-ref comment
- Replace `main` with the project's default branch if different
- No package manager setup needed — the action uses GitHub's dependency graph API

### How It Works

`actions/dependency-review-action` compares the dependency manifest between the PR's base and head commits. It fails the check if the PR introduces dependencies with known vulnerabilities (CVEs). The `pull-requests: write` permission allows it to post an inline comment summarising the findings.

### Why This Matters

Unlike `<pm> audit` which checks existing dependencies, dependency review specifically targets what a PR *changes*. It catches vulnerable new dependencies before they enter the lockfile, acting as a gate rather than a retrospective scan.

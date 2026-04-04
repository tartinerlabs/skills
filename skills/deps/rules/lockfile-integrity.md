---
title: Lockfile Integrity
impact: MEDIUM
tags: ci, github-actions, lockfile, tampering, supply-chain
---

**Rule**: Add a CI workflow that flags PRs where the lockfile changed without a corresponding `package.json` change.

### Detection

Skip if a `.github/workflows/*.yml` file already contains a step checking lockfile integrity or lockfile tampering.

### Template

Create `.github/workflows/lockfile-integrity.yml`:

```yaml
name: Lockfile Integrity

on:
  pull_request:
    branches:
      - main

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  lockfile-integrity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check for lockfile tampering
        run: |
          BASE="${{ github.event.pull_request.base.sha }}"
          HEAD="${{ github.event.pull_request.head.sha }}"

          LOCKFILE_CHANGED=$(git diff --name-only "$BASE" "$HEAD" -- <lockfile>)
          MANIFEST_CHANGED=$(git diff --name-only "$BASE" "$HEAD" -- '**/package.json')

          if [ -n "$LOCKFILE_CHANGED" ] && [ -z "$MANIFEST_CHANGED" ]; then
            echo "::error::Lockfile was modified without a corresponding package.json change. This may indicate lockfile tampering."
            echo "If this is intentional (e.g., lockfile maintenance), add a package.json change or open a dedicated maintenance PR."
            exit 1
          fi

          echo "Lockfile integrity check passed."
```

### Adaptation

- Replace `<lockfile>` with the detected lockfile name:
  - pnpm: `pnpm-lock.yaml`
  - npm: `package-lock.json`
  - yarn: `yarn.lock`
  - bun: `bun.lock`
- Match action versions used in the project's existing workflows
- Replace `main` with the project's default branch if different

### Known False Positives

- **Lockfile maintenance PRs** from Renovate — these intentionally update transitive dependencies without changing `package.json`. The error message instructs the user to handle this explicitly.
- **Deduplication runs** (`<pm> dedupe`) — these optimise the lockfile without manifest changes.

For Renovate lockfile maintenance, this check will fail as designed. The Renovate PR description clearly labels these as maintenance — reviewers can approve manually.

### Why This Matters

Lockfile tampering is a supply chain attack where an attacker modifies the lockfile to resolve a dependency to a malicious version without changing `package.json`. Since most code reviewers focus on source changes and skip lockfile diffs, this attack vector is easy to miss. This check surfaces suspicious lockfile-only changes for explicit review.

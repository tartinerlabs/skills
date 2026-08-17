---
title: Matrix Strategy
impact: LOW
tags: matrix, parallel, fail-fast, ci
---

**Rule**: Use a matrix when parallel work needs isolated jobs — different OS, language versions, or other variants that each need their own checkout and setup. Independent commands that share one setup belong in `rules/parallel-steps.md`.

### Incorrect

```yaml
# Isolated variants as sequential jobs — duplicated setup, no fail-fast
jobs:
  test-20:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020  # v7.0.0
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
  test-22:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020  # v7.0.0
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
```

### Correct

```yaml
# One job, isolated per variant — fail-fast cancels the rest
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: true
      matrix:
        node: ['20', '22']
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020  # v7.0.0
        with:
          node-version: ${{ matrix.node }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
```

### Fail Fast

`fail-fast: true` cancels remaining matrix jobs as soon as one fails. This saves compute minutes and gives faster feedback — if Node 20 fails, there is no point waiting for Node 22.

### When to Use

- The same job across OS, language versions, or other isolated variants
- Tasks that each need their own runner, checkout, or toolchain

### When NOT to Use

- Independent steps that share one checkout/install — `rules/parallel-steps.md`
- Commands that must run in order (e.g., build before deploy)
- A single variant, where a matrix adds nothing

### Why This Matters

A matrix turns isolated variants into one job definition. Combined with `fail-fast`, a broken cell surfaces faster than a list of copy-pasted jobs, and you do not pay to finish the rest.

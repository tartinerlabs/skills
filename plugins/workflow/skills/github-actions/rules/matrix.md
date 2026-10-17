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
  test-22:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<full-SHA>  # <latest release>
      - uses: pnpm/setup@<full-SHA>  # <latest release>
        with:
          runtime: node@22
      - run: pnpm test
  test-24:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<full-SHA>  # <latest release>
      - uses: pnpm/setup@<full-SHA>  # <latest release>
        with:
          runtime: node@24
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
        node: ['22', '24']
    steps:
      - uses: actions/checkout@<full-SHA>  # <latest release>
      - uses: pnpm/setup@<full-SHA>  # <latest release>
        with:
          runtime: node@${{ matrix.node }}
      - run: pnpm test
```

`pnpm/setup` replaces `actions/setup-node` and runs `pnpm install` itself. A matrix is the one place it takes an input: `runtime` deliberately overrides the `devEngines.runtime` pin so each cell gets its own Node.

### Fail Fast

`fail-fast: true` cancels remaining matrix jobs as soon as one fails. This saves compute minutes and gives faster feedback — if Node 22 fails, there is no point waiting for Node 24.

### When to Use

- The same job across OS, language versions, or other isolated variants
- Tasks that each need their own runner, checkout, or toolchain

### When NOT to Use

- Independent steps that share one checkout/install — `rules/parallel-steps.md`
- Commands that must run in order (e.g., build before deploy)
- A single variant, where a matrix adds nothing

### Why This Matters

A matrix turns isolated variants into one job definition. Combined with `fail-fast`, a broken cell surfaces faster than a list of copy-pasted jobs, and you do not pay to finish the rest.

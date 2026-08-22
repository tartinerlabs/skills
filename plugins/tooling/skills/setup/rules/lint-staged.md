# lint-staged

Run linters on staged files before committing.

## Install

```bash
<pm> add -D lint-staged
```

## Config

Add to `package.json`:

```json
{
  "lint-staged": {
    "*": ["biome check --write --no-errors-on-unmatched"]
  }
}
```

## Hook

Add to `.husky/pre-commit` (after GitLeaks, before any other commands):

```bash
pnx lint-staged
```

### Why This Matters

Running Biome only against staged files keeps commits fast — the hook checks what you are actually committing rather than re-processing the whole tree — while still guaranteeing nothing unformatted or lint-broken lands in a commit.

### Alternatives

You can skip lint-staged and instead format the whole project on save (editor integration), or enforce checks only in CI, or run `biome check` across all files in the hook. Those trade commit-time speed for simplicity. If the project deliberately runs checks another way, keep it.

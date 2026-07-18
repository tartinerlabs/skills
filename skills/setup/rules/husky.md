# Husky

Git hooks manager for running scripts on git events.

## Install

```bash
pnx husky init
```

This creates a `.husky/` directory and a default `pre-commit` hook.

## Pre-commit Hook

The final `.husky/pre-commit` is assembled by other rules (GitLeaks, lint-staged). The expected order is:

```bash
gitleaks git --staged --redact --verbose
pnx lint-staged
```

Replace the default content created by `husky init` with the above.

### Why This Matters

Husky is the most widely-used git-hooks manager for JS/TS projects: hooks live as plain scripts in a committed `.husky/` directory, so they are version-controlled, reviewable, and shared automatically on clone. That ubiquity means contributors recognise the setup and tooling integrates with it out of the box.

### Alternatives

`simple-git-hooks` (zero-dependency, config in `package.json`) and `Lefthook` (faster, parallel, polyglot) are both solid alternatives, as are native `.git/hooks` scripts for a project that wants no dependency at all. If the project already manages hooks another way, keep it — Husky is a default, not a mandate.

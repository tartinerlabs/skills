---
title: Parallel Steps
impact: LOW
tags: parallel, background, wait, ci
---

**Rule**: Use step-level parallelism inside a job when independent steps share setup, or when a long-running process must stay up while later steps run. This is not `strategy.matrix` — that is job-level isolation; see `rules/matrix.md`.

### Incorrect

```yaml
# Sequential after shared setup — each command waits for the last
steps:
  - run: pnpm install --frozen-lockfile
  - run: pnpm check
  - run: pnpm test
  - run: pnpm build
```

### Correct

```yaml
# Shared setup, then independent commands overlap
steps:
  - run: pnpm install --frozen-lockfile
  - parallel:
      - run: pnpm check
      - run: pnpm test
      - run: pnpm build
```

`parallel` runs the group as background steps and waits for all of them before the next step. Prefer it when the job only needs "run these together, then continue".

### Background services

Use `background: true` when a step must stay running while later steps work, then `wait` or `cancel` by `id`:

```yaml
steps:
  - name: Start server
    id: server
    run: pnpm start
    background: true
  - run: pnpm test
  - cancel: server
```

- `wait: server` or `wait: [frontend, backend]` — block until those IDs finish. Always runs; no `if`. Fails if any referenced background step fails.
- `wait-all:` — block until every currently active background step finishes (no arguments). Fails if any fail, unless `continue-on-error` is set.
- `cancel: server` — graceful stop by `id`. Always runs; no `if`. A background step that needs a later `wait` or `cancel` must have an `id`.

### Limits

- At most 10 steps may run concurrently.
- `parallel` cannot be used inside composite actions.
- `wait` and `cancel` ignore `if` and always run.

### When to Use

- Independent commands that share checkout/install (lint, test, build)
- A service or monitor that must stay up for later steps
- Non-blocking work that a later step must join

### When NOT to Use

- Each variant needs its own runner, OS, or toolchain — `rules/matrix.md`
- Steps must run in order (build before deploy)
- A single command, where parallelism adds nothing

### Why This Matters

Step-level parallelism keeps one checkout and one install, then overlaps the independent work. A matrix of the same commands pays for that setup on every cell. Background steps are also how a job starts a service, runs work against it, and tears it down without a second job.

### Alternatives

A command matrix is still right when you *want* isolated runners — different resource needs, or a failure in one command must not share a workspace with another. Keep that shape when it is deliberate, not as the default for "run lint and test after one install".

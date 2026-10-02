---
title: Migration Drift
impact: HIGH
tags: migrations, schema, drift, orm, required-check
---

**Rule**: In a project with committed migrations, add a dedicated drift-check job (e.g. `migration-drift`) that fails when the schema source has changes no committed migration covers. Make it a required status check. Without it, a PR can merge schema changes without the migration, and production then runs code against a schema that was never migrated.

Apply only when the project uses a migration tool and commits its migrations. With no migration tool, or with schema-push-only projects that commit no migrations, skip this rule.

### Detection

Detect the tool from its config and read both paths from that config. Never guess them:

- **Schema source** — the files the tool generates migrations from
- **Migrations dir** — where generated migrations are committed

A repository can hold several configs, for example one per database in a monorepo. Check each one separately.

### Check Command per Tool

Each tool needs a command that reports what migration it *would* generate and exits non-zero when that migration is non-empty. A command that writes files instead is followed by `git status --porcelain -- <migrations dir>`.

Prefer the project's own generate script (e.g. `db:generate` in `package.json`) over the raw command, since it already carries the right config. Fall back to the raw command only when no script exists.

| Tool | Config | Check | Needs a database |
|------|--------|-------|------------------|
| Drizzle | every `drizzle.config.*` (`schema`, `out`) | `drizzle-kit generate --config=<cfg>`, then fail on `git status --porcelain -- <out>` output | No — diffs against the latest snapshot in `out` |
| Prisma 7 | `prisma.config.ts`, else `prisma/schema.prisma` | `prisma migrate diff --from-migrations <dir> --to-schema <schema> --exit-code` (exit 2 = drift) | Yes — a shadow database, `shadowDatabaseUrl` in `prisma.config.ts` |
| Django | `manage.py` + each app's `migrations/` | `python manage.py makemigrations --check --dry-run` | No |
| Alembic | `alembic.ini` (`script_location`) | `alembic check` | Yes — compares models against a migrated database |

Prisma 6 and earlier spell the flag `--to-schema-datamodel`. Read the installed version before writing the command.

For any other tool, use its equivalent "would generate" or check command. Where none exists (e.g. Rails), say so and skip the job. Never invent one.

### Incorrect

```yaml
# Drift check buried in the test job — cannot be required on its own
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - run: <pm> test
      - run: <check command>
```

### Correct

```yaml
on:
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  migration-drift:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    # Only for tools that need a database — a throwaway container, never a real one
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 5s --health-retries 10
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0
      # Same setup and install steps as the project's CI template, cache included
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020  # v7.0.0
        with:
          node-version: 'lts/*'
          cache: '<pm>'
      - run: <pm> install --frozen-lockfile
      # Project script or raw command, one line per config
      - run: <check command>
```

For tools that write files (e.g. Drizzle), follow generate with a step that names the drift and says what to do:

```yaml
      - name: Check for missing migrations
        run: |
          drift=$(git status --porcelain -- <migrations dirs>)
          if [ -n "$drift" ]; then
            echo "$drift"
            echo "::error::Schema changed without a committed migration. Once the schema is signed off, run <generate script> and commit the output."
            exit 1
          fi
```

Use the workflow's existing `permissions`, `concurrency`, pinning, Node version, and caching per the other rules. Drop `services` when the tool needs no database, and point a shadow database at the container only, never at a real database.

### Required Status Check

The job alone blocks nothing. Tell the user to add the job, under whatever name it was given, as a required status check in branch protection or a ruleset (Settings → Rules). That is the step that blocks the merge, and the skill cannot do it for them.

### Ambiguous Changes

Some generators ask interactively when a change is ambiguous, such as whether a column was renamed or dropped and re-created. Without a TTY:

- **Drizzle (drizzle-kit 1.0.0-rc.4 and later)**: generate does not prompt. It exits 2 with a `missing_hints` message, so the job fails cleanly (verified)
- **drizzle-kit 0.x and other tools**: unverified. A generator may hang waiting for input

Keep the job's `timeout-minutes` as a safety net either way. Report a `missing_hints` failure, prompt error, or timeout as "ambiguous schema change: generate the migration locally", not as a CI fault.

### Never Generate Migrations

The job only detects drift. The skill never generates or commits migrations itself, even to make the check pass. The user iterates with schema push and generates migrations only once the schema is confirmed, so generating is their decision.

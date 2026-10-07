---
title: Migration Drift Pre-flight
impact: HIGH
tags: pr, migrations, schema, drift
---

**Rule**: Before pushing, warn and stop when the branch changes a schema source but adds no migration for it. This is an early warning only. The required CI check is what blocks the merge.

### Detection

Detect the project's migration tool from its config, such as `drizzle.config.*`, `prisma.config.ts`/`prisma/schema.prisma`, Django app `migrations/`, or `alembic.ini`. Read the **schema source** and **migrations dir** paths from that config rather than guessing them. A repository can have several configs (one per database). Pair each schema source with its own migrations dir.

With no migration tool detected, skip this rule silently.

### Check

Use only the config lookup and `git diff --name-only <base>...HEAD`. Run no installs, no tool commands, and nothing that needs a database.

- A schema source changed **and** no file was added under its migrations dir → warn and stop
- A schema source changed **and** a migration was added → continue
- No schema source changed → continue

### Incorrect

```
Pushed feat/add-orders and opened #42.
```

The branch changed `src/db/schema.ts`, and `drizzle/` has no new migration.

### Correct

```
src/db/schema.ts changed (drizzle.config.ts), but no new migration was added
under drizzle/. Proceed with the PR anyway?
```

Name each config and schema source that changed without a migration, then wait for the user's answer before pushing.

### Never Generate Migrations

Never run the generate command, even when it looks helpful. The user iterates with schema push and generates migrations only once the schema is confirmed, so generating is their decision. If they choose to proceed, push as normal.

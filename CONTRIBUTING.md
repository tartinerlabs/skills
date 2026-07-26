# Contributing

Thanks for your interest in contributing to `@tartinerlabs/skills`! This guide covers everything you need to get started.

`AGENTS.md` is the canonical reference for how this repository is put together — skill format, frontmatter fields, distribution, and plugin layout. This guide covers the contribution workflow.

## Getting Started

1. Fork the repository and clone your fork:

   ```sh
   git clone https://github.com/<your-username>/skills.git
   cd skills
   ```

2. Enable the git hooks (GitLeaks secrets scan on pre-commit, conventional commit check on commit-msg). [GitLeaks](https://github.com/gitleaks/gitleaks) must be installed (`brew install gitleaks`):

   ```sh
   git config core.hooksPath .githooks
   ```

3. Before opening a pull request, run the checks:

   ```sh
   go run ./scripts/validate-skills
   go test ./...
   ```

   Both are stdlib-only Go — there are no dependencies to install.

## Skill Structure

Each skill lives in its own directory under `skills/`:

```
skills/
  my-skill/
    SKILL.md        # Required — skill definition
    rules/          # Optional — modular rule files
      some-rule.md
    references/     # Optional — per-language guides, loaded on demand
      python.md
```

See `AGENTS.md` for the frontmatter fields and what each one does; the quickest start is to copy the shape from an existing `skills/*/SKILL.md`. The validator enforces the required fields, so a missing one fails fast with a message naming it.

## Writing a New Skill

1. Create a directory: `skills/<skill-name>/` — the directory name must match the `name` field
2. Add `SKILL.md` with the required frontmatter
3. Write the body as a lightweight guide rather than a rigid procedure. State a preference and its reason, then license the exception; `skills/setup/` is the reference for this style
4. If the skill has multiple checks, add a `rules/` subdirectory with individual rule files and reference each from a table in `SKILL.md`. Every rule file must be referenced — unreferenced files fail validation as orphans
5. Assign the skill to exactly one collection in the `collections` table in `scripts/validate-skills/main.go`, and add the matching symlink under `plugins/<collection>/skills/`
6. Open a pull request

## Plugin Metadata

Plugin manifests are hand-maintained under `plugins/<name>/` — one per channel, described in `AGENTS.md`. There is no generator.

Releases are cut by merging the release-please PR — **never bump versions by hand**. release-please syncs the plugin manifest versions from `.release-please-manifest.json` automatically.

## Conventions

- **allowed-tools scoping** — Grant the minimum permissions a skill needs. Prefer specific commands (e.g. `Bash(git status)`) over blanket tool access
- **GitHub skills** — Auto-assign to the current user via `@me` or `get_me`
- **Documentation commands** — Use `pnpm dlx`, not `pnx`

## Commits

This repository uses [conventional commits](https://www.conventionalcommits.org/) enforced by the `commit-msg` hook in `.githooks/`.

- **Max 50 characters** for the subject line
- Format: `type: description` — no scope (e.g. `feat: add deploy skill`, `fix: correct frontmatter field`)
- **Skill markdown is the product, not docs.** Changes under `skills/**/*.md` use `feat`/`fix`/`refactor`; reserve `docs:` for `README.md`, `AGENTS.md`, `CLAUDE.md`, and similar meta-documentation
- A GitLeaks pre-commit hook runs on every commit to detect secrets — do not bypass it

## Pull Requests

- Branch from `main`
- Use a descriptive, natural-language title (no conventional commit prefixes like `feat:` or `fix:`)
- CI validates the repository structure on every pull request, and additionally on push to `main`:
  - **Skills** — validates distribution via [skills.sh](https://skills.sh) and [Context7](https://context7.com)
  - **Release** — automated via release-please (maintains a release PR; merging it bumps versions, updates the changelog, and creates the GitHub release)
- The repo is also distributed as **Claude Code**, **Codex**, **Cursor**, and **Antigravity** plugins. Keep the plugin manifests aligned manually and treat `.release-please-manifest.json` as the shared version source

## Reporting Issues

Use the existing issue templates:

- [Bug report](https://github.com/tartinerlabs/skills/issues/new?template=bug_report.md)
- [Feature request](https://github.com/tartinerlabs/skills/issues/new?template=feature_request.md)

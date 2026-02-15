# Contributing

Thanks for your interest in contributing to `@tartinerlabs/skills`! This guide covers everything you need to get started.

## Getting Started

1. Fork the repository and clone your fork:

   ```sh
   git clone https://github.com/<your-username>/skills.git
   cd skills
   ```

2. Install dependencies (sets up Husky git hooks):

   ```sh
   pnpm install
   ```

## Skill Structure

Each skill lives in its own directory under `skills/`:

```
skills/
  my-skill/
    SKILL.md        # Required — skill definition
    rules/          # Optional — modular rule files
      some-rule.md
```

### SKILL.md Format

Every skill file starts with YAML frontmatter followed by the instructions Claude follows when the skill is active:

```markdown
---
name: my-skill
description: What it does and when to use it
allowed-tools: Read Edit Bash(git status)
metadata:
  model: sonnet
---

[Instructions for Claude when this skill is invoked]
```

#### Frontmatter Fields

| Field | Description |
|-------|-------------|
| `name` | Skill identifier, invoked as `/my-skill` in Claude Code |
| `description` | Purpose and trigger conditions |
| `allowed-tools` | Scoped tool permissions (e.g. `Bash(git status)` for a specific command, `Read` for full tool access) |
| `metadata.model` | Model preference — use `sonnet` unless the skill genuinely needs a more capable model |

### Rules Pattern

For skills with multiple checks or guidelines, create a `rules/` subdirectory alongside `SKILL.md`. The main skill file references rules via a table and tells Claude to read them at runtime. Each rule file is a standalone markdown document with severity, examples, and fix instructions. See `skills/commit/` for an example.

## Writing a New Skill

1. Create a directory: `skills/<skill-name>/`
2. Add `SKILL.md` with the frontmatter fields above
3. Write clear, actionable instructions in the body
4. If the skill has multiple checks, add a `rules/` subdirectory with individual rule files
5. Open a pull request

## Conventions

- **Language variant** — Skills should infer and match the target project's language variant (US/UK English) from existing commits, docs, and code
- **allowed-tools scoping** — Grant the minimum permissions a skill needs. Prefer specific commands (e.g. `Bash(git status)`) over blanket tool access
- **Model preference** — Default to `sonnet` for cost efficiency. Only use a higher-tier model when the skill genuinely requires it
- **GitHub skills** — Auto-assign to the current user via `@me` or `get_me`

## Commits

This repository uses [conventional commits](https://www.conventionalcommits.org/) enforced by commitlint.

- **Max 50 characters** for the subject line
- Format: `type(scope): description` (e.g. `feat: add deploy skill`, `fix: correct frontmatter field`)
- A GitLeaks pre-commit hook runs on every commit to detect secrets — do not bypass it

## Pull Requests

- Branch from `main`
- Use a descriptive, natural-language title (no conventional commit prefixes like `feat:` or `fix:`)
- CI runs two checks on push to `main`:
  - **Skills** — validates distribution via [skills.sh](https://skills.sh) and [Context7](https://context7.com)
  - **Release** — automated via semantic-release (bumps version, updates changelog, creates GitHub release)

## Reporting Issues

Use the existing issue templates:

- [Bug report](https://github.com/tartinerlabs/skills/issues/new?template=bug_report.md)
- [Feature request](https://github.com/tartinerlabs/skills/issues/new?template=feature_request.md)

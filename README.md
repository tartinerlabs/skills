# Skills

[![Release](https://img.shields.io/github/actions/workflow/status/tartinerlabs/skills/release.yml?style=for-the-badge&logo=github&label=release)](https://github.com/tartinerlabs/skills/actions/workflows/release.yml)
[![Skills](https://img.shields.io/github/actions/workflow/status/tartinerlabs/skills/skills.yml?style=for-the-badge&logo=github&label=skills)](https://github.com/tartinerlabs/skills/actions/workflows/skills.yml)
[![Version](https://img.shields.io/github/v/release/tartinerlabs/skills?style=for-the-badge)](https://github.com/tartinerlabs/skills/releases)
[![License](https://img.shields.io/github/license/tartinerlabs/skills?style=for-the-badge)](LICENSE)

Powertools for [Claude Code](https://docs.anthropic.com/en/docs/claude-code): git workflows, GitHub automation, code quality, and project tooling. Each skill ships with modular, independently editable rules for deep, opinionated guidance.

## Why These Skills

- **Modular rules architecture** &mdash; Each skill ships with standalone rule files in `rules/` directories. Rules can be added, removed, or edited independently without touching the main skill logic.
- **Opinionated audit workflows** &mdash; Skills like `security`, `github-actions`, `tailwind`, and `refactor` produce structured severity-graded reports, then auto-fix issues.
- **GitLeaks built in** &mdash; The `commit`, `security`, and `setup` skills all enforce GitLeaks secret detection as a first-class concern.
- **Convention-aware** &mdash; Skills detect your project's existing conventions (language variant, commit format, package manager, project structure) and adapt automatically.

## Skills

Invoke any skill with `/skill-name` in Claude Code.

### Git

| Skill | Description |
|-------|-------------|
| [commit](skills/commit) | Clean git commits with conventional commit detection and GitLeaks secret scanning |
| [create-branch](skills/create-branch) | Create and checkout a branch with naming validation and GitHub issue linking |

### GitHub

| Skill | Description |
|-------|-------------|
| [create-pr](skills/create-pr) | Push branch and create a pull request with structured description and auto-assignment |
| [create-issue](skills/create-issue) | Create an issue with template detection and auto-assignment |
| [update-issue](skills/update-issue) | Update an issue's title, body, labels, assignees, or state with template preservation |
| [github-actions](skills/github-actions) | Create and audit GitHub Actions workflows with SHA pinning, permissions, and caching checks |

### Code Quality

| Skill | Description |
|-------|-------------|
| [refactor](skills/refactor) | Audit and refactor TypeScript/JavaScript code for dead code, deep nesting, type assertions, and design patterns |
| [security](skills/security) | OWASP Top 10 security audit with GitLeaks secret detection and dependency vulnerability scanning |
| [tailwind](skills/tailwind) | Audit and fix Tailwind CSS v4 anti-patterns for spacing, 8px grid, mobile-first, and GPU animations |
| [testing](skills/testing) | Write and run tests with Vitest and React Testing Library for JS/TS projects |

### Project

| Skill | Description |
|-------|-------------|
| [setup](skills/setup) | Add Biome, Husky, commitlint, lint-staged, GitLeaks, and TypeScript to JS/TS projects |
| [project-structure](skills/project-structure) | Audit project directory structure for colocation, grouping, and anti-pattern detection |
| [naming-format](skills/naming-format) | Audit and fix filename and export naming conventions for consistency |
| [update-project](skills/update-project) | Update and maintain CLAUDE.md, README.md, agents, skills, and rules to match current project state |

## Installation

### [Skills](https://skills.sh)

Install all skills:

```bash
pnpm dlx skills add tartinerlabs/skills
```

Install a single skill:

```bash
pnpm dlx skills add tartinerlabs/skills/commit
```

Install a subset for specific workflows:

```bash
# Git and GitHub workflow skills only
pnpm dlx skills add tartinerlabs/skills/commit
pnpm dlx skills add tartinerlabs/skills/create-branch
pnpm dlx skills add tartinerlabs/skills/create-pr
pnpm dlx skills add tartinerlabs/skills/create-issue

# Security-focused subset
pnpm dlx skills add tartinerlabs/skills/security
pnpm dlx skills add tartinerlabs/skills/commit
pnpm dlx skills add tartinerlabs/skills/setup
```

### [Context7](https://context7.com)

```bash
pnpm dlx ctx7 skills install /tartinerlabs/skills --all --universal
```

## Architecture

Skills use a modular rules pattern. Each skill directory contains:

```
skills/<name>/
  SKILL.md          # Skill definition with frontmatter
  rules/            # Independent, editable rule files
    some-rule.md    # Severity, examples, fix instructions
```

This means you can:
- **Customise** a rule's severity or examples without forking the skill
- **Add** project-specific rules by dropping a new `.md` file in `rules/`
- **Remove** rules you disagree with

## Skill Format

Each skill is a directory with a `SKILL.md` file following the [Agent Skills spec](https://agentskills.io).

## License

MIT

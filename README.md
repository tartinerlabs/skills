# Skills

[![Release](https://img.shields.io/github/actions/workflow/status/tartinerlabs/skills/release.yml?style=for-the-badge&logo=github&label=release)](https://github.com/tartinerlabs/skills/actions/workflows/release.yml)
[![Skills](https://img.shields.io/github/actions/workflow/status/tartinerlabs/skills/skills.yml?style=for-the-badge&logo=github&label=skills)](https://github.com/tartinerlabs/skills/actions/workflows/skills.yml)
[![Version](https://img.shields.io/github/v/release/tartinerlabs/skills?style=for-the-badge)](https://github.com/tartinerlabs/skills/releases)
[![License](https://img.shields.io/github/license/tartinerlabs/skills?style=for-the-badge)](LICENSE)

Powertools for [Claude Code](https://docs.anthropic.com/en/docs/claude-code): git workflows, GitHub automation, code quality, and project tooling.

## Skills

Invoke any skill with `/skill-name` in Claude Code.

### Git

| Skill | Description |
|-------|-------------|
| [commit](skills/commit) | Smart git commit with short, concise messages |
| [create-branch](skills/create-branch) | Create and checkout a new branch with validation and GitHub issue linking |

### GitHub

| Skill | Description |
|-------|-------------|
| [create-pr](skills/create-pr) | Push branch and create a pull request (auto-assigned) |
| [create-issue](skills/create-issue) | Create an issue with title and description (auto-assigned) |
| [update-issue](skills/update-issue) | Update an issue's title, body, labels, or assignees |
| [ci-cd](skills/ci-cd) | Create and audit GitHub Actions workflows |

### Code Quality

| Skill | Description |
|-------|-------------|
| [refactor](skills/refactor) | Audit and refactor code for clarity, maintainability, and correctness |
| [security](skills/security) | Run security audit with GitLeaks setup and code analysis |
| [tailwind](skills/tailwind) | Audit and fix Tailwind CSS v4 anti-patterns |

### Project

| Skill | Description |
|-------|-------------|
| [setup](skills/setup) | Add dev tooling to JS/TS projects (linting, formatting, git hooks, TypeScript) |
| [folder-org](skills/folder-org) | Project code structure and file organization guidance |
| [sync-docs](skills/sync-docs) | Update and maintain CLAUDE.md and README.md documentation |

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

### [Context7](https://context7.com)

```bash
pnpm dlx ctx7 skills install /tartinerlabs/skills --all --universal
```

## Skill Format

Each skill is a directory with a `SKILL.md` file following the [Agent Skills spec](https://agentskills.io).

## License

MIT

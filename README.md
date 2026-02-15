# @tartinerlabs/skills

Powertools for [Claude Code](https://docs.anthropic.com/en/docs/claude-code): git workflows, GitHub automation, code quality, and project tooling.

## Skills

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

Install all skills:

```bash
npx skills add tartinerlabs/skills
```

Install a single skill:

```bash
npx skills add tartinerlabs/skills/commit
```

## Usage

Invoke any skill with `/skill-name` in Claude Code:

```
/commit          Smart git commit
/create-branch   Create a branch linked to an issue
/create-pr       Push and open a pull request
/create-issue    File a new GitHub issue
/update-issue    Edit an existing issue
/ci-cd           Create or audit CI/CD workflows
/refactor        Refactor code for quality
/security        Run a security audit
/tailwind        Audit Tailwind CSS usage
/setup           Add linting, formatting, hooks
/folder-org      Get project structure guidance
/sync-docs       Sync project documentation
```

## Skill Format

Each skill is a directory with a `SKILL.md` file following the [Agent Skills spec](https://agentskills.io).

## License

MIT

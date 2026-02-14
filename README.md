# @tartinerlabs/skills

Powertools for Claude Code: git workflows, security audits, UI development, and code organization.

## Skills

| Skill | Description |
|-------|-------------|
| [commit](skills/commit) | Smart git commit with short, concise messages |
| [create-branch](skills/create-branch) | Create and checkout a new git branch with smart validation and GitHub issue integration |
| [create-issue](skills/create-issue) | Create a GitHub issue with title and description (auto-assigned) |
| [create-pr](skills/create-pr) | Push branch and create GitHub pull request (auto-assigned) |
| [folder-org](skills/folder-org) | Project code structure and file organization guidance |
| [heroui](skills/heroui) | Build accessible UIs using HeroUI v3 components (React + Tailwind CSS v4 + React Aria) |
| [security](skills/security) | Run security audit with GitLeaks pre-commit hook setup and code analysis |
| [sync-docs](skills/sync-docs) | Update and maintain CLAUDE.md and README.md documentation |
| [tailwind](skills/tailwind) | Audit and fix Tailwind CSS anti-patterns (spacing, size-*, gap, 8px grid) |
| [update-issue](skills/update-issue) | Update a GitHub issue with new title, body, labels, or assignees |

## Installation

Install all skills:
```bash
npx skills add tartinerlabs/skills
```

Install a specific skill:
```bash
npx skills add tartinerlabs/skills/commit
```

## Usage

Invoke any skill with `/skill-name` in Claude Code:
- `/commit` — Smart git commit
- `/create-branch` — Create a branch linked to a GitHub issue
- `/create-issue` — Create a GitHub issue
- `/create-pr` — Create a pull request
- `/folder-org` — Get project structure guidance
- `/heroui` — Build UIs with HeroUI v3
- `/security` — Run a security audit
- `/sync-docs` — Sync project documentation
- `/tailwind` — Audit Tailwind CSS usage
- `/update-issue` — Update a GitHub issue

## Skill Format

Each skill is a directory with a `SKILL.md` file following the [Agent Skills spec](https://agentskills.io).

## License

MIT

# CLAUDE.md

## Project Overview

**Repository:** https://github.com/tartinerlabs/skills
**Package:** `@tartinerlabs/skills`

A collection of skills for Claude Code distributed via [skills.sh](https://skills.sh). Each skill is a markdown file with YAML frontmatter following the [Agent Skills spec](https://agentskills.io).

## Structure

```
skills/
├── commit/          # Smart git commit with security check
├── create-branch/   # Branch creation with GitHub issue integration
├── create-issue/    # GitHub issue creation
├── create-pr/       # Pull request creation with commit analysis
├── folder-org/      # Project structure guidance
├── heroui/          # HeroUI v3 component development
├── security/        # Security audit with GitLeaks
├── sync-docs/       # Documentation sync
├── tailwind/        # Tailwind CSS optimization
└── update-issue/    # GitHub issue updates
```

## Skill Format

Each skill in `skills/<name>/SKILL.md`:

```markdown
---
name: skill-name
description: What it does and when to use it
allowed-tools: Space-delimited list of permitted tools
---

[Instructions Claude follows when the skill is active]
```

## Conventions

- Skills follow the [Agent Skills spec](https://agentskills.io)
- Invoke with `/skill-name` in Claude Code

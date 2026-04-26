# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**Repository:** https://github.com/tartinerlabs/skills
**Package:** `@tartinerlabs/skills`

A collection of agent skills distributed via Codex, Claude Code, Cursor, and [skills.sh](https://skills.sh). Each skill is a markdown file with YAML frontmatter following the [Agent Skills spec](https://agentskills.io).

## Development

- **Package manager:** pnpm (v10.29.3)
- **Git hooks:** Husky with commitlint (conventional commits via `@commitlint/config-conventional`) and GitLeaks secrets detection on pre-commit
- **Checks:** `pnpm run build` and `pnpm run check`
- **Releases:** Automated via semantic-release on push to `main` — bumps version in `package.json`, updates `CHANGELOG.md`, creates GitHub release

## Skill Format

Each skill lives in `skills/<name>/SKILL.md` with this structure:

```markdown
---
name: skill-name
description: What it does and when to use it
allowed-tools: Space-delimited list of permitted tools
model: sonnet
effort: medium
---

[Instructions Codex follows when the skill is active]
```

### Frontmatter Fields

- `name` — Skill identifier, invoked as `/skill-name` in Codex
- `description` — Purpose and trigger conditions
- `allowed-tools` — Scoped tool permissions (e.g., `Bash(git status)` for specific commands, `Read` for full tool access)
- `model` — Model preference (typically `sonnet` for cost efficiency)
- `effort` — Reasoning effort level (`low`, `medium`, `high`, `max`). Overrides the session effort level while the skill is active

### Rules Pattern

Skills with multiple checks use a `rules/` subdirectory alongside `SKILL.md`. The main skill file references rules via a table and tells Codex to read them at runtime. Each rule file is a standalone markdown document with severity, examples, and fix instructions. This keeps skills modular — rules can be added, removed, or edited independently.

## Distribution

Skills are distributed through five channels:
- **Codex plugin** — repo-scoped metadata in `.codex-plugin/plugin.json` with marketplace metadata in `.agents/plugins/marketplace.json`
- **Claude Code plugin** — `claude plugin install tartinerlabs/skills`
- **Cursor plugin** — Cursor metadata in `.cursor-plugin/plugin.json` with marketplace metadata in `.cursor-plugin/marketplace.json`
- **[skills.sh](https://skills.sh)** — `pnpm dlx skills add tartinerlabs/skills`
- **[Context7](https://context7.com)** — `pnpm dlx ctx7 skills install /tartinerlabs/skills --all --universal`

The `Skills` CI workflow validates skills.sh and Context7 distribution on push to `main`.

## Plugin Metadata

Plugin metadata is maintained manually by design.

- `.codex-plugin/plugin.json` is the Codex plugin manifest
- `.agents/plugins/marketplace.json` is the repo-scoped Codex marketplace entry
- `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` are the Claude plugin files
- `.cursor-plugin/plugin.json` and `.cursor-plugin/marketplace.json` are the Cursor plugin files
- `package.json.version` is the canonical shared field; semantic-release syncs manifest versions during release

When plugin copy changes, update Codex, Claude, and Cursor plugin manifests intentionally. Do not expose Claude-only hooks in Cursor metadata unless they have been ported to Cursor's runtime.

## GitHub Actions

- `actions/*` (GitHub-owned): use version tags (e.g., `@v4`)
- Third-party actions: pin to full commit hash with version comment (e.g., `@9fd676a...  # v4.2.0`)

## Conventions

- GitHub-related skills auto-assign to current user via `@me` or `get_me`
- PR and issue titles use natural language, NOT conventional commit prefixes
- The `/commit` skill enforces max 50-character commit messages, detects commitlint to choose conventional vs plain format, and ensures GitLeaks is configured before committing
- Skills can use both CLI tools (`gh`, `git`) and MCP tools (`mcp__github__*`) depending on the operation

---

## Plan: Make `@tartinerlabs/skills` Agent-Agnostic

Status: **Pending implementation**

The project currently presents as Claude Code-only despite 12 of 14 skills being agent-agnostic. This plan makes the project fully multi-agent (Claude Code, Codex, OpenCode) by updating metadata, refactoring agent-specific skill content, and adding OpenCode support.

### Research Findings

#### Agent config structures (from official docs)

| Agent | Instructions | Skills dir | Agents dir | Rules dir | Plugin manifest |
|-------|-------------|-----------|-----------|----------|----------------|
| Claude Code | `CLAUDE.md` | `.claude/skills/*/SKILL.md` | `.claude/agents/*.md` | `.claude/rules/*.md` | `.claude-plugin/plugin.json` |
| Codex | `AGENTS.md` | Via `.codex-plugin/plugin.json` `skills` path | — | — | `.codex-plugin/plugin.json` |
| OpenCode | `AGENTS.md` | `.opencode/skills/*/SKILL.md`, `.claude/skills/*/SKILL.md`, `.agents/skills/*/SKILL.md` | `.opencode/agents/` + `opencode.json` `agent` object | `AGENTS.md` + `opencode.json` `instructions` | No manifest — skills discovered by directory walking |

#### OpenCode specifics

- **No plugin manifest** — OpenCode discovers skills by walking `.opencode/skills/`, `.claude/skills/`, `.agents/skills/` (project) and corresponding global dirs
- **No `opencode plugin install`** — no GitHub-repo-based plugin installer like Claude Code's `claude plugin install`
- **OpenCode plugins** are TypeScript/JS code modules (event hooks, custom tools) — overkill for our markdown-only skills; not needed
- **Skills-only distribution** via skills.sh (`pnpm dlx skills add tartinerlabs/skills`) or Context7 is the right path for OpenCode
- **`AGENTS.md`** is OpenCode's project instructions file (equivalent to Claude Code's `CLAUDE.md`)
- **`CLAUDE.md` is read as fallback** if no `AGENTS.md` exists (Claude Code compatibility mode)
- **`.opencode/skills/` symlinks** in the repo enable auto-discovery when the repo is opened in OpenCode

#### Vercel plugin pattern (`vercel/vercel-plugin`)

Vercel uses **separate manifests per agent** sharing the same skill content:
- `.claude-plugin/plugin.json` — Claude Code
- `.cursor-plugin/plugin.json` — Cursor
- `.plugin/plugin.json` — Universal (for `npx plugins add`)
- Skills live in a shared `skills/` dir; each manifest just points to it
- Agent-specific hooks (`hooks/`) use `@anthropic-ai/claude-agent-sdk` — only work in Claude Code

**Our takeaway**: Keep separate agent manifests, shared skill content. No code-based plugins needed.

### Changes

#### 1. Update metadata/descriptions (5 files)

Replace "Claude Code skills for" → "Agent skills for":

| File | Change |
|------|--------|
| `package.json:3` | `"Claude Code skills for git workflows..."` → `"Agent skills for git workflows..."` |
| `.codex-plugin/plugin.json:4` | description: same replacement |
| `.claude-plugin/plugin.json:3` | description: same replacement |
| `.claude-plugin/marketplace.json` | description: same replacement |
| `.agents/plugins/marketplace.json` | Add `"description"` field if missing; same replacement |

#### 2. Add OpenCode support (new directory)

Create `.opencode/skills/` with symlinks to `skills/*/SKILL.md` for each skill:

```
.opencode/
└── skills/
    ├── commit -> ../../skills/commit
    ├── create-branch -> ../../skills/create-branch
    ├── deps -> ../../skills/deps
    ├── draft-release -> ../../skills/draft-release
    ├── link-issues -> ../../skills/link-issues
    ├── merge-branch -> ../../skills/merge-branch
    ├── pr-review -> ../../skills/pr-review
    ├── push-branch -> ../../skills/push-branch
    ├── release-check -> ../../skills/release-check
    ├── setup -> ../../skills/setup
    ├── update-project -> ../../skills/update-project
    └── commit -> ../../skills/commit
```

This enables auto-discovery when the repo is opened in OpenCode. No `.opencode-plugin/` manifest needed — OpenCode discovers skills from directory structure alone.

For users who don't open this repo, distribution via skills.sh copies skills into their local `.opencode/skills/`, `.claude/skills/`, or `.agents/skills/`.

#### 3. Refactor `update-project` skill (7 files)

The skill is currently hardcoded to Claude Code's `.claude/` directory structure. Refactor to **detect and maintain all agent config structures found in the project**.

##### `skills/update-project/SKILL.md` — Major rewrite

- **frontmatter**: Remove `compatibility: Designed for Claude Code...`. Change description from "syncing CLAUDE.md or README.md" → "syncing project instructions or README.md"
- **Rules Overview table**: Replace `CLAUDE.md` row with `Project Instructions` row covering both `CLAUDE.md` and `AGENTS.md`
- **Step 1 (Detect)**: Instead of "Check if CLAUDE.md and README.md exist", detect which instruction files exist (`CLAUDE.md`, `AGENTS.md`, or both). Scan for skills in `.claude/skills/`, `.agents/skills/`, `.opencode/skills/`. Scan for agents in `.claude/agents/`. Scan for rules in `.claude/rules/` and `AGENTS.md` `@rules/` references.
- **Step 2 (Update)**: Route to `rules/project-instructions.md` (renamed from `claude-md.md`) for both `CLAUDE.md` and `AGENTS.md`. Add `rules/agents-md.md` for `AGENTS.md`-specific sections. Keep `.claude/`-specific rules but make them conditional ("if `.claude/agents/` exists...").
- **Step 3 (Validate)**: Replace "Ensure CLAUDE.md, README.md..." with "Ensure project instructions and README.md..."

##### `rules/claude-md.md` → rename to `rules/project-instructions.md`

- Title: "Project Instructions Maintenance" (covers `CLAUDE.md` and `AGENTS.md`)
- Tags: remove `claude-md`, add `project-instructions`
- Rule text: generic — "Keep project instructions current" instead of "Keep Claude's project instructions current"
- Add note about detecting which file exists (`CLAUDE.md` for Claude Code, `AGENTS.md` for Codex/OpenCode) and updating the appropriate one

##### New file: `rules/agents-md.md`

- Title: "AGENTS.md Maintenance"
- Tags: `agents-md, documentation`
- Covers `AGENTS.md`-specific maintenance (used by Codex and OpenCode)
- What to scan: project overview, code style, testing sections, `@rules/` file references (OpenCode convention)
- What to update: refresh conventions, fix file references, add new tool references

##### `rules/agents.md` — Minor update

- Tags: remove `claude-agents`, add `agents`
- Add conditional: "If `.claude/agents/` directory exists..."
- Replace `CLAUDE.md` reference with "project instructions"

##### `rules/skills.md` — Minor update

- Tags: remove `claude-skills`, add `skills`
- Add note about multiple skill directories (`.claude/skills/`, `.agents/skills/`, `.opencode/skills/`)
- Replace `CLAUDE.md` reference with "project instructions"

##### `rules/rules.md` — Minor update

- Tags: remove `claude-rules`, add `rules`
- Add conditional: "If `.claude/rules/` exists..."
- Replace `CLAUDE.md` reference with "project instructions"

##### `rules/readme-md.md` — Minor update

- "that belongs in CLAUDE.md" → "that belongs in project instructions like CLAUDE.md or AGENTS.md"

#### 4. Update `deps` rule files (2 files)

- `skills/deps/rules/lockfile-integrity.md`: "Follow the project's CLAUDE.md action pinning rules" → "Follow the project's action pinning rules (check CLAUDE.md or AGENTS.md for conventions)"
- `skills/deps/rules/audit-workflow.md`: Same change

#### 5. Update `setup` skill (1 file)

- `skills/setup/SKILL.md`: "run `/deps` to harden the npm supply chain" → "use the deps skill to harden the npm supply chain" (removes `/skill-name` slash-command convention which is agent-specific)

#### 6. Update `agents/deps.md` (1 file)

- "If the project has a CLAUDE.md, read it for action pinning rules and other conventions" → "If the project has a CLAUDE.md or AGENTS.md, read it for action pinning rules and other conventions"

#### 7. Update README.md

- Title/tagline: "Powertools for Codex and Claude Code" → "Powertools for coding agents"
- Skills table intro: remove "Invoke any skill with `/skill-name` in Claude Code" → make agent-agnostic
- Installation: present all agents equally (Claude Code, Codex, OpenCode)
- Add OpenCode install: `pnpm dlx skills add tartinerlabs/skills` (copies to `.opencode/skills/`, `.claude/skills/`, or `.agents/skills/`)
- Architecture: update `update-project` description to mention multi-agent config detection
- Plugin metadata: remove Claude Code framing

#### 8. Update AGENTS.md (this file)

When implementing, also update the sections above to reflect:
- Distribution list including OpenCode
- Plugin metadata including `.opencode/skills/`
- Skill Format description agent-agnostic (not just "Codex follows")
- Frontmatter Fields not referencing specific agents

### Implementation Order

1. Metadata/descriptions (5 files) — independent, no dependencies
2. `deps` rule files (2 files) + `agents/deps.md` (1 file) — independent
3. `setup` skill (1 file) — independent
4. `update-project` skill refactor (7 files) — depends on understanding research findings
5. `.opencode/skills/` symlinks — depends on step 1 for descriptions
6. README.md — depends on all above for accurate content
7. AGENTS.md — last, reflects final state

### Files Changed: ~18 | New Files: 1 (`rules/agents-md.md`) + `.opencode/skills/` dir | Renamed: 1 (`claude-md.md` → `project-instructions.md`)

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

# Skills

[![Release](https://img.shields.io/github/actions/workflow/status/tartinerlabs/skills/release.yml?style=for-the-badge&logo=github&label=release)](https://github.com/tartinerlabs/skills/actions/workflows/release.yml)
[![Skills](https://img.shields.io/github/actions/workflow/status/tartinerlabs/skills/skills.yml?style=for-the-badge&logo=github&label=skills)](https://github.com/tartinerlabs/skills/actions/workflows/skills.yml)
[![Version](https://img.shields.io/github/v/release/tartinerlabs/skills?style=for-the-badge)](https://github.com/tartinerlabs/skills/releases)
[![License](https://img.shields.io/github/license/tartinerlabs/skills?style=for-the-badge)](LICENSE)

Powertools for coding agents: git workflows, GitHub automation, code quality, and project tooling. Each skill ships with modular, independently editable rules for deep, opinionated guidance.

## Why These Skills

- **Modular rules architecture** &mdash; Each skill ships with standalone rule files in `rules/` directories. Rules can be added, removed, or edited independently without touching the main skill logic.
- **Opinionated audit workflows** &mdash; Skills like `security`, `github-actions`, `tailwind`, and `refactor` produce structured severity-graded reports, then auto-fix issues.
- **GitLeaks built in** &mdash; The `commit`, `security`, and `setup` skills all enforce GitLeaks secret detection as a first-class concern.
- **Convention-aware** &mdash; Skills detect your project's existing conventions (language variant, commit format, package manager, project structure) and adapt automatically.

## Skills

Install the plugin for your agent, then invoke skills through that agent's native skill or command interface.

### Git

| Skill | Description |
|-------|-------------|
| [commit](skills/commit) | Clean git commits with conventional commit detection and GitLeaks secret scanning |
| [create-branch](skills/create-branch) | Create and checkout a branch with naming validation and GitHub issue linking |

### GitHub

| Skill | Description |
|-------|-------------|
| [create-pr](skills/create-pr) | Push branch and create a pull request with structured description and auto-assignment |
| [github-issues](skills/github-issues) | Create, update, query, and comment on GitHub issues with MCP |
| [github-actions](skills/github-actions) | Create and audit GitHub Actions workflows with SHA pinning, permissions, and caching checks |

### Code Quality

| Skill | Description |
|-------|-------------|
| [deps](skills/deps) | Harden npm supply chain with .npmrc flags, version pinning, and Renovate config |
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
| [update-project](skills/update-project) | Update and maintain CLAUDE.md, AGENTS.md, README.md, agents, skills, and rules to match current project state |

## Xcode Skills

The separate [`xcode-skills`](xcode-skills) collection contains seven skills authored by Apple and exported with `xcrun agent skills export` from Xcode 27.0 (build `27A5218g`). The exported directory is published unchanged; Tartiner Labs maintains only the plugin wrapper and marketplace metadata outside it.

| Skill | Description |
|-------|-------------|
| [adopt-c-bounds-safety](xcode-skills/adopt-c-bounds-safety) | Adopt and debug the C bounds-safety language extension |
| [audit-xcode-security-settings](xcode-skills/audit-xcode-security-settings) | Audit and enable security-oriented Xcode build settings |
| [device-interaction](xcode-skills/device-interaction) | Verify apps on a device or simulator through screenshots and UI interaction |
| [modernize-tests](xcode-skills/modernize-tests) | Modernize XCTest and Swift Testing suites |
| [swiftui-specialist](xcode-skills/swiftui-specialist) | Apply Apple's SwiftUI best practices |
| [swiftui-whats-new-27](xcode-skills/swiftui-whats-new-27) | Use SwiftUI APIs and migration guidance for SDK 27 |
| [uikit-app-modernization](xcode-skills/uikit-app-modernization) | Modernize UIKit apps for multi-window environments |

Install the collection through its native plugin identity:

```bash
# Codex
codex plugin add xcode-skills@tartinerlabs

# Claude Code
claude plugin install xcode-skills@tartinerlabs

# Direct installer
pnpm dlx skills add https://github.com/tartinerlabs/skills/tree/main/xcode-skills
```

In Codex and Claude Code, skills use the `xcode-skills:<skill-name>` namespace. In Cursor, install `xcode-skills` from the `tartinerlabs` marketplace.

The guidance can be read by any compatible agent, but some workflows expect Xcode's agent runtime, including Xcode project tools, device interaction, or subagent support. Those workflows require Xcode or equivalent runtime capabilities.

## Agents

Agents invoke skills autonomously with an isolated worktree. Invoke with `claude agent run <name>`.

| Agent | Description |
|-------|-------------|
| [deps](agents/deps.md) | Autonomous supply chain hardening — runs the deps skill in an isolated worktree and outputs a structured summary |

## Installation

### [Claude Code Plugin](https://docs.anthropic.com/en/docs/claude-code/plugins)

```bash
claude plugin install tartinerlabs/skills
```

### Codex Plugin

This repository includes repo-scoped Codex plugin metadata in `plugins/tartinerlabs/.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`.

To use it in Codex:

1. Open this repository in Codex
2. Restart Codex if needed so it reloads the repo marketplace
3. Open the plugin directory and install `tartinerlabs` from the repo marketplace

### Cursor Plugin

This repository includes Cursor plugin metadata in `plugins/tartinerlabs/.cursor-plugin/plugin.json` and `.cursor-plugin/marketplace.json`.

For local development, install the plugin with Cursor's plugin flow or copy the repository into Cursor's local plugin directory:

```bash
mkdir -p ~/.cursor/plugins/local
ln -s "$(pwd)" ~/.cursor/plugins/local/tartinerlabs
```

The shared `skills/` directory is exposed to Cursor directly. Claude-specific hooks are intentionally not declared in the Cursor manifest.

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
pnpm dlx skills add tartinerlabs/skills/github-issues

# Security-focused subset
pnpm dlx skills add tartinerlabs/skills/security
pnpm dlx skills add tartinerlabs/skills/commit
pnpm dlx skills add tartinerlabs/skills/setup
```

### [Context7](https://context7.com)

```bash
pnpm dlx ctx7 skills install /tartinerlabs/skills --all --universal
```

### [OpenCode](https://opencode.ai)

> **Note:** The OpenCode plugin is currently in Beta and might not work.

Add to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@tartinerlabs/skills"]
}
```

## Plugin Metadata

Plugin manifests are maintained manually on purpose.

Each plugin lives in its own `plugins/<name>/` wrapper holding the three per-channel manifests plus a `skills` symlink; both `plugins/tartinerlabs/` and `plugins/xcode-skills/` use this identical shape, and every marketplace references its plugins as `./plugins/<name>`.

- Codex metadata lives in `plugins/tartinerlabs/.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`
- Claude metadata lives in `plugins/tartinerlabs/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`
- Cursor metadata lives in `plugins/tartinerlabs/.cursor-plugin/plugin.json` and `.cursor-plugin/marketplace.json`
- The separate Xcode collection is wrapped by `plugins/xcode-skills/`, which links to the untouched `xcode-skills/` export
- `package.json.version` is the shared source of truth across plugin manifests; semantic-release syncs manifest versions during release

## Architecture

Skills use a modular rules pattern. Each skill directory contains:

```
skills/<name>/
  SKILL.md          # Skill definition with frontmatter
  rules/            # Independent, editable rule files
    some-rule.md    # Severity, examples, fix instructions

agents/<name>.md    # Optional Claude Code agents that invoke skills autonomously
```

This means you can:
- **Customise** a rule's severity or examples without forking the skill
- **Add** project-specific rules by dropping a new `.md` file in `rules/`
- **Remove** rules you disagree with

## Skill Format

Each skill is a directory with a `SKILL.md` file following the [Agent Skills spec](https://agentskills.io).

## License

Tartiner Labs-authored content is licensed under the [MIT License](LICENSE). The `xcode-skills/` collection contains Apple-authored material exported from Xcode and is published with attribution without modification.

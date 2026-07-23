# Skills

[![Release](https://img.shields.io/github/actions/workflow/status/tartinerlabs/skills/release.yml?style=for-the-badge&logo=github&label=release)](https://github.com/tartinerlabs/skills/actions/workflows/release.yml)
[![Skills](https://img.shields.io/github/actions/workflow/status/tartinerlabs/skills/skills.yml?style=for-the-badge&logo=github&label=skills)](https://github.com/tartinerlabs/skills/actions/workflows/skills.yml)
[![Version](https://img.shields.io/github/v/release/tartinerlabs/skills?style=for-the-badge)](https://github.com/tartinerlabs/skills/releases)
[![License](https://img.shields.io/github/license/tartinerlabs/skills?style=for-the-badge)](LICENSE)

Language-agnostic agent skills for git/GitHub workflows, code quality, and project tooling &mdash; with first-class JS/TS support. Each skill ships with modular, independently editable rules for deep, opinionated guidance.

## Why These Skills

- **Language-aware, JS/TS-first** &mdash; Skills detect the project's language and adapt. The general workflow/audit skills work in any language; the ecosystem tooling (`setup`, `deps`, `testing`) is polyglot &mdash; JS/TS is the best-supported path, with Python and Go covered via per-language `references/`.
- **Modular rules architecture** &mdash; Each skill ships with standalone rule files in `rules/` directories. Rules can be added, removed, or edited independently without touching the main skill logic.
- **Opinionated audit workflows** &mdash; Skills like `security`, `github-actions`, `tailwind`, and `refactor` produce structured severity-graded reports, then auto-fix issues.
- **Secret scanning built in** &mdash; The `commit`, `security`, and `setup` skills enforce secret detection as a first-class concern (GitLeaks by default, TruffleHog accepted).
- **Convention-aware** &mdash; Skills detect your project's existing conventions (language, commit format, package manager, project structure, git host) and adapt automatically.

## Skills

The skills ship as four themed collections, each installable as its own plugin (`workflow@tartinerlabs`, `quality@tartinerlabs`, `security@tartinerlabs`, `tooling@tartinerlabs`). Install the collections you need, then invoke skills through your agent's native skill or command interface — e.g. `/workflow:commit` in Claude Code.

### workflow

Git and GitHub workflow skills — commits, branches, pull requests, issues, and CI actions.

| Skill | Description |
|-------|-------------|
| [commit](skills/commit) | Clean git commits with conventional commit detection and secret scanning |
| [create-branch](skills/create-branch) | Create and checkout a branch with naming validation and GitHub/GitLab issue linking |
| [create-pr](skills/create-pr) | Push branch and create a pull/merge request (GitHub or GitLab) with structured description and auto-assignment |
| [github-actions](skills/github-actions) | Create and audit GitHub Actions workflows with SHA pinning, permissions, and caching checks |
| [github-issues](skills/github-issues) | Create, update, query, and comment on issues (GitHub, or GitLab via glab) |

### quality

Code quality skills — refactoring, naming conventions, project structure, and Tailwind CSS audits.

| Skill | Description |
|-------|-------------|
| [refactor](skills/refactor) | Audit and refactor code for dead code, deep nesting, and design patterns (language-agnostic; TS/JS idiom rules for TS/JS files) |
| [naming-format](skills/naming-format) | Audit and fix filename and export naming conventions for consistency |
| [project-structure](skills/project-structure) | Audit project directory structure for colocation, grouping, and anti-pattern detection |
| [tailwind](skills/tailwind) | Audit and fix Tailwind CSS v4 anti-patterns for spacing, 8px grid, mobile-first, and GPU animations |

### security

Security skills — OWASP audits, secret scanning, and dependency supply-chain hardening.

| Skill | Description |
|-------|-------------|
| [security](skills/security) | OWASP Top 10 security audit with secret detection and dependency vulnerability scanning |
| [deps](skills/deps) | Harden the dependency supply chain — detects the ecosystem (JS/TS, Python, Go) for pinning, vulnerability scanning, and CI gates |

### tooling

Project tooling skills — linting/formatting setup, testing, and documentation sync.

| Skill | Description |
|-------|-------------|
| [setup](skills/setup) | Set up the ecosystem's lint/format/git-hooks/secret-scanning toolchain — detects the language (JS/TS, Python, Go) |
| [testing](skills/testing) | Write and run unit/component tests — detects the language and test runner (JS/TS, Python, Go) |
| [update-project](skills/update-project) | Update and maintain CLAUDE.md, AGENTS.md, README.md, agents, skills, and rules to match current project state |

> **Migrating from the `tartinerlabs` plugin?** The original all-in-one `tartinerlabs` plugin is deprecated but still published for a transition period. Install the collection plugins above and uninstall the monolith when ready — the skills are identical, only the namespace changes (e.g. `/tartinerlabs:commit` → `/workflow:commit`).

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

Add the marketplace, then install the collections you need:

```bash
claude plugin marketplace add tartinerlabs/skills

claude plugin install workflow@tartinerlabs
claude plugin install quality@tartinerlabs
claude plugin install security@tartinerlabs
claude plugin install tooling@tartinerlabs
```

The deprecated all-in-one plugin remains installable as `tartinerlabs@tartinerlabs` during the transition period.

### Codex Plugin

This repository includes repo-scoped Codex plugin metadata in `plugins/<collection>/.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`.

To use it in Codex:

1. Open this repository in Codex
2. Restart Codex if needed so it reloads the repo marketplace
3. Open the plugin directory and install `workflow`, `quality`, `security`, and/or `tooling` from the repo marketplace

### Cursor Plugin

This repository includes Cursor plugin metadata in `plugins/<collection>/.cursor-plugin/plugin.json` and `.cursor-plugin/marketplace.json`.

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

> **Note:** The OpenCode plugin is paused — OpenCode's TypeScript plugin system differs too much from the manifest-based Claude Code/Codex/Cursor plugins to maintain alongside them. The plugin source stays in the repository, but no further versions of the `@tartinerlabs/skills` npm package will be published. OpenCode users can install the skills directly via [skills.sh](#skills), which copies them into OpenCode's skill discovery directories.

## Plugin Metadata

Plugin manifests are maintained manually on purpose.

Each plugin lives in its own `plugins/<name>/` wrapper holding the per-channel manifests plus a `skills` directory, and every marketplace references its plugins as `./plugins/<name>`. Two wrapper shapes exist:

- **Collection wrappers** (`plugins/workflow/`, `plugins/quality/`, `plugins/security/`, `plugins/tooling/`) expose a subset of the flat `skills/` source through per-skill symlinks (`skills/<skill>` → `../../../skills/<skill>`). `scripts/validate-skills.mjs` checks that every skill belongs to exactly one collection and that each wrapper exposes exactly its assigned skills.
- **Whole-directory wrappers** (`plugins/tartinerlabs/` — deprecated, and `plugins/xcode-skills/`) expose an entire source directory through a single `skills` symlink (`../../skills` and `../../xcode-skills` respectively).

Per-channel metadata for every plugin:

- Codex metadata lives in `plugins/<name>/.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`
- Claude metadata lives in `plugins/<name>/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`
- Cursor metadata lives in `plugins/<name>/.cursor-plugin/plugin.json` and `.cursor-plugin/marketplace.json`
- Antigravity metadata lives in `plugins/<name>/.antigravity-plugin/plugin.json`
- The separate Xcode collection is wrapped by `plugins/xcode-skills/`, which links to the untouched `xcode-skills/` export
- `.release-please-manifest.json` is the shared source of truth across plugin manifests; release-please syncs manifest versions in the release PR

## Architecture

Skills use a modular rules pattern, with per-language guides loaded on demand. Each skill directory contains:

```
skills/<name>/
  SKILL.md          # Skill definition with frontmatter; detects the language and routes
  rules/            # Independent, editable rule files (universal checks + the JS/TS path)
    some-rule.md    # Severity, examples, fix instructions
  references/       # Per-language guides, loaded only when that language is detected
    python.md       # e.g. the Python path for setup/deps/testing
    go.md           # e.g. the Go path

agents/<name>.md    # Optional Claude Code agents that invoke skills autonomously
```

For the polyglot skills (`setup`, `deps`, `testing`), SKILL.md detects the project's language from its manifest and loads **only** the matching guide — JS/TS lives in the first-class modular `rules/`, and other ecosystems live in `references/<lang>.md`, so a JS project never loads Go content.

This means you can:
- **Customise** a rule's severity or examples without forking the skill
- **Add** project-specific rules by dropping a new `.md` file in `rules/`, or a new language by adding `references/<lang>.md`
- **Remove** rules you disagree with

## Skill Format

Each skill is a directory with a `SKILL.md` file following the [Agent Skills spec](https://agentskills.io).

## License

Tartiner Labs-authored content is licensed under the [MIT License](LICENSE). The `xcode-skills/` collection contains Apple-authored material exported from Xcode and is published with attribution without modification.

# AGENTS.md

Canonical guidance for coding agents working in this repository. Claude Code additions live in `CLAUDE.md`; everything here applies to every agent.

## Project Overview

**Repository:** https://github.com/tartinerlabs/skills
**Package:** `@tartinerlabs/skills`

A collection of agent skills distributed via Claude Code, Codex, Cursor, Antigravity, OpenCode, and [skills.sh](https://skills.sh). Each skill is a markdown file with YAML frontmatter following the [Agent Skills spec](https://agentskills.io).

## Development

- **Tooling:** stdlib-only Go plus plain shell git hooks — the repo deliberately avoids npm dependencies to keep the supply-chain surface minimal
- **Git hooks:** plain shell hooks in `.githooks/` (enable with `git config core.hooksPath .githooks`) — `commit-msg` enforces conventional commits (no scope, max 50-char header), `pre-commit` runs GitLeaks secrets detection
- **Checks:** `go run ./scripts/validate-skills` and `go test ./...`
- **Releases:** Automated via release-please on push to `main` — maintains a release PR from conventional commits; merging it bumps versions, updates `CHANGELOG.md`, and creates the GitHub release

## Skill Format

Each skill lives in its collection plugin at `plugins/<collection>/skills/<name>/SKILL.md`:

```markdown
---
name: skill-name
description: What it does and when to use it
license: MIT
allowed-tools: Space-delimited list of permitted tools
model: sonnet
effort: medium
compatibility: What the skill really requires
metadata:
  short-description: Short display name for Codex
---

[Instructions the agent follows when the skill is active]
```

### Frontmatter Fields

Fields split into two groups. **Portable** fields (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`) come from the [Agent Skills spec](https://agentskills.io/specification) and are the only ones non-Claude channels can act on. **Claude-Code-only** fields (`model`, `effort`, `context`, `agent`) are ignored gracefully everywhere else. `go run ./scripts/validate-skills` enforces the portable group — every skill must carry `name`, `description`, `license`, `compatibility`, and `metadata.short-description`.

- `name` — Skill identifier. Must match the directory name
- `description` — Purpose and trigger conditions. This is the routing key agents match against, so it is written for retrieval rather than display
- `license` — SPDX identifier; `MIT` across the collection, matching the repo licence
- `compatibility` — The skill's real requirements (e.g. `Requires git`, `Any language project; detects the ecosystem`). Max 500 characters. Every skill carries one
- `metadata` — Spec-sanctioned extension point (arbitrary string map). We set `metadata.short-description`, a human-readable display string — the only field beyond `name`/`description` that Codex's skill loader parses, so it is what Codex surfaces in its UI instead of the retrieval-optimised `description`
- `allowed-tools` — Scoped tool permissions (e.g. `Bash(git status)` for specific commands, `Read` for full tool access). Spec-optional and marked experimental; Claude Code honours it, Cursor and Codex ignore it
- `model` — Model preference. Low/medium-effort skills default to `haiku` (cheaper, separate rate-limit bucket); high-effort skills that need deeper reasoning (forked subagents, complex audits) use `sonnet`
- `effort` — Reasoning effort level (`low`, `medium`, `high`, `max`). Overrides the session effort level while the skill is active
- `context: fork` + `agent` — Runs the skill as an isolated subagent with its own context window. Used by the high-effort audit skills (`refactor`, `security`, `github-actions`)

### Language-aware, JS/TS-first model

Every skill is **language-aware with JS/TS as the first-class default** — no skill assumes React or a single framework/host. Skills **detect, don't assume**: read the project's manifest (`package.json`/`pyproject.toml`/`go.mod`/…) as prose (never `!`-shell-injection, which is Claude-Code-only) and adapt. The general workflow/audit skills work in any language, gating framework-specific rules behind detection. The ecosystem tooling (`setup`, `deps`, `testing`) is polyglot. Secret scanning is abstracted: `commit`/`security`/`setup`/`deps` accept any scanner (GitLeaks default, TruffleHog accepted), not a hard-coded tool.

### Rules and References Pattern

Skills with multiple checks use a `rules/` subdirectory alongside `SKILL.md`, referenced from a table and read at runtime. Each rule file is standalone, with severity, examples, and fix instructions — so rules can be added, removed, or edited independently.

Polyglot skills add a `references/` subdirectory for **progressive disclosure**: SKILL.md detects the language and loads **only** the matching `references/<lang>.md`, so a JS project never loads Go content. The asymmetry is intentional — the first-class JS/TS path stays in modular `rules/`; other ecosystems live in `references/<lang>.md`; truly universal checks stay in `rules/` and are cross-linked from each language guide. `references/` is also the most portable component across distribution channels. The validator enforces the same existence + orphan discipline on both (template placeholders like `references/<lang>.md` are ignored).

### House style

Skills are lightweight guides, not procedures. State a preference and its reason, then license the exception — an absolute ban on a legitimate tool or utility will be wrong somewhere. `plugins/tooling/skills/setup/` is the reference for this: every rule file pairs `### Why This Matters` with `### Alternatives`, and the skill explicitly says you may decline any tool while a deliberately-configured alternative is kept, not swapped. Over-specify only where the cost of being wrong is high — `plugins/workflow/skills/commit/`'s refusal to commit when a secret scanner reports a leak is the one place hard `STOP` language is correct.

## Distribution

The skills ship as four themed **collection plugins** — `workflow`, `quality`, `security`, and `tooling`. The original all-in-one `tartinerlabs` plugin has been removed. The `collections` table in `scripts/validate-skills/main.go` is the source of truth for membership — every skill must belong to exactly one collection (validated in CI).

Six channels: Claude Code, Codex, Cursor, and Antigravity plugins (each reading `plugins/<collection>/.<channel>-plugin/plugin.json`), an OpenCode v2 plugin per collection (`plugins/<collection>/opencode.js`, installed from git), plus [skills.sh](https://skills.sh), which discovers the skills through the marketplace manifests. **Claude Code takes precedence** — a change that helps another channel must not regress Claude Code; install-test it there first. `README.md` has the install commands. The `Skills` CI workflow validates skills.sh distribution on push to `main`. Context7 was also a channel until `ctx7 skills install` was deprecated upstream with no successor; Context7 remains a documentation source, not a distribution target.

## Plugins

Plugin metadata is hand-maintained by design — there is no generator. Each collection plugin follows the [Agent Plugins spec](https://agent-plugins.org): a root `plugin.json` plus the real skill directories under `skills/`, with the four per-channel manifests kept alongside as client adapters. Client-specific components such as the `deps` agent (`plugins/security/agents/`) live in the plugin too.

- **No symlinks inside a collection plugin.** Codex copies a plugin into its cache and silently skips symlinks, and the spec has clients reject any path resolving outside the plugin root. The validator fails on any symlink under a collection plugin
- The root `plugin.json` targets Agent Plugins **1.0.0** — the only version Codex accepts; a client rejects a version it does not support. Its schema is closed (`$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`), and Codex refuses to install the plugin if it does not validate. Bump the version only once Codex supports the newer one
- `xcode-skills` is the one exception: a wrapper exposing the untouched export through a single `skills` dir symlink, whose target the validator checks
- Each marketplace references every plugin as `./plugins/<name>`. **Keep every plugin subdirectory-sourced** — the Claude Code loader silently drops a plugin sourced at the marketplace root (`source: "./"`) when another plugin exists
- **OpenCode** installs each collection with `opencode plugin add 'github:tartinerlabs/skills#main::path:plugins/<collection>'` — the ref is required; without one the install fails with an unknown git error. That git install packs the subdirectory like an npm package, so it needs the collection's `package.json` (private, no dependencies) and copies only real files. `opencode.js` is a plain `{ id, setup }` object with no imports beyond Node built-ins; it reads each `skills/<name>/SKILL.md` and registers it through `ctx.skill.transform`. Plugin IDs (`tartinerlabs.<collection>`) must stay unique — OpenCode refuses a duplicate. `docs/opencode-v2-plugins.md` has the tested behaviour
- `.release-please-manifest.json` is the canonical version source; release-please (`extra-files` in `release-please-config.json`) syncs the `plugins/**/plugin.json` and `plugins/<collection>/package.json` versions in the release PR. Never bump a version by hand
- When plugin copy changes, update every channel intentionally. Do not expose Claude-only hooks in Cursor or Codex metadata unless they have been ported to that runtime

## Xcode Skill Export

The root-level `xcode-skills/` directory is generated exclusively by `xcrun agent skills export`, and holds Apple-authored skills unrelated to the collection plugins. After an export, do not edit, add, remove, rename, move, reformat, or manually clean up anything inside it. Future exports must write directly to the same path and remain untouched afterward.

All plugin metadata for this collection belongs in `plugins/xcode-skills/`, whose `skills` symlink points to `../../xcode-skills`. Wrapper metadata and documentation may change; the exported directory may not.

## Conventions

- **Commit type for skill content:** skill markdown (`plugins/*/skills/**/*.md`) is the product, not documentation. Changes to skill behaviour use `feat`/`fix`/`refactor` — never `docs`. Reserve `docs:` for `README.md`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, and similar meta-documentation
- Commit subjects are max 50 characters with no scope, enforced by `.githooks/commit-msg`
- PR and issue titles use natural language, NOT conventional commit prefixes
- GitHub-related skills auto-assign to the current user via `@me` or `get_me`
- Skills can use both CLI tools (`gh`, `git`) and MCP tools (`mcp__github__*`) depending on the operation
- Use `pnpm dlx` in documentation, not `pnx` — readers do not share this repo's tooling, and the repo has no root `package.json` (the per-collection ones exist only for OpenCode's git install)
- Grant the minimum `allowed-tools` a skill needs; prefer specific commands (`Bash(git status)`) over blanket tool access

# AGENTS.md

Canonical guidance for coding agents working in this repository. Claude Code additions live in `CLAUDE.md`; everything here applies to every agent.

## Project Overview

**Repository:** https://github.com/tartinerlabs/skills
**Package:** `@tartinerlabs/skills`

A collection of agent skills distributed via Claude Code, Codex, Cursor, Antigravity, and [skills.sh](https://skills.sh). Each skill is a markdown file with YAML frontmatter following the [Agent Skills spec](https://agentskills.io).

## Development

- **Tooling:** stdlib-only Go plus plain shell git hooks — the repo deliberately avoids npm dependencies to keep the supply-chain surface minimal
- **Git hooks:** plain shell hooks in `.githooks/` (enable with `git config core.hooksPath .githooks`) — `commit-msg` enforces conventional commits (no scope, max 50-char header), `pre-commit` runs GitLeaks secrets detection
- **Checks:** `go run ./scripts/validate-skills` and `go test ./...`
- **Releases:** Automated via release-please on push to `main` — maintains a release PR from conventional commits; merging it bumps versions, updates `CHANGELOG.md`, and creates the GitHub release

## Skill Format

Each collection skill lives in `plugins/<collection>/skills/<name>/SKILL.md`. The flat `skills/<name>` path is an inbound symlink so skills.sh and whole-directory wrappers keep working:

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

Skills are lightweight guides, not procedures. State a preference and its reason, then license the exception — an absolute ban on a legitimate tool or utility will be wrong somewhere. `skills/setup/` is the reference for this: every rule file pairs `### Why This Matters` with `### Alternatives`, and the skill explicitly says you may decline any tool while a deliberately-configured alternative is kept, not swapped. Over-specify only where the cost of being wrong is high — `skills/commit/`'s refusal to commit when a secret scanner reports a leak is the one place hard `STOP` language is correct.

## Distribution

The skills ship as four themed **collection plugins** — `workflow`, `quality`, `security`, and `tooling`. The original all-in-one `tartinerlabs` plugin is **deprecated** but still published for a transition period; its removal is a future release. The `collections` table in `scripts/validate-skills/main.go` is the source of truth for membership — every skill must belong to exactly one collection (validated in CI).

Cursor and Codex load the portable [Agent Plugins](https://agent-plugins.org) 1.0.0 floor at `plugins/<name>/plugin.json` (Codex UI copy lives in `extensions.com.openai`). Claude Code and Antigravity keep their channel manifests at `plugins/<name>/.claude-plugin/plugin.json` and `plugins/<name>/.antigravity-plugin/plugin.json`. Cursor marketplace listing still uses `.cursor-plugin/plugin.json`. [skills.sh](https://skills.sh) installs from the inbound `skills/<name>` symlinks. `README.md` has the install commands. The `Skills` CI workflow validates skills.sh distribution on push to `main`. Context7 was a sixth channel until `ctx7 skills install` was deprecated upstream with no successor; Context7 remains a documentation source, not a distribution target.

## Plugins

Plugin metadata is hand-maintained by design — there is no generator. Every plugin lives in `plugins/<name>/` with a root Agent Plugins `plugin.json` for Cursor and Codex, plus Claude Code and Antigravity channel overlays. Cursor keeps `.cursor-plugin/` for marketplace listing.

Two wrapper shapes exist:

- **collection wrappers** (`workflow`, `quality`, `security`, `tooling`) own the real skill trees at `plugins/<collection>/skills/<skill>/`. The flat `skills/<skill>` path is an inbound symlink into that tree, which is Agent Plugins containment-conformant.
- **whole-directory wrappers** (`tartinerlabs`, `xcode-skills`) keep a `skills` symlink that escapes the plugin root (`../../skills` and `../../xcode-skills`). They remain non-conformant for Agent Plugins containment. The validator checks every symlink target.

- Each marketplace references every plugin as `./plugins/<name>`. **Keep every plugin subdirectory-sourced** — the Claude Code loader silently drops a plugin sourced at the marketplace root (`source: "./"`) when another plugin exists
- `.release-please-manifest.json` is the canonical version source; release-please (`extra-files` in `release-please-config.json`) syncs the `plugins/**/plugin.json` versions in the release PR. Never bump a version by hand
- When plugin copy changes, update the root Agent Plugins manifest and the Claude/Cursor/Antigravity overlays intentionally. Codex UI copy lives in `extensions.com.openai.interface` on the root manifest. Do not expose Claude-only hooks in Cursor or Codex metadata unless they have been ported to that runtime

## Xcode Skill Export

The root-level `xcode-skills/` directory is generated exclusively by `xcrun agent skills export`, and holds Apple-authored skills unrelated to `skills/`. After an export, do not edit, add, remove, rename, move, reformat, or manually clean up anything inside it. Future exports must write directly to the same path and remain untouched afterward.

All plugin metadata for this collection belongs in `plugins/xcode-skills/`, whose `skills` symlink points to `../../xcode-skills`. Wrapper metadata and documentation may change; the exported directory may not.

## Conventions

- **Commit type for skill content:** skill markdown (`plugins/*/skills/**/*.md`, plus the inbound `skills/**/*.md` aliases) is the product, not documentation. Changes to skill behaviour use `feat`/`fix`/`refactor` — never `docs`. Reserve `docs:` for `README.md`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, and similar meta-documentation
- Commit subjects are max 50 characters with no scope, enforced by `.githooks/commit-msg`
- PR and issue titles use natural language, NOT conventional commit prefixes
- GitHub-related skills auto-assign to the current user via `@me` or `get_me`
- Skills can use both CLI tools (`gh`, `git`) and MCP tools (`mcp__github__*`) depending on the operation
- Use `pnpm dlx` in documentation, not `pnx` — readers do not share this repo's tooling, and the repo has no `package.json` of its own
- Grant the minimum `allowed-tools` a skill needs; prefer specific commands (`Bash(git status)`) over blanket tool access

---
title: Agents, Skills, and Rules Maintenance
impact: MEDIUM
tags: agents, skills, rules, components, documentation
---

Covers the structured component files under `.claude/` (Claude Code) and `.agents/` (cross-agent convention). Each has a format the host parses, so preserve the field set the target agent expects rather than forcing one shape.

## Agents — `.claude/agents/*.md`, `.agents/agents/*.md`

**Rule**: Keep agent definitions reflecting actual project state. YAML frontmatter plus a markdown body that serves as the agent's system prompt; Claude Code reads `name`, `description`, `tools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`.

Scan the body for stale file paths, commands, and conventions; check `tools`/`disallowedTools` against what the agent actually needs; verify skills listed in `skills` still exist. Update `model` when the agent's complexity no longer matches it.

Treat `permissionMode: bypassPermissions` as requiring explicit justification — never add it as a convenience. Changing an agent's `name` or `description` changes how it is selected, so understand its role first.

## Skills — `.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`

**Rule**: Keep project-scoped skills reflecting actual project state. Frontmatter (`name`, `description`, `allowed-tools`, `model`, `context`, `agent`, `user-invocable`, `disable-model-invocation`, `argument-hint`, `hooks`) plus a body; may include a `rules/` subdirectory.

`description` is the activation trigger, not display text — verify it matches what the skill actually does, and refresh its trigger phrases when scope changes. Check `allowed-tools` against what the instructions actually require. Fix stale commands and paths. Remove rule files no longer referenced by `SKILL.md`, since an unreferenced rule file never loads.

A skill's `name` is its invocation identifier (`/skill-name`) — renaming it breaks every existing invocation.

## Rules — `.claude/rules/*.md`, `.agents/rules/*.md`

**Rule**: Keep rule files matching actual project conventions. Optional frontmatter with a `paths` field (glob patterns scoping when the rule applies) plus markdown content; rules without `paths` apply unconditionally. Rules may live in subdirectories and may be symlinked.

Verify `paths` globs still reference directories that exist. Update conventions that have evolved and tool references whose versions or names changed. Consolidate or split rules when the project structure has shifted significantly.

Two constraints: do not fold rules into the agent instruction file — they exist precisely for modular, path-targeted enforcement — and do not break symlinked rules, which are often shared across several projects. Confirm a convention is genuinely abandoned before deleting the rule that enforces it, and treat weakening a security or quality rule as needing explicit justification.

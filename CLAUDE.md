# CLAUDE.md

`AGENTS.md` is the canonical guidance for this repository and applies here too — read it first.

Claude-Code-specific notes:

- `model`, `effort`, `context: fork`, and `agent` in skill frontmatter are Claude-Code-only. Other channels ignore them gracefully; `compatibility` is the portable way to state a skill's requirements
- Skill bodies must not use `!`-shell-injection to read project state — it is a Claude Code feature and ships as literal text everywhere else. Read manifests as prose instead
- Once a collection plugin is installed, its skills are invoked as `/<collection>:<skill>` — e.g. `/workflow:commit`, `/quality:refactor`

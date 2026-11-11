# quality

Code quality skills — refactoring, naming conventions, project structure, and internationalisation.

One of the five [Tartiner Labs skill collections](../../README.md). Once the plugin is installed, invoke a skill through your agent's skill or command interface, for example `/quality:refactor` in Claude Code.

## Skills

| Skill | Description |
|-------|-------------|
| [refactor](skills/refactor) | Audit and refactor code for dead code, deep nesting, and design patterns (language-agnostic; TS/JS idiom rules for TS/JS files) |
| [naming-format](skills/naming-format) | Audit and fix filename and export naming conventions for consistency |
| [project-structure](skills/project-structure) | Audit project directory structure for colocation, grouping, and anti-pattern detection |
| [i18n](skills/i18n) | Prepare apps for translation — string catalogs, locale-aware dates, numbers, and units, time zones, and RTL-ready layout (JS/TS, Apple, Android) |

## Installation

**Claude Code**

```bash
claude plugin marketplace add tartinerlabs/skills
claude plugin install quality@tartinerlabs
```

**Codex and Cursor:** open this repository in the app and install `quality` from the repo marketplace.

**OpenCode** (v2):

```bash
opencode plugin add 'github:tartinerlabs/skills#main::path:plugins/quality'
```

**skills.sh**, one skill at a time:

```bash
pnpm dlx skills add tartinerlabs/skills/refactor
```

The [root README](../../README.md#installation) has the details for every channel.

## License

MIT

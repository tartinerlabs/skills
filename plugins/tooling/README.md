# tooling

Project tooling skills — linting/formatting setup, testing, and documentation sync.

One of the five [Tartiner Labs skill collections](../../README.md). Once the plugin is installed, invoke a skill through your agent's skill or command interface, for example `/tooling:setup` in Claude Code.

## Skills

| Skill | Description |
|-------|-------------|
| [setup](skills/setup) | Set up the ecosystem's lint/format/git-hooks/secret-scanning toolchain — detects the language (JS/TS, Python, Go) |
| [testing](skills/testing) | Write and run unit/component tests — detects the language and test runner (JS/TS, Python, Go) |
| [update-project](skills/update-project) | Update and maintain AGENTS.md, README.md, agents, skills, and rules to match current project state |

## Installation

**Claude Code**

```bash
claude plugin marketplace add tartinerlabs/skills
claude plugin install tooling@tartinerlabs
```

**Codex and Cursor:** open this repository in the app and install `tooling` from the repo marketplace.

**OpenCode** (v2):

```bash
opencode plugin add 'github:tartinerlabs/skills#main::path:plugins/tooling'
```

**skills.sh**, one skill at a time:

```bash
pnpm dlx skills add tartinerlabs/skills/setup
```

The [root README](../../README.md#installation) has the details for every channel.

## License

MIT

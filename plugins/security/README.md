# security

Security skills — OWASP audits, secret scanning, and dependency supply-chain hardening.

One of the five [Tartiner Labs skill collections](../../README.md). Once the plugin is installed, invoke a skill through your agent's skill or command interface, for example `/security:security` in Claude Code.

## Skills

| Skill | Description |
|-------|-------------|
| [security](skills/security) | OWASP Top 10 security audit with secret detection and dependency vulnerability scanning |
| [deps](skills/deps) | Harden the dependency supply chain — detects the ecosystem (JS/TS, Python, Go) for pinning, vulnerability scanning, and CI gates |

## Agents

Claude Code only.

| Agent | Description |
|-------|-------------|
| [deps](agents/deps.md) | Autonomous supply-chain hardening: runs the `deps` skill in an isolated worktree and returns a structured summary |

## Installation

**Claude Code**

```bash
claude plugin marketplace add tartinerlabs/skills
claude plugin install security@tartinerlabs
```

**Codex and Cursor:** open this repository in the app and install `security` from the repo marketplace.

**OpenCode** (v2):

```bash
opencode plugin add 'github:tartinerlabs/skills#main::path:plugins/security'
```

**skills.sh**, one skill at a time:

```bash
pnpm dlx skills add tartinerlabs/skills/security
```

The [root README](../../README.md#installation) has the details for every channel.

## License

MIT

# workflow

Git and GitHub workflow skills — commits, branches, pull requests, issues, and CI actions.

One of the five [Tartiner Labs skill collections](../../README.md). Once the plugin is installed, invoke a skill through your agent's skill or command interface, for example `/workflow:clean-branches` in Claude Code.

## Skills

| Skill | Description |
|-------|-------------|
| [clean-branches](skills/clean-branches) | Delete local branches that already landed, including squash-merged PRs missed by `git branch --delete-merged` |
| [commit](skills/commit) | Clean git commits with conventional commit detection and secret scanning |
| [create-branch](skills/create-branch) | Create and checkout a branch with naming validation and GitHub/GitLab issue linking |
| [create-pr](skills/create-pr) | Push branch and create a pull/merge request (GitHub or GitLab) with structured description and auto-assignment |
| [github-actions](skills/github-actions) | Create and audit GitHub Actions workflows with SHA pinning, permissions, and caching checks |
| [github-issues](skills/github-issues) | Create, update, query, and comment on issues (GitHub, or GitLab via glab) |

## Installation

**Claude Code**

```bash
claude plugin marketplace add tartinerlabs/skills
claude plugin install workflow@tartinerlabs
```

**Codex and Cursor:** open this repository in the app and install `workflow` from the repo marketplace.

**OpenCode** (v2):

```bash
opencode plugin add 'github:tartinerlabs/skills#main::path:plugins/workflow'
```

**skills.sh**, one skill at a time:

```bash
pnpm dlx skills add tartinerlabs/skills/clean-branches
```

The [root README](../../README.md#installation) has the details for every channel.

## License

MIT

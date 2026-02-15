# 1.0.0 (2026-02-15)

Initial release of `@tartinerlabs/skills` — a collection of Claude Code skills distributed via [skills.sh](https://skills.sh).

### Skills

12 skills shipping in this release:

* **commit** — Smart git commits with concise messages and GitLeaks pre-commit checks
* **create-branch** — Git branch creation with GitHub issue integration and smart naming
* **create-issue** — GitHub issue creation with auto-assignment
* **create-pr** — Push and create GitHub pull requests with auto-assignment
* **folder-org** — Project code structure and file organisation guidance
* **refactor** — Code refactoring with design and TypeScript-specific rules
* **security** — Security audits with GitLeaks setup and OWASP Top 10 checks
* **setup** — Project tooling setup (Biome, commitlint, Husky, lint-staged, semantic-release, TypeScript)
* **sync-docs** — CLAUDE.md and README.md documentation maintenance
* **tailwind** — Tailwind CSS audit and anti-pattern fixes (spacing, 8px grid, animations)
* **update-issue** — GitHub issue updates with title and template rules
* **workflows** — GitHub Actions workflow creation with pinning, caching, and permissions rules

### Architecture

* Modular rules system — each skill uses standalone rule files in `rules/` directories
* Skills follow the [Agent Skills spec](https://agentskills.io) with YAML frontmatter

### Infrastructure

* Automated releases via semantic-release ([3386cf0](https://github.com/tartinerlabs/skills/commit/3386cf027a3e1e1e06e10b0a6f6ec8b2e7d0edca))
* Skills installation workflow for GitHub Actions ([e4659bc](https://github.com/tartinerlabs/skills/commit/e4659bc3d5eda7ec26fe8c85e112e2e5e96a1c5d))
* Conventional commits enforced with commitlint and Husky ([7edf619](https://github.com/tartinerlabs/skills/commit/7edf6199c41e35f3b9f9b8f7d9e6f3f741ae9d5c))
* GitLeaks pre-commit secret detection

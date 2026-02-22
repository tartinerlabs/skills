## [1.4.7](https://github.com/tartinerlabs/skills/compare/v1.4.6...v1.4.7) (2026-02-22)


### Bug Fixes

* front-load triggers in skill descriptions ([2bc2e20](https://github.com/tartinerlabs/skills/commit/2bc2e20c273dd048f280059b8707ad5867b3ff3e))

## [1.4.6](https://github.com/tartinerlabs/skills/compare/v1.4.5...v1.4.6) (2026-02-22)


### Bug Fixes

* clarify git pull workflow in commit skill ([1cc729b](https://github.com/tartinerlabs/skills/commit/1cc729b21062b4e1686db846adba37c369cebce1))

## [1.4.5](https://github.com/tartinerlabs/skills/compare/v1.4.4...v1.4.5) (2026-02-22)


### Bug Fixes

* add Read to allowed-tools for skills with rules ([4485bd7](https://github.com/tartinerlabs/skills/commit/4485bd75835b3b49159297ec9612d33e2a31aaab))

## [1.4.4](https://github.com/tartinerlabs/skills/compare/v1.4.3...v1.4.4) (2026-02-22)


### Bug Fixes

* prohibit heading sections in create-pr body ([5c8484b](https://github.com/tartinerlabs/skills/commit/5c8484b72352fd482b4d4260c4472d9c5cbc21a5))

## [1.4.3](https://github.com/tartinerlabs/skills/compare/v1.4.2...v1.4.3) (2026-02-21)


### Bug Fixes

* prohibit checklists in github-issues body ([2e0aa42](https://github.com/tartinerlabs/skills/commit/2e0aa42827020aaeea8f2f07710e135e50b35ad7))

## [1.4.2](https://github.com/tartinerlabs/skills/compare/v1.4.1...v1.4.2) (2026-02-19)


### Bug Fixes

* disallow commit scopes in this repo ([8a937ab](https://github.com/tartinerlabs/skills/commit/8a937abe2ca519d70bfc258db79ad48787f81983))

## [1.4.1](https://github.com/tartinerlabs/skills/compare/v1.4.0...v1.4.1) (2026-02-19)


### Bug Fixes

* scope Bash permissions to reduce Gen risk ([3da548a](https://github.com/tartinerlabs/skills/commit/3da548a0259d7a63215cc547362b391925bf14bc))

# [1.4.0](https://github.com/tartinerlabs/skills/compare/v1.3.0...v1.4.0) (2026-02-17)


### Bug Fixes

* **commit:** stash changes before git pull --rebase ([2f7bc6d](https://github.com/tartinerlabs/skills/commit/2f7bc6d7acedfc52eab11dd8475fff35f1c2dd9c))


### Features

* **commit:** align rules with industry best practices ([5478d30](https://github.com/tartinerlabs/skills/commit/5478d3065864eed284d606b80f6f164420423e1f))

# [1.3.0](https://github.com/tartinerlabs/skills/compare/v1.2.0...v1.3.0) (2026-02-15)


### Features

* add testing skill ([addb3e2](https://github.com/tartinerlabs/skills/commit/addb3e223351bf1a7c0461ea4e4421d18f12a5b0))

# [1.2.0](https://github.com/tartinerlabs/skills/compare/v1.1.0...v1.2.0) (2026-02-15)


### Features

* add naming-format skill ([d4a7e80](https://github.com/tartinerlabs/skills/commit/d4a7e80c2d2ff7a8c160d7df6fc9581a594144a9))

# [1.1.0](https://github.com/tartinerlabs/skills/compare/v1.0.3...v1.1.0) (2026-02-15)


### Features

* enrich skill descriptions with actual features ([003c1c9](https://github.com/tartinerlabs/skills/commit/003c1c924dc36488ea7f918ac06e56e10cf5604a)), closes [#4](https://github.com/tartinerlabs/skills/issues/4)

## [1.0.3](https://github.com/tartinerlabs/skills/compare/v1.0.2...v1.0.3) (2026-02-15)


### Bug Fixes

* correct package.json metadata ([4947bdd](https://github.com/tartinerlabs/skills/commit/4947bddfd930cd2fc9b55d81dade9951a677e4ef))

## [1.0.2](https://github.com/tartinerlabs/skills/compare/v1.0.1...v1.0.2) (2026-02-15)


### Bug Fixes

* detect commitlint for message format ([b6aecf4](https://github.com/tartinerlabs/skills/commit/b6aecf4a2a3b7c92561e17e5cbc9ddd59893a8ae))

## [1.0.1](https://github.com/tartinerlabs/skills/compare/v1.0.0...v1.0.1) (2026-02-15)


### Bug Fixes

* nest model under metadata in refactor skill ([c7103a1](https://github.com/tartinerlabs/skills/commit/c7103a123b2021936308101019c52a7ed71f7ea5))

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

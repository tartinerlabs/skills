---
on:
  pull_request:
    paths:
      - skills/**
permissions:
  contents: read
  pull-requests: read
engine: copilot
timeout-minutes: 10
tools:
  github:
    toolsets: [repos, pull_requests]
safe-outputs:
  submit-pull-request-review:
    max: 1
---

# Skill Validation

Review the pull request changes that touch `skills/**` and submit exactly one
non-blocking pull request review comment.

## Scope

Validate only changed files whose path matches `skills/*/SKILL.md` in the
triggering pull request.

If the pull request changes files under `skills/**` but does not change any
`skills/*/SKILL.md` files, submit a short passing review comment explaining
that there were no changed skill files to validate.

## Checks

For each changed skill file:

1. Confirm the file starts with YAML frontmatter delimited by `---` and that the
   YAML parses successfully.
2. Confirm the frontmatter includes these required fields, each with a
   non-empty value: `name`, `description`, `allowed-tools`, `model`, `effort`.
3. Confirm `name` matches the skill directory name, for example
   `skills/commit/SKILL.md` must use `name: commit`.
4. Confirm the skill body after frontmatter is not empty.
5. Flag top-level format drift, including missing frontmatter, extra content
   before frontmatter, or missing body content after frontmatter.
6. Flag unscoped broad shell access in `allowed-tools`, such as plain `Bash` or
   broad wildcard forms like `Bash(*)`. Scoped commands such as
   `Bash(git:*)` are acceptable.
7. If a `rules/` directory exists beside the changed skill, check that every
   rule file is Markdown and that every Markdown rule file is referenced from
   the skill body by filename or relative path.
8. If the skill body references `rules/...` files, check that each referenced
   file exists.

## Review Comment

Submit one consolidated pull request review with event `COMMENT`.

Group findings by skill file. For each finding, include the file path, the
problem, and a concise fix suggestion. If there are no findings, submit a short
passing review comment.

Do not approve the pull request. Do not request changes. Do not push commits.
Do not create issues. Do not apply labels. Do not edit files.

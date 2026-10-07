# semantic-release

Automated versioning and publishing based on conventional commits.

**Opt-in only** — install when the user explicitly requests it (e.g., `/setup semantic-release`).

## Install

```bash
<pm> add -D semantic-release @semantic-release/changelog @semantic-release/git
```

## Config

Create `release.config.js`:

```js
export default {
  branches: ["main"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    ["@semantic-release/git", {
      assets: ["CHANGELOG.md", "package.json"],
      message: "chore(release): ${nextRelease.version}"
    }],
    "@semantic-release/github"
  ]
};
```

### Why This Matters

semantic-release removes human judgement from versioning: it reads the Conventional Commits since the last release, computes the correct semver bump, generates the changelog, tags, and publishes — all in CI. That is why it is paired with commitlint. It is opt-in because it only pays off for packages that publish releases on a cadence.

### Alternatives

Manual versioning (`npm version` + hand-written changelog) is fine for low-frequency releases. **Changesets** is the popular alternative for monorepos and libraries where you want an explicit, reviewable record of intended bumps rather than deriving them from commit messages. **release-please** (Google) is a PR-based alternative. Pick based on how much control over each release you want.

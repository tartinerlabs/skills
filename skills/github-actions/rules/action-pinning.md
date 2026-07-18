---
title: Action Pinning
impact: HIGH
tags: actions, pinning, sha, supply-chain
---

**Rule**: Pin all actions to prevent supply-chain attacks and ensure reproducible builds.

- Pin every action to a full 40-character commit SHA, including GitHub-owned `actions/*`
- Add the release version or source ref as a comment so automated and manual updates remain understandable

### Incorrect

```yaml
# Version tags are mutable, regardless of who owns the action
- uses: actions/checkout@v7
- uses: codecov/codecov-action@v4
- uses: JamesIves/github-pages-deploy-action@v4
```

### Correct

```yaml
# Every action uses a full commit SHA with a readable release comment
- uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0
- uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020  # v7.0.0
- uses: codecov/codecov-action@015f24e6818733317a2da2edd6290ab26238649a  # v5.0.7
- uses: JamesIves/github-pages-deploy-action@6c2d9db40f9296374acc17b90404b6e8864128c8  # v4.7.3
```

### How to Find the SHA

```bash
# Resolve a release tag, branch, or other ref to its commit SHA
gh api repos/{owner}/{repo}/commits/{ref} --jq '.sha'
```

### Why This Matters

Version tags are mutable — a malicious actor who gains access to any action repository can point an existing tag to a different commit containing malicious code. A full commit SHA is the only immutable action reference; resolving through the commits endpoint also returns the underlying commit for annotated tags.

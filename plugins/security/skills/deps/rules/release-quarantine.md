---
title: Release Quarantine
impact: MEDIUM
tags: minimum-release-age, quarantine, pnpm, supply-chain
---

**Rule**: Quarantine newly published packages by requiring a minimum age before installation.

### Configuration

For pnpm, add to `.npmrc`:

```ini
minimum-release-age=4320
```

The value is in **minutes**. 4320 minutes = 3 days.

For nub, the window is already on — the key is camelCase and takes a duration unit:

```ini
minimumReleaseAge=72h
```

### Package Manager Support

| Package Manager | Supported | Config |
|-----------------|-----------|--------|
| nub | Yes, on by default (24h) | `minimumReleaseAge` in `.npmrc` |
| pnpm | Yes | `minimum-release-age` in `.npmrc` |
| npm | No | Not available |
| yarn | No | Not available |
| bun | No | Not available |

**Skip this rule for projects on a manager without support.**

On nub the window is already active at 24 hours, so the rule's check passes without any config. Raise it only if the user wants a longer one.

### What It Does

Prevents installation of packages published less than 3 days ago. Only affects new installs and version bumps — packages already in the lockfile are unaffected.

### Why This Matters

Many supply chain attacks exploit a narrow window after publication:
- **Protestware** — maintainers publish destructive updates that get reverted quickly
- **Typosquatting** — malicious packages mimicking popular names are reported and removed within days
- **Account compromise** — hijacked maintainer accounts publish backdoors that are caught by the community

A 3-day quarantine gives the community time to detect and flag malicious releases before they reach your project.

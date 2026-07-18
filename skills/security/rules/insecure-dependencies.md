---
title: Insecure Dependencies
impact: MEDIUM
tags: dependencies, audit, npm, pnpm, yarn, bun, pip, go, vulnerabilities
---

**Rule**: Check for known vulnerabilities in project dependencies. Use the auditor for the project's ecosystem — detect the language from its manifest (`package.json` / `pyproject.toml` / `go.mod`) and run the matching tool. Auditing only npm on a Python or Go project silently misses CVEs.

### How to Audit

**JS/TS** (match the package manager):

```bash
npm audit        # or: pnpm audit / yarn audit / bun audit

# Check for outdated packages
npm outdated     # or: pnpm outdated / yarn outdated / bun outdated
```

**Python** — `pip-audit`:

```bash
pip-audit                       # audit the current environment
pip-audit -r requirements.txt   # audit a requirements file
```

**Go** — `govulncheck` (from golang.org/x/vuln):

```bash
govulncheck ./...   # reports only vulnerabilities reachable from your code
go list -m -u all   # show available module updates
```

### What to Check

- Packages with known CVEs (Critical and High severity)
- Severely outdated packages (multiple major versions behind)
- Packages that have been deprecated or abandoned

### Remediation

- Update vulnerable packages: `npm audit fix` / `pnpm audit --fix` or manual version bumps
- Replace abandoned packages with actively maintained alternatives
- Pin dependency versions to avoid unexpected updates

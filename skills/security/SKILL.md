---
name: security
description: Use when auditing security, checking for vulnerabilities, scanning for secrets, or reviewing dependencies. OWASP Top 10 audit with GitLeaks and dependency checks.
allowed-tools: Read Glob Grep Edit Bash(gitleaks:*) Bash(trufflehog:*) Bash(pnx:*) Bash(npm:*) Bash(pip-audit:*) Bash(govulncheck:*) Bash(go:*)
model: sonnet
effort: high
context: fork
agent: general-purpose
compatibility: Audit is language-agnostic (OWASP); the hardening setup wires a secret scanner (GitLeaks default) into a pre-commit hook — Husky + lint-staged is the JS/TS path
---

You are a security engineer running audits and setting up secret scanning.

Read individual rule files in `rules/` for detailed explanations and examples.

## Rules Overview

| Rule | Impact | File |
|------|--------|------|
| OWASP Top 10 | HIGH | `rules/owasp-top-10.md` |
| Hardcoded secrets | HIGH | `rules/hardcoded-secrets.md` |
| Auth & access control | HIGH | `rules/auth-access-control.md` |
| Insecure dependencies | MEDIUM | `rules/insecure-dependencies.md` |
| Data protection | MEDIUM | `rules/data-protection.md` |

## Mode Detection

Classify the request before acting, and default to read-only when intent is ambiguous or diagnostic:

- **Audit (read-only, default)** — "audit", "review", "check", "scan", "diagnose", or any unclear request. Produce an evidence-backed report and make NO file edits. Read-only scans (including `gitleaks git --redact`) are allowed; setting up hooks or editing code is not.
- **Fix** — the user explicitly asks to fix, set up, harden, apply, or says "audit and fix". Only then run the Secret-Scanner Setup and any remediation steps.

When intent is ambiguous, stay in Audit mode and end the report by offering to apply the fixes.

## Workflow

### Step 1: Code Security Audit

Scan the codebase against every rule in `rules/` — these checks are language-agnostic. Search for vulnerability patterns. In Audit mode, also check whether a secret scanner is wired into the pre-commit hook (e.g. does `.husky/pre-commit` exist and contain `gitleaks`?) and report it as a finding if missing — but do not modify any files.

### Step 2: Report

```
## Security Audit Results

### HIGH Severity
- `src/api/users.ts:23` - Unsanitised user input in SQL query

### MEDIUM Severity
- `package.json` - 3 packages with known vulnerabilities

### Summary
| Category | Findings |
|----------|----------|
| OWASP Top 10 | X |
| Hardcoded secrets | Y |
| **Total** | **Z** |
```

### Step 3: Retrospective History Scan (Optional)

Only when user passes `--scan-history`. This is a read-only scan, allowed in either mode:

```bash
gitleaks git --redact --verbose
```

### Step 4: Secret-Scanner Setup (fix mode only)

Skip this step entirely in Audit mode. Only run it when the request is in Fix mode (see Mode Detection).

Ensure a secret scanner runs in the project's pre-commit hook. GitLeaks is the default (TruffleHog accepted if the project already uses it):

1. Check if the pre-commit hook exists and already runs a scanner (e.g. `.husky/pre-commit` contains `gitleaks`)
2. If missing, wire the scanner into the ecosystem's pre-commit mechanism:
   - **JS/TS** — set up Husky and add `gitleaks git --staged --redact --verbose` before any `lint-staged` command
   - **Other languages** — add the same scanner command to that ecosystem's pre-commit tooling (e.g. a `pre-commit` hook for Python, or a plain `.git/hooks/pre-commit` otherwise)
3. If the hook uses the legacy `gitleaks protect` command (deprecated and non-redacting), rewrite it to `gitleaks git --staged --redact --verbose`

## Compatibility

The **audit** is language-agnostic — the OWASP, secret, auth, and data-protection rules apply to any codebase. The **hardening setup** (Fix mode) wires a secret scanner into a pre-commit hook: GitLeaks is the default (TruffleHog accepted), and the Husky + lint-staged wiring is the JS/TS path; other ecosystems use their own pre-commit mechanism.

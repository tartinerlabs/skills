---
name: security
description: Run security audit with GitLeaks pre-commit hook setup and code analysis
allowed-tools: Bash Read Write Edit Glob Grep
---

You are a security engineer setting up GitLeaks and running security audits.

## Workflow

### 1. Setup GitLeaks in Husky Pre-commit Hook

Check if GitLeaks is configured in the project's pre-commit hook. If not, set it up.

#### Detection Steps

1. Check if `.husky/` directory exists
2. Check if `.husky/pre-commit` contains `gitleaks`

#### Setup Steps (if GitLeaks is missing)

If `.husky/` does not exist:
```bash
npx husky init
```

Add GitLeaks to `.husky/pre-commit` BEFORE any lint-staged command:
```bash
gitleaks protect --staged --verbose
```

Example `.husky/pre-commit` with lint-staged:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Secrets detection - fail fast if secrets found
gitleaks protect --staged --verbose

# Lint staged files
npx lint-staged
```

If the pre-commit file already exists, insert the gitleaks line before `npx lint-staged`.

### 2. Code Security Audit

After ensuring GitLeaks is configured, perform a comprehensive security audit of the codebase:

#### What to Analyze

1. **OWASP Top 10 Vulnerabilities**
   - SQL injection (parameterized queries, ORM misuse)
   - XSS (unsanitized user input rendered in HTML/JSX)
   - Command injection (shell commands with user input)
   - Path traversal (user input in file paths)
   - SSRF (user-controlled URLs in server-side requests)

2. **Hardcoded Secrets & Credentials**
   - API keys, tokens, passwords in source code
   - Private keys or certificates committed to repo
   - Database connection strings with embedded credentials
   - `.env` files or config files with secrets not in `.gitignore`

3. **Authentication & Authorization**
   - Missing or weak authentication checks
   - Broken access control (missing authorization on endpoints)
   - Insecure session management
   - JWT misconfigurations (weak algorithms, missing expiry)

4. **Insecure Dependencies**
   - Run `npm audit` or `pnpm audit` to check for known vulnerabilities
   - Check for outdated packages with known CVEs

5. **Data Protection**
   - Sensitive data logged or exposed in error messages
   - Missing input validation at system boundaries
   - Insecure data storage or transmission

#### How to Audit

Use Grep and Glob to scan the codebase for common vulnerability patterns:
- Unsafe HTML rendering, raw innerHTML usage
- Hardcoded strings matching API key patterns, passwords, secrets, tokens
- Missing CSRF protection in form handlers
- Authentication middleware and route guard coverage
- `.gitignore` entries for sensitive files

### 3. Retrospective Git History Scan (Optional)

Only run this step if the user passes `--scan-history` argument. This is for legacy projects being onboarded to GitLeaks.

```bash
gitleaks detect --source . --verbose
```

Report any secrets found in git history with:
- File path and line number
- Commit where the secret was introduced
- Type of secret detected
- Remediation steps (rotate the secret, use git-filter-repo to remove from history)

## Output Format

1. **GitLeaks Setup Status**: Whether hooks were already configured or newly set up
2. **Security Audit Findings**: Vulnerabilities found, organized by severity
3. **History Scan Results** (if --scan-history): Any secrets found in git history

## Assumptions

- GitLeaks is already installed on the system (`brew install gitleaks` or equivalent)
- Target projects use Husky + lint-staged (JS/TS stack)

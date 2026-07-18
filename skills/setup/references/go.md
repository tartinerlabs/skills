# Go Project Setup

Toolchain setup for Go projects — the ecosystem equivalent of the JS/TS `rules/*.md`. Detect what's already configured and install only what's missing. GitLeaks (secret scanning) is cross-ecosystem and wired the same way as elsewhere; the rest is Go-specific.

## Detect Existing Tooling

Before installing anything, scan for existing config:

- `.golangci.yml` / `.golangci.yaml` / `.golangci.toml` → golangci-lint already configured
- `.pre-commit-config.yaml` → pre-commit framework already configured
- `gitleaks` in `.pre-commit-config.yaml` → secret scanning already wired
- `go.mod` present → module initialised (if missing, `go mod init <module-path>`)

**Skip tools that are already configured.** Report what was skipped at the end.

## Formatting — gofmt / goimports

Go ships canonical formatting; there is no style debate. Use `gofmt` (built in) or `goimports` (also manages imports):

```bash
go install golang.org/x/tools/cmd/goimports@latest
goimports -w .
gofmt -l .        # list files that need formatting
```

## golangci-lint — Linting

The de-facto aggregate linter for Go. Install:

```bash
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
```

Config in `.golangci.yml`:

```yaml
linters:
  enable:
    - errcheck
    - govet
    - staticcheck
    - ineffassign
    - unused
    - gosimple
run:
  timeout: 3m
```

Commands: `golangci-lint run` (lint), `golangci-lint run --fix`. Also run `go vet ./...` as a baseline.

## pre-commit — Git Hooks

Use the cross-language `pre-commit` framework (requires Python) or a plain `.git/hooks/pre-commit` script. `.pre-commit-config.yaml` — secret scanning first, then Go checks:

```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.21.2
    hooks:
      - id: gitleaks
  - repo: https://github.com/golangci/golangci-lint
    rev: v1.62.0
    hooks:
      - id: golangci-lint
  - repo: local
    hooks:
      - id: gofmt
        name: gofmt
        entry: gofmt -l -w
        language: system
        types: [go]
```

If the project has no Python (so no `pre-commit` framework), install the same checks as a plain `.git/hooks/pre-commit` shell script instead — run `gitleaks git --staged --redact --verbose` first, then `gofmt`/`golangci-lint`. GitLeaks stays the default secret scanner across ecosystems and must be installed on the system (`brew install gitleaks`).

## Output

Report installed vs skipped tools, then suggest: `golangci-lint run` to verify linting, and a test commit to verify hooks fire.

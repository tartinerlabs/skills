# Go Supply-Chain Hardening

Dependency supply-chain hardening for Go projects — the ecosystem equivalent of the JS/TS `rules/*.md`. Go's module system already provides exact versions and integrity hashes, so hardening focuses on verification and vulnerability scanning.

## Detect Existing Config

- `go.sum` present → module checksums already tracked (Go's built-in integrity layer)
- `govulncheck` in CI → vulnerability scanning present
- `renovate.json` / `.github/dependabot.yml` with `gomod` → automated updates present
- `.github/workflows/*.yml` with `dependency-review-action` → PR dependency review present

**Skip checks that already pass.** Report what was skipped at the end.

## 1. Versions & Integrity (built in)

Go modules are already exact-pinned in `go.mod` and hash-verified via `go.sum` — there are no version ranges to remove. Keep both files committed. Verify the local module cache matches the recorded hashes:

```bash
go mod verify        # confirms cached modules match go.sum
go mod tidy          # prune unused deps, add missing ones
```

For fully reproducible, network-isolated builds, vendor dependencies:

```bash
go mod vendor
go build -mod=vendor ./...
```

## 2. Vulnerability Scanning — govulncheck

The official Go vulnerability scanner. It reports only vulnerabilities in code paths you actually call, so signal is high:

```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...
```

Add it to CI so vulnerable dependencies fail the build.

## 3. Checksum Database (GONOSUMCHECK / GOFLAGS)

Go verifies modules against the public checksum database (`sum.golang.org`) by default. Do **not** disable it (`GONOSUMDB`/`GOFLAGS=-insecure`) except for private modules, which should be listed in `GOPRIVATE` instead:

```bash
go env -w GOPRIVATE=github.com/your-org/*
```

## 4. Automated Updates — Renovate / Dependabot

Both support Go modules (`gomod`). If Renovate already runs for another ecosystem it usually covers Go automatically. Otherwise add Dependabot:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: gomod
    directory: "/"
    schedule:
      interval: weekly
```

## 5. PR Dependency Review (CI)

`actions/dependency-review-action` works for Go via GitHub's dependency graph — same workflow as the JS/TS path. **GitHub-only**: on GitLab, use GitLab's built-in Dependency Scanning instead. See the JS/TS `rules/dependency-review.md` for the workflow template.

## Output

Report applied vs skipped measures, and any manual steps (e.g. "run `go mod tidy` and commit the updated `go.sum`").

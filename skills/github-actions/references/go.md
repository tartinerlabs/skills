# Go CI Workflow

CI template for Go projects — the Go equivalent of the JS/TS Node template in `SKILL.md`. Detected by `go.mod`. Pin actions per `rules/action-pinning.md` (GitHub-owned `actions/*` on version tags), and keep the `permissions` and `concurrency` blocks from the shared rules.

`actions/setup-go` is GitHub-owned, so a version tag is fine; it caches the module and build cache automatically when a `go.sum` is present.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: go.mod
      - run: go vet ./...
      - run: go build ./...
      - run: go test ./...
```

Notes:
- `go-version-file: go.mod` keeps the CI Go version in sync with the module's declared version — prefer it over a hard-coded `go-version`.
- Add `golangci-lint` as a step (via the third-party `golangci/golangci-lint-action`, pinned to a full commit SHA) if the project uses it.

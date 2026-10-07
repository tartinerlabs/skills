# Go CI Workflow

CI template for Go projects — the Go equivalent of the JS/TS Node template in `SKILL.md`. Detected by `go.mod`. Pin every action to a full commit SHA per `rules/action-pinning.md`, and keep the `permissions` and `concurrency` blocks from the shared rules.

`actions/setup-go` caches the module and build cache automatically when a `go.sum` is present. Resolve the intended action releases before writing the workflow; the concrete pins below are examples.

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
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0
      - uses: actions/setup-go@b7ad1dad31e06c5925ef5d2fc7ad053ef454303e  # v7.0.0
        with:
          go-version-file: go.mod
      - run: go vet ./...
      - run: go build ./...
      - run: go test ./...
```

Notes:
- `go-version-file: go.mod` keeps the CI Go version in sync with the module's declared version — prefer it over a hard-coded `go-version`.
- Add `golangci-lint` as a step (via `golangci/golangci-lint-action`, pinned to a full commit SHA with a version comment) if the project uses it.

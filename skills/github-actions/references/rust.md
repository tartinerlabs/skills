# Rust CI Workflow

CI template for Rust projects — the Rust equivalent of the JS/TS Node template in `SKILL.md`. Detected by `Cargo.toml`. Pin every action to a full commit SHA with a version or source-ref comment per `rules/action-pinning.md`. Keep the `permissions` and `concurrency` blocks from the shared rules.

Resolve the intended releases or source refs with `gh api repos/{owner}/{repo}/commits/{ref} --jq '.sha'` before writing the workflow; the concrete pins below are examples.

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
      - uses: dtolnay/rust-toolchain@4cda84d5c5c54efe2404f9d843567869ab1699d4  # stable
        with:
          components: rustfmt, clippy
      - run: cargo fmt --all --check
      - run: cargo clippy --all-targets -- -D warnings
      - run: cargo test --all
      - run: cargo build --release
```

Notes:
- Add `Swatinem/rust-cache` (pin to a full commit SHA with a version comment) to cache the `~/.cargo` and `target` directories across runs.
- `-D warnings` turns Clippy warnings into failures; drop it if the project is not yet warning-clean.

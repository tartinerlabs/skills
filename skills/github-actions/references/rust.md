# Rust CI Workflow

CI template for Rust projects — the Rust equivalent of the JS/TS Node template in `SKILL.md`. Detected by `Cargo.toml`. Pin actions per `rules/action-pinning.md`: `actions/checkout` is GitHub-owned (version tag), but `dtolnay/rust-toolchain` is **third-party** and must pin to a full commit SHA with a version comment. Keep the `permissions` and `concurrency` blocks from the shared rules.

Look up the current SHA with `gh api repos/dtolnay/rust-toolchain/git/ref/heads/stable --jq '.object.sha'` and update the comment — the SHA below is illustrative.

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
      - uses: dtolnay/rust-toolchain@4cda84d5c5c54efe2404f9d843567869ab1699d4  # stable
        with:
          components: rustfmt, clippy
      - run: cargo fmt --all --check
      - run: cargo clippy --all-targets -- -D warnings
      - run: cargo test --all
      - run: cargo build --release
```

Notes:
- Add `Swatinem/rust-cache` (third-party — pin to a full commit SHA) to cache the `~/.cargo` and `target` directories across runs.
- `-D warnings` turns Clippy warnings into failures; drop it if the project is not yet warning-clean.

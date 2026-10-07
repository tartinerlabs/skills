# Rust Project Setup

Toolchain setup for Rust projects — the ecosystem equivalent of the JS/TS `rules/*.md`. Detect what's already configured and install only what's missing. GitLeaks (secret scanning) is cross-ecosystem and wired the same way as elsewhere; the rest is Rust-specific. rustfmt and Clippy ship with the standard toolchain via `rustup` (add them with `rustup component add rustfmt clippy` if missing).

## Detect Existing Tooling

Before installing anything, scan for existing config:

- `rustfmt.toml` / `.rustfmt.toml` → rustfmt config present (formatting still works without it — these only override defaults)
- `clippy.toml` → Clippy config present
- `[lints]` table in `Cargo.toml` or `#![deny(...)]` crate attributes → lint policy already declared
- `.pre-commit-config.yaml` → pre-commit framework already configured
- `gitleaks` in `.pre-commit-config.yaml` → secret scanning already wired
- `Cargo.toml` present → crate initialised (if missing, `cargo init`)

**Skip tools that are already configured.** Report what was skipped at the end.

## Formatting — rustfmt

Rust ships canonical formatting; there is no style debate. `rustfmt` is part of the standard toolchain and is driven through Cargo:

```bash
cargo fmt              # format the whole workspace in place
cargo fmt --check      # list files that need formatting (use in CI/hooks)
```

> **Not an opinion.** Formatting is the one choice here with no alternative to document: `rustfmt` is the official formatter and its output is canonical. There is no competing formatter and no style config to bikeshed — a `rustfmt.toml` only tweaks defaults and is optional. Everything below (the linter) is where real choices exist.

## Clippy — Linting

The official Rust linter, and the de-facto standard. It runs as a Cargo subcommand and covers correctness, style, complexity, and performance lints:

```bash
cargo clippy --all-targets --all-features       # lint everything
cargo clippy --fix                              # apply machine-applicable fixes
cargo clippy --all-targets -- -D warnings       # fail on any warning (CI/hooks)
```

Prefer declaring lint policy in `Cargo.toml` so it applies to every invocation:

```toml
[lints.clippy]
all = "warn"
```

### Why This Matters

Clippy is maintained by the Rust project itself, ships through `rustup`, and bundles hundreds of lints behind one command — which is why nearly every Rust project and CI pipeline standardises on it. Treating its warnings as errors (`-D warnings`) is the common baseline for keeping a codebase clean.

### Alternatives

`cargo check` (built into Cargo) type-checks without the extra lints and is a faster inner-loop feedback tool, but it is not a linter — it complements Clippy rather than replacing it. The compiler's own lints (`#![deny(warnings)]`, `rustc` lint groups) cover the basics. If the project already has a linting setup, keep it; Clippy is the default because it is official and bundles the common set with the least configuration.

## pre-commit — Git Hooks

Use the cross-language `pre-commit` framework (requires Python) or a plain `.git/hooks/pre-commit` script. `.pre-commit-config.yaml` — secret scanning first, then Rust checks:

```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.21.2
    hooks:
      - id: gitleaks
  - repo: local
    hooks:
      - id: cargo-fmt
        name: cargo fmt
        entry: cargo fmt --check
        language: system
        types: [rust]
        pass_filenames: false
      - id: cargo-clippy
        name: cargo clippy
        entry: cargo clippy --all-targets -- -D warnings
        language: system
        types: [rust]
        pass_filenames: false
```

If the project has no Python (so no `pre-commit` framework), install the same checks as a plain `.git/hooks/pre-commit` shell script instead — run `gitleaks git --staged --redact --verbose` first, then `cargo fmt --check` / `cargo clippy`. GitLeaks is the default secret scanner across ecosystems (TruffleHog is an accepted alternative if the project already uses it — see `rules/secret-scanner.md`) and must be installed on the system (`brew install gitleaks`).

## Output

Report installed vs skipped tools, then suggest: `cargo clippy --all-targets -- -D warnings` to verify linting, and a test commit to verify hooks fire.

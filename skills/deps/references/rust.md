# Rust Supply-Chain Hardening

Dependency supply-chain hardening for Rust projects — the ecosystem equivalent of the JS/TS `rules/*.md`. Cargo already records exact versions and integrity hashes in `Cargo.lock`, so hardening focuses on committing the lockfile, vulnerability scanning, and policy enforcement.

## Detect Existing Config

- `Cargo.lock` present and committed → exact versions locked (Cargo's built-in integrity layer)
- `cargo audit` / `cargo deny` in CI → vulnerability scanning present
- `deny.toml` → cargo-deny policy already configured
- `renovate.json` / `.github/dependabot.yml` with `cargo` → automated updates present
- `.github/workflows/*.yml` with `dependency-review-action` → PR dependency review present

**Skip checks that already pass.** Report what was skipped at the end.

## 1. Versions & Integrity (built in)

Cargo records the exact resolved version and a checksum for every dependency in `Cargo.lock` — there are no ranges to remove from the lockfile (`Cargo.toml` keeps semver requirements by design). **Commit `Cargo.lock`** — for binaries and applications this is essential for reproducible builds; for libraries it is now also recommended. Verify and prune:

```bash
cargo update --locked     # verify the lockfile satisfies Cargo.toml without changing it
cargo verify-project      # sanity-check the manifest
```

For a fully reproducible, network-isolated build, vendor dependencies:

```bash
cargo vendor              # writes deps to vendor/ and prints the .cargo/config.toml to add
```

## 2. Vulnerability Scanning — cargo audit / cargo-deny

`cargo audit` checks `Cargo.lock` against the [RustSec Advisory Database](https://rustsec.org):

```bash
cargo install cargo-audit
cargo audit               # fail the build on any known-vulnerable dependency
```

Add it to CI so vulnerable dependencies fail the build.

### Alternatives

**cargo-deny** is the broader tool: alongside advisory scanning (`cargo deny check advisories`) it enforces license allow/deny policy, bans specific crates or duplicate versions, and restricts source registries — all from a single `deny.toml`. Use `cargo audit` for the focused vulnerability-only check; reach for `cargo-deny` when you also want license and source-policy gates. Many projects run both, or standardise on `cargo-deny` alone.

## 3. Source & Registry Policy

Cargo pulls from crates.io by default and verifies checksums against `Cargo.lock`. Keep it that way. For private crates, configure a named registry in `.cargo/config.toml` rather than disabling verification, and use `cargo-deny`'s `[sources]` table to allow-list permitted registries:

```toml
# deny.toml
[sources]
unknown-registry = "deny"
allow-registry = ["https://github.com/rust-lang/crates.io-index"]
```

## 4. Automated Updates — Renovate / Dependabot

Both support Cargo (`cargo`). If Renovate already runs for another ecosystem it usually covers Rust automatically. Otherwise add Dependabot:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: cargo
    directory: "/"
    schedule:
      interval: weekly
```

## 5. PR Dependency Review (CI)

`actions/dependency-review-action` works for Rust via GitHub's dependency graph (Cargo is supported) — same workflow as the JS/TS path. **GitHub-only**: on GitLab, use GitLab's built-in Dependency Scanning instead. See the JS/TS `rules/dependency-review.md` for the workflow template.

## Output

Report applied vs skipped measures, and any manual steps (e.g. "commit `Cargo.lock`" or "add `cargo audit` to CI").

# Python Supply-Chain Hardening

Dependency supply-chain hardening for Python projects — the ecosystem equivalent of the JS/TS `rules/*.md`. Detect what's already configured and apply only what's missing.

## Detect Existing Config

- `pip-audit` in CI or dev deps → vulnerability scanning present
- hashes in `requirements.txt` (`--hash=sha256:...`) or a `uv.lock`/`poetry.lock` → integrity pinning present
- pinned versions (`==`) rather than ranges (`>=`, `~=`) → already pinned
- `renovate.json` / `.github/dependabot.yml` → automated updates present
- `.github/workflows/*.{yml,yaml}` with `dependency-review-action` → PR dependency review present

**Skip checks that already pass.** Report what was skipped at the end.

## 1. Pin Exact Versions

Pin direct dependencies to exact versions so builds are reproducible and updates flow through reviewable PRs (the analogue of removing `^`/`~` in `package.json`). **Where** you pin depends on whether the project is an application or a published library — detect this first.

**App vs. library:**
- **Library** (published to PyPI / installed by others as a package — typically has a build backend under `[build-system]` and is `pip install`-able): keep **compatible bounds** in `pyproject.toml` `dependencies`, and pin exact versions only in the lockfile (`uv.lock` / `poetry.lock`) or a compiled `requirements.txt`. Exact `==` pins in library metadata force those versions on every consumer and cause resolver conflicts.
- **App / deployed service** (not published for others to install): pin exact versions directly in `pyproject.toml` for a fully reproducible environment.

Library metadata — keep bounds (`pyproject.toml`):

```toml
dependencies = ["requests>=2.31,<3", "pydantic~=2.5"]
```

App — pin exact (`pyproject.toml`):

```toml
dependencies = ["requests==2.31.0", "pydantic==2.5.3"]
```

For libraries (and pip-based apps), compile a fully pinned, hashed lockfile from the abstract requirements — this is where the exact pins live:

```bash
uv pip compile requirements.in -o requirements.txt --generate-hashes
# or: pip-compile --generate-hashes requirements.in
```

## 2. Hash-Pinned Installs

Hashes make installs tamper-evident — pip refuses a package whose artifact hash doesn't match. `uv`, Poetry, and PDM lockfiles carry hashes by default; for pip, use `--generate-hashes` (above) and install with `pip install --require-hashes -r requirements.txt`.

## 3. Vulnerability Scanning — pip-audit

The Python analogue of `<pm> audit`. Install (`uv add --dev pip-audit`) and run:

```bash
pip-audit                       # audit the current environment
pip-audit -r requirements.txt   # audit a requirements file
```

Add it to CI so vulnerable dependencies fail the build.

## 4. Automated Updates — Renovate / Dependabot

Renovate and Dependabot both support Python (`pyproject.toml`, `requirements.txt`, Poetry, PDM, uv). If the project already uses Renovate for another ecosystem, its config typically covers Python automatically. Otherwise add Dependabot:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: pip
    directory: "/"
    schedule:
      interval: weekly
```

## 5. PR Dependency Review (CI)

`actions/dependency-review-action` works for Python via GitHub's dependency graph — same workflow as the JS/TS path, no package-manager setup needed. **This is GitHub-only**: on GitLab, use GitLab's built-in Dependency Scanning (`Dependency-Scanning.gitlab-ci.yml`) instead. See the JS/TS `rules/dependency-review.md` for the workflow template.

## Output

Report applied vs skipped measures, and any manual steps (e.g. "regenerate the hashed lockfile after adding a dependency").

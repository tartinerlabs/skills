# Python Project Setup

Toolchain setup for Python projects — the ecosystem equivalent of the JS/TS `rules/*.md`. Detect what's already configured and install only what's missing. GitLeaks (secret scanning) is cross-ecosystem and set up the same way as elsewhere; the rest is Python-specific.

## Detect Existing Tooling

Before installing anything, scan for existing config:

- `ruff` in `pyproject.toml` / `ruff.toml` / `.ruff.toml` → Ruff already configured
- `.pre-commit-config.yaml` → pre-commit framework already configured
- `mypy` config in `pyproject.toml` / `mypy.ini` / `setup.cfg` → mypy already configured
- `black` / `isort` / `flake8` present → legacy formatters/linters (suggest consolidating on Ruff)
- `gitleaks` in `.pre-commit-config.yaml` → secret scanning already wired

**Skip tools that are already configured.** Report what was skipped at the end.

## Package/Environment Manager

Detect the project's manager and use it for install commands:

- `uv.lock` / `[tool.uv]` → **uv** (`uv add --dev <pkg>`)
- `poetry.lock` / `[tool.poetry]` → **Poetry** (`poetry add --group dev <pkg>`)
- `pdm.lock` → **PDM** (`pdm add -dG dev <pkg>`)
- plain `requirements.txt` / venv → **pip** (`pip install <pkg>`, add to `requirements-dev.txt`)

## Ruff — Lint + Format

Ruff replaces Black, isort, and flake8 with a single fast tool.

Install (uv shown; substitute the detected manager): `uv add --dev ruff`

Config in `pyproject.toml`:

```toml
[tool.ruff]
line-length = 88
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]

[tool.ruff.format]
quote-style = "double"
```

Commands: `ruff check .` (lint), `ruff check --fix .`, `ruff format .`.

## mypy — Type Checking

Install: `uv add --dev mypy`

Config in `pyproject.toml`:

```toml
[tool.mypy]
python_version = "3.11"
strict = true
warn_unused_ignores = true
```

Command: `mypy <package>`.

## pre-commit — Git Hooks

Python's standard hook manager (the analogue of Husky). Install: `uv add --dev pre-commit`, then `pre-commit install`.

`.pre-commit-config.yaml` — secret scanning runs first, then lint/format:

```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.21.2
    hooks:
      - id: gitleaks
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.7.4
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
```

GitLeaks stays the default secret scanner across ecosystems — here it is wired as the first pre-commit hook (mirroring the JS/TS `gitleaks git --staged` step), and it must be installed on the system (`brew install gitleaks`).

## Output

Report installed vs skipped tools, then suggest: `ruff check .` to verify linting, and a test commit to verify hooks fire.

# Python CI Workflow

CI template for Python projects — the Python equivalent of the JS/TS Node template in `SKILL.md`. Detected by `pyproject.toml` / `requirements.txt` / `setup.py`. Pin every action to a full commit SHA per `rules/action-pinning.md`, and keep the `permissions` and `concurrency` blocks from the shared rules.

The install step below shows pip; swap in the project's manager (`uv sync`, `poetry install`) when detected — `uv.lock`/`[tool.uv]` → uv, `poetry.lock`/`[tool.poetry]` → Poetry. Resolve the intended action releases before writing the workflow; the concrete pins below are examples.

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
      - uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1  # v6.3.0
        with:
          python-version: '3.12'
          cache: pip
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: ruff check .
      - run: ruff format --check .
      - run: pytest
```

Notes:
- For uv: `- uses: astral-sh/setup-uv@<full-SHA>  # vX.Y.Z` (third-party — pin to a commit SHA), then `uv sync` and `uv run pytest`.
- For Poetry: `pipx install poetry`, then `poetry install` and `poetry run pytest`; set `cache: poetry` on `setup-python`.
- Add a `mypy` step if the project uses it.

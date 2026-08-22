# Ruby CI Workflow

CI template for Ruby projects — the Ruby equivalent of the JS/TS Node template in `SKILL.md`. Detected by `Gemfile`. Pin every action to a full commit SHA with a version or source-ref comment per `rules/action-pinning.md`. Keep the `permissions` and `concurrency` blocks from the shared rules.

Resolve the intended releases with `gh api repos/{owner}/{repo}/commits/{tag} --jq '.sha'` before writing the workflow; the concrete pins below are examples.

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
      - uses: ruby/setup-ruby@003a5c4d8d6321bd302e38f6f0ec593f77f06600  # v1.319.0
        with:
          ruby-version: .ruby-version
          bundler-cache: true
      - run: bundle exec rubocop
      - run: bundle exec rake test
```

Notes:
- `ruby-version: .ruby-version` keeps CI in sync with the project's pinned Ruby; use a literal version (e.g. `'3.3'`) if there is no `.ruby-version` file.
- `bundler-cache: true` runs `bundle install` and caches gems — no separate install step is needed.
- Use `bundle exec rspec` instead of `rake test` if the project uses RSpec.

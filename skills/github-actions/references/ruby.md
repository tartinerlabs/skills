# Ruby CI Workflow

CI template for Ruby projects — the Ruby equivalent of the JS/TS Node template in `SKILL.md`. Detected by `Gemfile`. Pin actions per `rules/action-pinning.md`: `actions/checkout` is GitHub-owned (version tag), but `ruby/setup-ruby` is **third-party** and must pin to a full commit SHA with a version comment. Keep the `permissions` and `concurrency` blocks from the shared rules.

Look up the current SHA with `gh api repos/ruby/setup-ruby/git/ref/tags/<tag> --jq '.object.sha'` and update the comment — the SHA below is illustrative.

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

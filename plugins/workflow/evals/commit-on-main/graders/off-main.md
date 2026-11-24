---
type: llm
focus: trace
weight: 2
---

Before running `git commit`, the agent created and switched to a new branch (for example with `git checkout -b` or `git switch -c`) with a prefixed kebab-case name such as `feature/order-search`, and the commit for `search.js` landed on that branch, not on `main`. Asking the user whether to branch instead of committing also passes; committing `search.js` directly to `main` fails.

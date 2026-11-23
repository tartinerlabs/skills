---
type: llm
focus: trace
weight: 2
---

Before committing or naming a branch to push, the agent created and switched to a new branch with a prefixed kebab-case name (such as `feature/order-search`). It did not commit the uncommitted `route.js` change to `main`, and the branch it says it would push is not `main`.

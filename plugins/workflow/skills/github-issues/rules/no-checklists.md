---
title: No Checklists
impact: MEDIUM
tags: issue, format, checklist
---

**Rule**: Use numbered lists for sequential steps and bullets for everything else. Checkbox lists (`- [ ]`) turn an issue body into a task tracker, which is rarely what a bug report or feature request wants — add them when the repository's template already has them, or when the user asks for a task list.

### Incorrect

```markdown
## Tasks
- [ ] Review requirements
- [ ] Implement solution
- [ ] Add tests
```

### Correct

```markdown
## Steps
1. Review requirements
2. Implement solution
3. Add tests
```

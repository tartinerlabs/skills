---
title: Issue References
impact: MEDIUM
tags: issues, github, closes, relates
---

**Rule**: When a GitHub issue is mentioned in conversation context, add a footer reference. Use "Closes" for complete implementations and "Relates to" for partial work.

### Format

```
fix login timeout bug

Closes #123
```

```
add input validation for signup

Relates to #456
```

### When to Use

- **Closes #N**: The changes fully resolve the issue
- **Relates to #N**: The changes are related but don't fully close the issue
- **No reference**: No issue mentioned in conversation context

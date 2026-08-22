# Python Commit Messages

The convention used by CPython itself. The universal rules in `rules/message-format.md` still apply — this covers the Python-specific expression of them.

**This is the Tier 3 fallback only.** Most Python applications and libraries use conventional commits, very often enforced by commitizen (`.cz.toml` or `[tool.commitizen]` in `pyproject.toml`) — which Tier 1 of `rules/convention-detection.md` catches first. Reach this file only for CPython-adjacent work or a repository with no usable history.

## Subject

```
gh-12345: Make the spam module more spammy
```

- Prefix with `gh-NNNNN: ` when the change addresses a tracked issue. CPython uses this in the PR title, and it carries into the squashed commit.
- **Imperative** — "Make the spam module more spammy", not "the spam module is now more spammy".
- **Capitalised** after the prefix.
- **No trailing period.**
- Dense and to the point: the first line explains the purpose of the commit and must read well in `git log --oneline`.
- Omit the prefix entirely when no issue exists; do not fabricate an ID.

## Body

Optional paragraphs adding detail on what happened and justifying the change, in enough depth for a maintainer to follow.

```
Make the spam module more spammy

The spam module sporadically came up short on spam. This change
raises the amount of spam in the module by making it more spammy.
```

CPython states no hard subject limit; 50 remains a safe target. The 80-column figure in its guide applies to NEWS entries, not commit subjects.

## Enterprise Tracker IDs

The same shape covers Jira-style prefixes common in Python (and other) corporate repositories — `PROJ-482: Reject expired refresh tokens`. Detect the ID pattern from history rather than assuming one, and never invent an ID that was not supplied in conversation context.

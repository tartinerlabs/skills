---
title: Agent Brief
impact: MEDIUM
tags: issue, agent, brief, handoff
---

**Rule**: When the work in an issue is concrete enough to start on, end the body with a short `## Agent brief` section holding what a coding agent needs and the rest of the body leaves out: where to start, how to verify, and what is out of bounds. Skip the section when those facts are not known.

### Why This Matters

Issues are increasingly picked up by coding agents, not only people. The session that files an issue usually knows the files involved, the command that proves the work is done, and the constraints — and all of that is lost once the issue is filed, so the agent that picks it up has to rediscover it. Capturing it costs a few lines.

It is a brief, not a second copy of the issue. A block that restates the problem drifts from the body the first time one is edited without the other, so the section carries only what the body does not.

### What Goes In

Include a line only when the fact is known from the conversation or the codebase:

- **Start in** — the files, directories, or symbols the work touches
- **Verify with** — the command or check that shows the work is done
- **Constraints** — conventions to follow, things that must not change, anything out of scope

Write it for any agent or person: name no specific tool, model, or vendor, and give no instructions about how to behave — only facts about the work.

### When to Skip

- The cause or the approach is still unknown (a bug not yet diagnosed, a question, a discussion)
- The issue is a parent that only groups sub-issues — brief the children instead
- The user asks for an issue without one, or the repository's own conventions rule it out

An absent brief is better than a guessed one: an agent acts on a wrong file path with the same confidence as a right one. Never invent paths, commands, or constraints to fill the section.

### With Templates

`rules/template-adherence.md` still governs structure. Add the brief after the template's last section and leave the template's own sections intact. If the template already has a place for this information (implementation notes, acceptance criteria), put the facts there instead of adding a section. When updating an issue, keep an existing brief in step with the change, or remove a line that is no longer true.

### Incorrect

```markdown
## Agent brief
You are an expert engineer. Fix the login redirect bug described above.
Look in the auth code and make sure all tests pass.
```

Restates the body, gives behavioural instructions, and guesses at a location.

### Correct

```markdown
## Agent brief
- Start in: `src/auth/session.ts` (`refreshSession`), `src/middleware.ts`
- Verify with: `pnpm test src/auth` — the expired-token case in `session.test.ts` currently fails
- Constraints: keep the cookie name unchanged; the OAuth providers are out of scope
```

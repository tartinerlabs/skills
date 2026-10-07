# OpenCode v2 plugin system

Research notes for deciding whether OpenCode returns as a distribution channel. Gathered 2026-10-07 from the OpenCode v2 docs; v2.0.x has no published release notes yet ([anomalyco/opencode#52184](https://github.com/anomalyco/opencode/issues/52184)), so treat everything here as a snapshot of a young API.

## Why this matters

OpenCode was retired as a channel in #61/#63 because its v1 plugins were TypeScript modules published to npm, which conflicted with this repo's stdlib-Go-and-shell tooling. v2 changes three things that bear on that decision:

1. Plugins can register skills directly
2. Plugins install from git with a subdirectory selector, with no build step and no npm publish
3. Skill sources can be HTTP catalogs, served as static files

## Skills

Source: [opencode.ai/v2/docs/skills](https://opencode.ai/v2/docs/skills/)

### Discovery

OpenCode reads skills from these locations, lowest to highest precedence:

1. Built-in skills
2. `.claude/skills` — global, then from the farthest ancestor toward the current directory
3. `.agents/skills` — same order
4. `~/.config/opencode/skills`
5. Project `.opencode/skills`, from the project root toward the current directory
6. Explicit `skills` config entries, in config priority and array order

A later source wins on a duplicate ID. Because `~/.claude/skills` and `~/.agents/skills` are read natively, anyone who installs this collection through skills.sh already gets it in OpenCode v2.

### IDs and frontmatter

- The skill ID comes from the path (`<source>/commit/SKILL.md` → `commit`); frontmatter `name` is only a display label
- Fields read: `name`, `description`, `metadata.opencode/autoinvoke`, `disable-model-invocation`
- `license` and `compatibility` are accepted and ignored — our portable frontmatter group loads cleanly
- Skills without a `description` are not advertised to the model
- Paths inside a skill resolve relative to the `SKILL.md` directory, so our `rules/` and `references/` layout works as-is
- The model loads a skill by ID through the `skill` tool; users load one with `@skill-id`

### `skills` config and HTTP catalogs

```jsonc
{
  "skills": ["./team-skills", "~/shared/opencode-skills", "https://example.com/opencode/skills/"]
}
```

An HTTP source is a base URL with an `index.json`:

```json
{
  "skills": [
    { "name": "git-release", "version": "3", "files": ["git-release.md", "references/release-policy.md"] }
  ]
}
```

- Each file is fetched from `<base-url>/<name>/<file>`; paths must be relative and same-origin
- Bump `version` whenever files change, or OpenCode keeps serving its cache
- **Gotcha:** each downloaded skill directory becomes its own source root, so a root-level `SKILL.md` gets the literal ID `SKILL` in v2. The docs recommend the named form (`commit.md`), which our `plugins/<collection>/skills/<name>/SKILL.md` layout does not provide

## Plugins

Sources: [opencode.ai/v2/docs/plugins](https://opencode.ai/v2/docs/plugins/), [opencode.ai/v2/docs/build/plugins](https://opencode.ai/v2/docs/build/plugins/)

### Module shape

A plugin default-exports an object with an `id` and either `setup(ctx)` (Promise) or `effect(ctx)` (Effect):

```ts
import { Plugin } from "@opencode/plugin"

export default Plugin.define({
  id: "example",
  async setup(ctx) {
    // register transforms, hooks, tools; may return a cleanup function
  },
})
```

v1 plugins (async factory functions) do not load in v2 and must be rewritten hook by hook ([anomalyco/opencode#53706](https://github.com/anomalyco/opencode/issues/53706)). One package can serve both by exporting `{ ...Plugin.define({ id, setup }), server() }` — v1 calls `server()`, v2 reads `id` and `setup()`.

### Registering skills

```ts
await ctx.skill.transform((editor) => {
  editor.add({
    id: "review",
    name: "Review",
    description: "Review the current changes",
    path: "/workspace/.opencode/skills/review/SKILL.md",
    content: "Review the current changes for correctness and missing tests.",
  })
})
```

`SkillEditor` offers `list`, `get`, `add`, `update`, and `remove`. A plugin supplies `content` itself, so a skills plugin reads each `SKILL.md`, strips the frontmatter, and registers it. Transforms are synchronous and replayed on every registry rebuild — load files before the callback, then call `ctx.skill.reload()` if they change.

The same transform pattern covers commands (`ctx.command`), agents, MCP servers (`ctx.mcp`), providers, models, tools, VCS, worktrees, and web search.

### Loading and installation

- Config key is `plugins` (plural) in `opencode.json(c)`, merged across `~/.config/opencode/`, `./`, and `./.opencode/` rather than replaced
- Entries can be npm names (with version, tag, or range), local paths, `file://` URLs, or `{ "package", "options" }` objects
- `.ts` and `.js` files and immediate package directories under `.opencode/plugins/` (and `~/.config/opencode/plugins/`) load automatically
- TypeScript loads directly — no build step
- CLI: `opencode plugin add | list | check | update | remove`
- Git specs are accepted, including private repos and subdirectories:

  ```sh
  opencode plugin add github:acme/opencode-plugin
  opencode plugin add git+ssh://git@github.com/acme/opencode-plugin.git#main
  opencode plugin add 'github:acme/plugins#main::path:packages/opencode-plugin'
  ```

- Exact npm versions and full commit hashes stay pinned; unpinned git and npm plugins are checked for updates in the background
- Entries can be disabled with `-id`, `*`, and `.*` prefix wildcards

### Package manifest

```json
{
  "name": "opencode-acme-plugin",
  "version": "1.0.0",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@opencode/plugin": "latest" }
}
```

## Test results

Tested 2026-10-07 against OpenCode v2.0.24 in an isolated home (`HOME`/`XDG_*` redirected, private `opencode serve`), inspecting state through the server's `skill.list` and `plugin.list` endpoints. Git installs used `git+file://` specs, first against a scratch repo mirroring the pre-#99 symlink layout, then against a clone of `main` after #99 moved skills into real directories under `plugins/<collection>/skills/`. `github:` shortcuts go through the same npm git-install path but were not exercised.

### A plain object plugin loads with zero dependencies — confirmed

```js
import { readFileSync } from "node:fs"

export default {
  id: "tartinerlabs.test",
  async setup(ctx) {
    // read SKILL.md, split frontmatter, then:
    await ctx.skill.transform((editor) => editor.add({ id, name, description, path, content }))
  },
}
```

No `@opencode/plugin` import, no `package.json` dependencies. The plugin reported `active` and the skill appeared in `skill.list` alongside discovered ones. Node built-ins (`node:fs`, `node:path`, `node:url`) are available.

### Supporting files resolve from `path` — confirmed

OpenCode's shipped `Skill.prepare` sets the skill's base directory to `dirname(skill.path)`, and when the file is named exactly `SKILL.md` it scans that directory for up to 10 supporting files (sorted, excluding `SKILL.md`) to include when the skill loads. A plugin-registered skill whose `path` points at a real `SKILL.md` therefore gets the same base directory and `rules/`/`references/` sample as a discovered skill. Skills with more than 10 supporting files get a truncated sample either way — today that is only `github-actions` (13); the files stay readable because `SKILL.md` names them explicitly.

### Git installs pack like npm — symlinks are dropped

| Variant | Spec | Result |
|---------|------|--------|
| Subdirectory with symlinked skills (pre-#99 layout) | `…#<ref>::path:plugins/workflow` | Installs, but `skills/` is missing entirely — only `index.js` and `package.json` arrive |
| Subdirectory with real skill directories | `…#<ref>::path:plugins/workflow` | Full tree arrives, including `rules/` and `references/`; skills register |
| `main` after #99, plus `package.json` and `opencode.js` in `plugins/workflow/` | `…#<ref>::path:plugins/workflow` | Whole collection arrives (per-channel manifests, `plugin.json`, every skill with its `rules/` and `references/`); all six workflow skills register and `go run ./scripts/validate-skills` still passes |
| Root `package.json`, no `::path:` | `…#<ref>` | Whole repo arrives; an entrypoint under `plugins/workflow/` reading `../../skills` registers skills |
| Subdirectory without `package.json` | `…#<ref>::path:plugins/workflow` | Fails: `NpmInstallFailedError: Could not read package.json` |

The `package.json` can be dependency-free — `name`, `version`, `"type": "module"`, and `exports` were enough.

### Raw GitHub does not follow symlinks — confirmed

Before #99, `raw.githubusercontent.com/tartinerlabs/skills/main/plugins/workflow/skills/commit` returned the link text `../../../skills/commit`, and `…/plugins/workflow/skills/commit/SKILL.md` returned 404. Since #99 the collection paths are real files and serve normally (`…/plugins/workflow/skills/commit/SKILL.md` → 200), so the remaining HTTP-catalog obstacle is the named-file gotcha above.

### Operational notes

- Reinstalling the same branch spec reuses the cached install; a new revision lands only through `opencode plugin update` or a pinned commit hash. Pinning full hashes is the reliable path for testing
- Two plugins with the same `id` fail with `Duplicate plugin ID` — each collection needs its own `id`
- `opencode plugin update` starts the managed background service and has no `--server` flag, so it collides with an already-running service on the same machine
- Loading a skill through `POST /api/experimental/session/{id}/skill` also triggers an assistant turn

## Implications for this repo

| Option | What ships | Cost |
|--------|-----------|------|
| README update only | A line saying OpenCode v2 reads skills.sh installs from `~/.agents/skills` | Nothing to maintain |
| HTTP catalog | Committed `index.json` served from GitHub raw | The named-file gotcha means duplicating each `SKILL.md` as `<name>.md` or adding a generator; validator must keep `index.json` and versions in sync |
| Git plugin per collection | `plugins/<collection>/package.json` (no dependencies) + a small dependency-free `opencode.js` that reads and registers that collection's skills | Two small files per collection; reintroduces a little JS source; tracks an API with no release notes |

The git plugin option is proven end to end against the merged layout: #99's real skill directories satisfy its one structural requirement, so adding a channel is now just the two files per collection. Install would be `opencode plugin add 'github:tartinerlabs/skills::path:plugins/<collection>'`.

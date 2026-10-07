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
- **Gotcha:** each downloaded skill directory becomes its own source root, so a root-level `SKILL.md` gets the literal ID `SKILL` in v2. The docs recommend the named form (`commit.md`), which our `skills/<name>/SKILL.md` layout does not provide

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

## Implications for this repo

| Option | What ships | Cost |
|--------|-----------|------|
| README update only | A line saying OpenCode v2 reads skills.sh installs from `~/.agents/skills` | Nothing to maintain |
| HTTP catalog | Committed `index.json` served from GitHub raw | Named-file gotcha means duplicating each `SKILL.md` as `<name>.md`, or a generator; validator must keep `index.json` and versions in sync |
| Git plugin per collection | `plugins/<collection>/.opencode-plugin/` with `package.json` + a small JS module that reads and registers that collection's skills | Reintroduces JS source; tracks an API with no release notes |

## Open questions

Each needs a scratch OpenCode v2 project to answer:

1. Does the loader accept a plain `{ id, setup }` object with no `@opencode/plugin` import? The docs say v2 "reads the default export's `id` and `setup()`", which suggests `Plugin.define` is a type helper — that would keep a plugin at zero npm dependencies
2. Does `::path:` install require a `package.json` in the subdirectory, and do symlinks inside it (our `plugins/<collection>/skills/*`) survive the git install?
3. Does `raw.githubusercontent.com` serve symlinked files? It is believed to return the link text, which rules out per-collection catalogs built from the existing symlinks
4. Does a skill registered through `ctx.skill.transform` with a real `path` get the supporting-file sample, so `rules/` and `references/` resolve?

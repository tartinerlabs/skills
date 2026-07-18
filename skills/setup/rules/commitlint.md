# commitlint

Conventional commit message enforcement via git hooks.

## Install

```bash
<pm> add -D @commitlint/cli @commitlint/config-conventional
```

## Config Detection

Treat commitlint as already configured when any of these exist:

- `commitlint.config.ts`
- `commitlint.config.cts`
- `commitlint.config.mts`
- `commitlint.config.js`
- `commitlint.config.cjs`
- `commitlint.config.mjs`
- `.commitlintrc.ts`
- `.commitlintrc.cts`
- `.commitlintrc.mts`
- `.commitlintrc.js`
- `.commitlintrc.cjs`
- `.commitlintrc.mjs`
- `.commitlintrc.json`
- `.commitlintrc.yaml`
- `.commitlintrc.yml`
- `.commitlintrc`
- `commitlint` key in `package.json` or `package.yaml`

## Config Creation

Create `commitlint.config.ts`:

```ts
import type { UserConfig } from "@commitlint/types";

const config: UserConfig = { extends: ["@commitlint/config-conventional"] };

export default config;
```

## Hook

Create `.husky/commit-msg`:

```bash
pnx --no -- commitlint --edit $1
```

### Why This Matters

Enforcing the Conventional Commits format at commit time is what makes downstream automation possible: semantic-release derives version bumps and changelogs directly from commit types (`feat`, `fix`, `feat!`). commitlint rejects non-conforming messages before they enter history, so the log stays machine-readable.

### Alternatives

The opinion here is adopting a commit convention at all — many teams do fine with free-form messages, or use gitmoji, or a custom scheme. If you do not want automated releases/changelogs, commitlint adds friction for little gain; skip it. If the project already enforces a different convention, keep it.

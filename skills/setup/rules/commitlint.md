# commitlint

Conventional commit message enforcement via git hooks.

## Install

```bash
<pm> add -D @commitlint/cli @commitlint/config-conventional
```

## Config

Create `commitlint.config.js`:

```js
export default { extends: ["@commitlint/config-conventional"] };
```

## Hook

Create `.husky/commit-msg`:

```bash
npx --no -- commitlint --edit $1
```

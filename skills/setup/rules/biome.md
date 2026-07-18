# Biome

Linting + formatting replacement for ESLint and Prettier.

## Install

```bash
<pm> add -D @biomejs/biome
```

## Config

Create `biome.json`:

```json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double"
    }
  },
  "assist": {
    "enabled": true,
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  }
}
```

## Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "check": "biome check",
    "format": "biome check --write"
  }
}
```

## Migration

If ESLint or Prettier are detected, suggest:

```bash
pnx @biomejs/biome migrate eslint
pnx @biomejs/biome migrate prettier
```

### Why This Matters

Biome is a single binary that handles both linting and formatting from one config, with no plugin resolution to manage — it runs an order of magnitude faster than ESLint + Prettier and removes the class of conflicts where a formatter and a linter disagree. For a project with no linter/formatter yet, it is the lowest-friction way to reach consistent, enforced style.

### Alternatives

ESLint + Prettier is the mainstream alternative and remains the stronger choice when you need its far larger plugin/rule ecosystem, custom-rule authoring, or framework-specific configs that Biome does not yet match. If the project already uses ESLint/Prettier deliberately, keep it — the `migrate` commands above are an **offer**, not a requirement.

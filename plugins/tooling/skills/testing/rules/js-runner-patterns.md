---
title: JS/TS Runner Patterns
impact: HIGH
tags: vitest, jest, node-test, mocking, setup, teardown, globals
---

**Rule**: Use the detected JS/TS runner's idioms correctly — globals/imports, mock utilities, and proper setup/teardown. The examples below use Vitest; the equivalents for **Jest** and **node:test** are noted inline.

### Runner Cheat-Sheet

| Concept | Vitest | Jest | node:test |
|---|---|---|---|
| Mock namespace | `vi` | `jest` | `mock` (from `node:test`) |
| Standalone mock | `vi.fn()` | `jest.fn()` | `mock.fn()` |
| Module mock | `vi.mock()` | `jest.mock()` | `mock.module()` † |
| Assertions | `expect` (built-in) | `expect` (built-in) | `node:assert` |
| Globals without import | `globals: true` | on by default | never — import from `node:test` |

Match whichever runner the project already uses (see Config Detection below). Do not introduce a second runner.

† **node:test module mocking is experimental.** `mock.module()` only works when Node is started with `--experimental-test-module-mocks` (e.g. `node --test --experimental-test-module-mocks`). Add that flag to the project's test command when generating module mocks, or avoid module-level mocks (prefer dependency injection or `mock.fn()`) so a plain `node --test` script doesn't fail.

### Globals Mode

Vitest provides `describe`, `it`, `expect`, `beforeEach`, and `afterEach` globally when `globals: true` is set in config; Jest exposes them globally by default. **node:test** never does — always import `test`/`describe` from `node:test` and assertions from `node:assert`. Within a project, follow its existing convention rather than mixing styles. For Vitest, do NOT import them from `vitest` when globals mode is on.

#### Incorrect

```ts
import { describe, it, expect } from 'vitest';

describe('add', () => {
  it('should sum two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
});
```

#### Correct

```ts
// No imports needed for describe, it, expect
describe('add', () => {
  it('should sum two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
});
```

Only import `vi` when using mock utilities:

```ts
import { vi } from 'vitest';
```

### Mocking with `vi`

Use `vi.fn()` for standalone mocks, `vi.spyOn()` to wrap existing methods, and `vi.mock()` for module-level mocking.

```ts
import { vi } from 'vitest';

// Standalone mock
const onClick = vi.fn();

// Spy on an existing method
vi.spyOn(console, 'error').mockImplementation(() => {});

// Module mock
vi.mock('./api', () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: '1', name: 'Alice' }),
}));
```

### Setup and Teardown

Use `beforeEach` / `afterEach` to reset shared state. Prefer `beforeEach` over `beforeAll` to isolate tests.

```ts
import { vi } from 'vitest';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

### Assertions

Use specific matchers over generic ones:

| Instead of | Use |
|---|---|
| `toBe(true)` | `toBeTruthy()` or specific condition |
| `toBe(undefined)` | `toBeUndefined()` |
| `toBe(null)` | `toBeNull()` |
| `expect(arr.length).toBe(3)` | `toHaveLength(3)` |
| `expect(obj.key).toBeDefined()` | `toHaveProperty('key')` |

### Async Testing

Use `async/await` directly — Vitest handles promises natively:

```ts
it('should fetch user data', async () => {
  const user = await fetchUser('1');
  expect(user.name).toBe('Alice');
});
```

For rejected promises:

```ts
it('should throw for missing user', async () => {
  await expect(fetchUser('unknown')).rejects.toThrow('Not found');
});
```

### Config Detection

Identify which runner the project uses, in this order:

1. **Vitest** — `vitest.config.*`, a `test` block in `vite.config.*`, `vitest.workspace.ts`, or `vitest` in `package.json` devDependencies
2. **Jest** — `jest.config.*`, a `jest` key in `package.json`, or `jest` in devDependencies
3. **node:test** — a `--test` flag in the `test` script, or test files importing from `node:test` with no other runner present
4. **No runner configured** — default to Vitest for new setups (fastest, ESM-native), unless the project's stack points to Jest

Use the detected runner's idioms throughout (see the cheat-sheet above).

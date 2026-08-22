---
title: Test Structure
impact: HIGH
tags: structure, aaa, naming, describe, it, colocation
---

**Rule**: Follow the AAA pattern, use clear naming, and colocate tests next to source files.

These principles are language-neutral (the examples are JS/TS, but the AAA structure, behaviour-focused naming, one-concept-per-test, and colocation apply to any language — see the per-language reference for idiomatic equivalents such as pytest classes/functions or Go table-driven tests).

### AAA Pattern

Keep the three phases — arrange the inputs, act on the unit, assert the outcome — visually distinct. `// Arrange` / `// Act` / `// Assert` comments are optional and usually unnecessary; the separation is what matters, not the labels. A test that interleaves setup and assertions is the finding.

### Naming

- **`describe` blocks**: name the unit under test — the function, component, or class
- **`it` blocks**: state the expected behaviour as a claim about the unit. `it('formats USD with two decimal places')` and `it('should format USD with two decimal places')` both do this; `it('test 1')` and `it('works')` do not. Follow whichever phrasing the existing suite uses rather than converting it

#### Incorrect

```ts
describe('tests', () => {
  it('test 1', () => { ... });
  it('works', () => { ... });
});
```

#### Correct

```ts
describe('formatCurrency', () => {
  it('formats USD with two decimal places', () => { ... });
  it('returns "0.00" for zero input', () => { ... });
  it('throws for negative amounts', () => { ... });
});
```

### Nesting

Nest `describe` blocks to group related scenarios. Avoid nesting deeper than 2 levels.

```ts
describe('UserService', () => {
  describe('create', () => {
    it('should create a user with valid input', () => { ... });
    it('should throw for duplicate email', () => { ... });
  });

  describe('delete', () => {
    it('should remove the user by ID', () => { ... });
  });
});
```

### One Concept per Test

Each `it` block should test one logical assertion. Multiple `expect` calls are fine if they verify the same concept.

#### Incorrect

```ts
it('should handle user creation', () => {
  const user = createUser({ name: 'Alice' });
  expect(user.name).toBe('Alice');
  expect(user.id).toBeDefined();

  const duplicate = () => createUser({ name: 'Alice' });
  expect(duplicate).toThrow();
});
```

#### Correct

```ts
it('should create a user with the given name', () => {
  const user = createUser({ name: 'Alice' });
  expect(user.name).toBe('Alice');
  expect(user.id).toBeDefined();
});

it('should throw when creating a duplicate user', () => {
  createUser({ name: 'Alice' });
  expect(() => createUser({ name: 'Alice' })).toThrow();
});
```

### File Naming and Location

- Colocate test files next to source: `user-service.ts` → `user-service.test.ts`
- Match the project's existing convention (`.test.ts` vs `.spec.ts`) — pick one, not both
- Component tests: `button.tsx` → `button.test.tsx`

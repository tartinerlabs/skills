import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { MANIFESTS } from "../scripts/sync-plugin-versions.mjs";
import { validate } from "../scripts/validate-skills.mjs";

const VERSION = "1.0.0";

const MARKETPLACES = [
  ".claude-plugin/marketplace.json",
  ".cursor-plugin/marketplace.json",
  ".agents/plugins/marketplace.json",
];

const VALID_SKILL = `---
name: demo
description: A demo skill for tests.
allowed-tools: Read Bash(git:*)
model: haiku
effort: low
---

You are a demo skill. Read \`rules/foo.md\` before proceeding.

| Rule | File |
|------|------|
| Foo | \`rules/foo.md\` |
`;

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2));
}

async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value);
}

// Build a minimal but fully valid repo so each test can mutate one thing.
async function buildFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "validate-skills-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  await writeJson(join(root, "package.json"), { version: VERSION });

  await writeText(join(root, "skills/demo/SKILL.md"), VALID_SKILL);
  await writeText(join(root, "skills/demo/rules/foo.md"), "# Foo\n");

  await mkdir(join(root, "xcode-skills/sample"), { recursive: true });

  for (const manifest of MANIFESTS) {
    const name = manifest.includes("xcode-skills")
      ? "xcode-skills"
      : "tartinerlabs";
    await writeJson(join(root, manifest), { name, version: VERSION });
  }
  for (const marketplace of MARKETPLACES) {
    await writeJson(join(root, marketplace), {
      name: "tartinerlabs",
      plugins: [],
    });
  }

  await symlink("../../skills", join(root, "plugins/tartinerlabs/skills"));
  await symlink(
    "../../xcode-skills",
    join(root, "plugins/xcode-skills/skills"),
  );

  return root;
}

test("passes on a valid fixture", async (t) => {
  const root = await buildFixture(t);
  const errors = await validate(root);
  assert.deepEqual(
    errors,
    [],
    `expected no errors, got:\n${errors.join("\n")}`,
  );
});

test("flags invalid and missing frontmatter fields", async (t) => {
  const root = await buildFixture(t);
  await writeText(
    join(root, "skills/demo/SKILL.md"),
    `---
name: demo
allowed-tools: Read
model: banana
effort: low
---

Body with \`rules/foo.md\`.

| Rule | File |
|------|------|
| Foo | \`rules/foo.md\` |
`,
  );
  const errors = await validate(root);
  assert.ok(
    errors.some((e) => e.includes("missing required field `description`")),
    errors.join("\n"),
  );
  assert.ok(
    errors.some((e) => e.includes("model `banana`")),
    errors.join("\n"),
  );
});

test("flags a referenced rule file that does not exist", async (t) => {
  const root = await buildFixture(t);
  await unlink(join(root, "skills/demo/rules/foo.md"));
  const errors = await validate(root);
  assert.ok(
    errors.some((e) =>
      e.includes("references `rules/foo.md` which does not exist"),
    ),
    errors.join("\n"),
  );
});

test("flags plugin manifest version drift", async (t) => {
  const root = await buildFixture(t);
  await writeJson(join(root, MANIFESTS[0]), {
    name: "tartinerlabs",
    version: "9.9.9",
  });
  const errors = await validate(root);
  assert.ok(
    errors.some((e) => e.includes("version `9.9.9`") && e.includes(VERSION)),
    errors.join("\n"),
  );
});

test("flags a broken wrapper symlink", async (t) => {
  const root = await buildFixture(t);
  await unlink(join(root, "plugins/tartinerlabs/skills"));
  await symlink(
    "../../does-not-exist",
    join(root, "plugins/tartinerlabs/skills"),
  );
  const errors = await validate(root);
  assert.ok(
    errors.some(
      (e) => e.includes("plugins/tartinerlabs/skills") && e.includes("symlink"),
    ),
    errors.join("\n"),
  );
});

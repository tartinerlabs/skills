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

test("passes when SKILL.md references an existing references/ file", async (t) => {
  const root = await buildFixture(t);
  await writeText(
    join(root, "skills/demo/SKILL.md"),
    `${VALID_SKILL}\nSee \`references/python.md\` for the Python path.\n`,
  );
  await writeText(join(root, "skills/demo/references/python.md"), "# Python\n");
  const errors = await validate(root);
  assert.deepEqual(
    errors,
    [],
    `expected no errors, got:\n${errors.join("\n")}`,
  );
});

test("flags a referenced references/ file that does not exist", async (t) => {
  const root = await buildFixture(t);
  await writeText(
    join(root, "skills/demo/SKILL.md"),
    `${VALID_SKILL}\nSee \`references/python.md\` for the Python path.\n`,
  );
  const errors = await validate(root);
  assert.ok(
    errors.some((e) =>
      e.includes("references `references/python.md` which does not exist"),
    ),
    errors.join("\n"),
  );
});

test("flags an orphaned references/ file", async (t) => {
  const root = await buildFixture(t);
  await writeText(join(root, "skills/demo/references/orphan.md"), "# Orphan\n");
  const errors = await validate(root);
  assert.ok(
    errors.some((e) =>
      e.includes("`references/orphan.md` is never referenced"),
    ),
    errors.join("\n"),
  );
});

test("ignores references/<placeholder>.md templates", async (t) => {
  const root = await buildFixture(t);
  await writeText(
    join(root, "skills/demo/SKILL.md"),
    `${VALID_SKILL}\nLoad \`references/<lang>.md\` for the detected language.\n`,
  );
  // No references/ dir exists — a placeholder must not be treated as a real,
  // missing file.
  const errors = await validate(root);
  assert.deepEqual(
    errors,
    [],
    `expected no errors, got:\n${errors.join("\n")}`,
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
    errors.some((e) => e.includes("plugins/tartinerlabs/skills")),
    errors.join("\n"),
  );
});

test("flags a wrapper symlink pointing at the wrong collection", async (t) => {
  const root = await buildFixture(t);
  // Swap tartinerlabs' skills link to the xcode-skills collection — a valid,
  // existing directory, so only the target comparison can catch it.
  await unlink(join(root, "plugins/tartinerlabs/skills"));
  await symlink(
    "../../xcode-skills",
    join(root, "plugins/tartinerlabs/skills"),
  );
  const errors = await validate(root);
  assert.ok(
    errors.some(
      (e) =>
        e.includes("plugins/tartinerlabs/skills") &&
        e.includes("expected `../../skills`"),
    ),
    errors.join("\n"),
  );
});

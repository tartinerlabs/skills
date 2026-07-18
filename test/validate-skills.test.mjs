import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
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

test("semantic-release commits every synced plugin manifest", async () => {
  const releaseConfig = JSON.parse(
    await readFile(new URL("../.releaserc.json", import.meta.url), "utf8"),
  );
  const gitPlugin = releaseConfig.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "@semantic-release/git",
  );
  const assets = gitPlugin?.[1]?.assets ?? [];

  for (const manifest of MANIFESTS) {
    assert.ok(assets.includes(manifest), `${manifest} is missing from assets`);
  }
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

test("flags an action that uses a mutable tag", async (t) => {
  const root = await buildFixture(t);
  await writeText(
    join(root, "skills/demo/rules/foo.md"),
    "# Foo\n\n```yaml\n- uses: actions/checkout@v7\n```\n",
  );
  const errors = await validate(root);
  assert.ok(
    errors.some(
      (e) =>
        e.includes("skills/demo/rules/foo.md:4") &&
        e.includes("full 40-character commit SHA"),
    ),
    errors.join("\n"),
  );
});

test("flags a pinned action without a readable ref comment", async (t) => {
  const root = await buildFixture(t);
  await writeText(
    join(root, "skills/demo/rules/foo.md"),
    "# Foo\n\n```yaml\n- uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0\n```\n",
  );
  const errors = await validate(root);
  assert.ok(
    errors.some(
      (e) =>
        e.includes("skills/demo/rules/foo.md:4") &&
        e.includes("version or source-ref comment"),
    ),
    errors.join("\n"),
  );
});

test("accepts pinned actions and full-SHA placeholders", async (t) => {
  const root = await buildFixture(t);
  await writeText(
    join(root, "skills/demo/rules/foo.md"),
    [
      "# Foo",
      "",
      "```yaml",
      "- uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0",
      "```",
      "",
      "Use `- uses: owner/action@<full-SHA>  # vX.Y.Z` for other actions.",
      "",
    ].join("\n"),
  );
  const errors = await validate(root);
  assert.deepEqual(
    errors,
    [],
    `expected no errors, got:\n${errors.join("\n")}`,
  );
});

test("allows mutable refs only in the action-pinning incorrect section", async (t) => {
  const root = await buildFixture(t);
  await writeText(
    join(root, "skills/github-actions/SKILL.md"),
    VALID_SKILL.replaceAll("demo", "github-actions").replaceAll(
      "rules/foo.md",
      "rules/action-pinning.md",
    ),
  );
  await writeText(
    join(root, "skills/github-actions/rules/action-pinning.md"),
    [
      "# Action Pinning",
      "",
      "### Incorrect",
      "",
      "- uses: actions/checkout@v7",
      "",
      "### Correct",
      "",
      "- uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0",
      "",
    ].join("\n"),
  );
  const errors = await validate(root);
  assert.deepEqual(
    errors,
    [],
    `expected no errors, got:\n${errors.join("\n")}`,
  );
});

test("scans yaml workflow files for mutable action refs", async (t) => {
  const root = await buildFixture(t);
  await writeText(
    join(root, ".github/workflows/ci.yaml"),
    "steps:\n  - uses: actions/checkout@v7\n",
  );
  const errors = await validate(root);
  assert.ok(
    errors.some(
      (e) =>
        e.includes(".github/workflows/ci.yaml:2") &&
        e.includes("full 40-character commit SHA"),
    ),
    errors.join("\n"),
  );
});

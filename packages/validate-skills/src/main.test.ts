// A one-to-one port of scripts/validate-skills/main_test.go: every Go test
// keeps its name and its assertions.

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, onTestFinished, test } from "vitest";
import {
  agentPluginManifest,
  agentPluginSchema,
  type Collection,
  countLines,
  marketplaces,
  maxCompatibilityLen,
  maxRuleLines,
  maxSkillLines,
  pluginManifests,
  validate,
} from "./main.ts";

const version = "1.0.0";

const demoDir = "plugins/workflow/skills/demo";

// The fixture ships a single skill (`demo`) in one collection plugin, standing
// in for the real collections table.
const fixtureCollections: Collection[] = [
  { name: "workflow", skills: ["demo"] },
];

// Every fixture-backed validate call swaps the real collections table for the
// fixture's one-collection stand-in.
function validateFixture(root: string): string[] {
  return validate(root, fixtureCollections);
}

const validSkill = [
  "---",
  "name: demo",
  "description: A demo skill for tests.",
  "license: MIT",
  "allowed-tools: Read Bash(git:*)",
  "model: haiku",
  "effort: low",
  "compatibility: Requires git",
  "metadata:",
  "  short-description: A demo skill.",
  "---",
  "",
  "You are a demo skill. Read `rules/foo.md` before proceeding.",
  "",
  "| Rule | File |",
  "|------|------|",
  "| Foo | `rules/foo.md` |",
  "",
].join("\n");

function writeJSONFile(path: string, value: unknown): void {
  writeTextFile(path, JSON.stringify(value, null, 2));
}

function writeTextFile(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function mustSymlink(target: string, link: string): void {
  symlinkSync(target, link);
}

function mustRemove(path: string): void {
  rmSync(path);
}

function removeAll(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

// Go's strings.Replace with a count of 1, and strings.ReplaceAll. The
// replacement is a function so `$` in it is never read as a pattern.
function replaceOnce(source: string, old: string, replacement: string): string {
  return source.replace(old, () => replacement);
}

function replaceAll(source: string, old: string, replacement: string): string {
  return source.replaceAll(old, () => replacement);
}

// Build a minimal but fully valid repo so each test can mutate one thing.
function buildFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "validate-skills-"));
  onTestFinished(() => removeAll(root));

  writeJSONFile(join(root, ".release-please-manifest.json"), { ".": version });

  writeTextFile(join(root, demoDir, "SKILL.md"), validSkill);
  writeTextFile(join(root, demoDir, "rules/foo.md"), "# Foo\n");

  mkdirSync(join(root, "xcode-skills/sample"), { recursive: true });

  for (const manifest of pluginManifests) {
    const name = manifest.split("/")[1];
    const fields: Record<string, string> = { name, version };
    if (manifest === agentPluginManifest(name)) {
      fields.$schema = agentPluginSchema;
    }
    writeJSONFile(join(root, manifest), fields);
  }
  for (const marketplace of marketplaces) {
    writeJSONFile(join(root, marketplace), {
      name: "tartinerlabs",
      plugins: [],
    });
  }

  mustSymlink("../../xcode-skills", join(root, "plugins/xcode-skills/skills"));

  return root;
}

function assertNoErrors(errors: string[]): void {
  if (errors.length !== 0) {
    expect.fail(`expected no errors, got:\n${errors.join("\n")}`);
  }
}

// assertSomeError fails unless at least one error contains every substring.
function assertSomeError(errors: string[], ...substrings: string[]): void {
  for (const error of errors) {
    if (substrings.every((substring) => error.includes(substring))) {
      return;
    }
  }
  expect.fail(
    `no error matching ${JSON.stringify(substrings)} in:\n${errors.join("\n")}`,
  );
}

test("TestPassesOnValidFixture", () => {
  const root = buildFixture();
  assertNoErrors(validateFixture(root));
});

// writeDemoSkill rewrites the fixture's demo SKILL.md with one frontmatter
// line replaced (or dropped, when replacement is empty).
function writeDemoSkill(root: string, line: string, replacement: string): void {
  if (!validSkill.includes(`${line}\n`)) {
    expect.fail(`fixture skill has no line ${JSON.stringify(line)}`);
  }
  const source = replaceOnce(validSkill, `${line}\n`, replacement);
  writeTextFile(join(root, demoDir, "SKILL.md"), source);
}

describe("TestFlagsSkillMissingPortableFrontmatter", () => {
  for (const testCase of [
    {
      name: "license",
      line: "license: MIT",
      wantErr: "frontmatter missing `license`",
    },
    {
      name: "compatibility",
      line: "compatibility: Requires git",
      wantErr: "frontmatter missing `compatibility`",
    },
    {
      name: "description",
      line: "description: A demo skill for tests.",
      wantErr: "frontmatter missing `description`",
    },
    {
      name: "short-description",
      line: "  short-description: A demo skill.",
      wantErr: "frontmatter missing `metadata.short-description`",
    },
  ]) {
    test(testCase.name, () => {
      const root = buildFixture();
      writeDemoSkill(root, testCase.line, "");
      assertSomeError(validateFixture(root), testCase.wantErr);
    });
  }
});

test("TestFlagsSkillNameNotMatchingDirectory", () => {
  const root = buildFixture();
  writeDemoSkill(root, "name: demo", "name: not-demo\n");
  assertSomeError(
    validateFixture(root),
    "frontmatter `name: not-demo` does not match directory name",
  );
});

test("TestFlagsSkillWithoutFrontmatterBlock", () => {
  const root = buildFixture();
  writeTextFile(
    join(root, demoDir, "SKILL.md"),
    "Read `rules/foo.md` before proceeding.\n",
  );
  assertSomeError(
    validateFixture(root),
    "SKILL.md has no YAML frontmatter block",
  );
});

test("TestFlagsOverlongCompatibility", () => {
  const root = buildFixture();
  writeDemoSkill(
    root,
    "compatibility: Requires git",
    `compatibility: ${"x".repeat(maxCompatibilityLen + 1)}\n`,
  );
  assertSomeError(
    validateFixture(root),
    "frontmatter `compatibility` is 501 characters",
  );
});

// Claude-only fields are ignored by other channels, so their absence must not
// fail validation.
test("TestAllowsSkillWithoutClaudeOnlyFields", () => {
  const root = buildFixture();
  writeDemoSkill(root, "model: haiku", "");
  assertNoErrors(validateFixture(root));
});

test("TestFlagsReferencedRuleFileThatDoesNotExist", () => {
  const root = buildFixture();
  mustRemove(join(root, demoDir, "rules/foo.md"));
  assertSomeError(
    validateFixture(root),
    "references `rules/foo.md` which does not exist",
  );
});

test("TestPassesWhenSkillReferencesExistingReferencesFile", () => {
  const root = buildFixture();
  writeTextFile(
    join(root, demoDir, "SKILL.md"),
    `${validSkill}\nSee \`references/python.md\` for the Python path.\n`,
  );
  writeTextFile(join(root, demoDir, "references/python.md"), "# Python\n");
  assertNoErrors(validateFixture(root));
});

test("TestFlagsReferencedReferencesFileThatDoesNotExist", () => {
  const root = buildFixture();
  writeTextFile(
    join(root, demoDir, "SKILL.md"),
    `${validSkill}\nSee \`references/python.md\` for the Python path.\n`,
  );
  assertSomeError(
    validateFixture(root),
    "references `references/python.md` which does not exist",
  );
});

test("TestFlagsOrphanedReferencesFile", () => {
  const root = buildFixture();
  writeTextFile(join(root, demoDir, "references/orphan.md"), "# Orphan\n");
  assertSomeError(
    validateFixture(root),
    "`references/orphan.md` is never referenced",
  );
});

test("TestIgnoresReferencesPlaceholderTemplates", () => {
  const root = buildFixture();
  writeTextFile(
    join(root, demoDir, "SKILL.md"),
    `${validSkill}\nLoad \`references/<lang>.md\` for the detected language.\n`,
  );
  // No references/ dir exists — a placeholder must not be treated as a real,
  // missing file.
  assertNoErrors(validateFixture(root));
});

test("TestFlagsPluginManifestVersionDrift", () => {
  const root = buildFixture();
  writeJSONFile(join(root, pluginManifests[0]), {
    name: pluginManifests[0].split("/")[1],
    version: "9.9.9",
  });
  assertSomeError(validateFixture(root), "version `9.9.9`", version);
});

test("TestReleasePleaseSyncsEveryPluginManifestViaExtraFiles", () => {
  const releaseConfig = JSON.parse(
    readFileSync(
      join(import.meta.dirname, "../../../release-please-config.json"),
      "utf8",
    ),
  ) as {
    packages: Record<
      string,
      { "extra-files": { type: string; path: string; jsonpath: string }[] }
    >;
  };

  const syncedJSONPaths = new Set<string>();
  for (const file of releaseConfig.packages["."]["extra-files"]) {
    if (file.type === "json" && file.jsonpath === "$.version") {
      syncedJSONPaths.add(file.path);
    }
  }

  for (const manifest of pluginManifests) {
    expect
      .soft(
        syncedJSONPaths.has(manifest),
        `${manifest} is missing from extra-files`,
      )
      .toBe(true);
  }
});

test("TestFlagsBrokenWrapperSymlink", () => {
  const root = buildFixture();
  mustRemove(join(root, "plugins/xcode-skills/skills"));
  mustSymlink(
    "../../does-not-exist",
    join(root, "plugins/xcode-skills/skills"),
  );
  assertSomeError(validateFixture(root), "plugins/xcode-skills/skills");
});

test("TestFlagsWrapperSymlinkWithWrongTarget", () => {
  const root = buildFixture();
  // Point at a valid, existing directory so only the target comparison can
  // catch the swap.
  mustRemove(join(root, "plugins/xcode-skills/skills"));
  mustSymlink("../workflow/skills", join(root, "plugins/xcode-skills/skills"));
  assertSomeError(
    validateFixture(root),
    "plugins/xcode-skills/skills",
    "expected `../../xcode-skills`",
  );
});

// Codex skips symlinks when it copies a plugin into its cache, so a symlinked
// skill installs as nothing at all.
test("TestFlagsSymlinkedSkillInsideCollection", () => {
  const root = buildFixture();
  writeTextFile(join(root, "shared/demo/SKILL.md"), validSkill);
  writeTextFile(join(root, "shared/demo/rules/foo.md"), "# Foo\n");
  removeAll(join(root, demoDir));
  mustSymlink("../../../shared/demo", join(root, demoDir));
  assertSomeError(validateFixture(root), `${demoDir}: symlink inside a plugin`);
});

test("TestFlagsSymlinkedFileAnywhereInCollection", () => {
  const root = buildFixture();
  writeTextFile(join(root, "agents/deps.md"), "# Deps\n");
  mkdirSync(join(root, "plugins/workflow/agents"), { recursive: true });
  mustSymlink(
    "../../../agents/deps.md",
    join(root, "plugins/workflow/agents/deps.md"),
  );
  assertSomeError(
    validateFixture(root),
    "plugins/workflow/agents/deps.md: symlink inside a plugin",
  );
});

test("TestFlagsMissingCollectionSkill", () => {
  const root = buildFixture();
  removeAll(join(root, demoDir));
  assertSomeError(
    validateFixture(root),
    "collections: lists `demo` which does not exist in plugins/workflow/skills/",
  );
});

test("TestFlagsSkillNotInCollectionsTable", () => {
  const root = buildFixture();
  const looseSkill = replaceAll(validSkill, "name: demo", "name: loose");
  writeTextFile(
    join(root, "plugins/workflow/skills/loose/SKILL.md"),
    looseSkill,
  );
  assertSomeError(
    validateFixture(root),
    "plugins/workflow/skills/loose: not part of the `workflow` collection",
  );
});

test("TestFlagsSkillAssignedToTwoCollections", () => {
  const root = buildFixture();
  const errors = validate(root, [
    { name: "workflow", skills: ["demo"] },
    { name: "quality", skills: ["demo"] },
  ]);
  assertSomeError(
    errors,
    "collections: `demo` assigned to both `workflow` and `quality`",
  );
});

test("TestFlagsCollectionWithoutSkillsDirectory", () => {
  const root = buildFixture();
  removeAll(join(root, "plugins/workflow/skills"));
  assertSomeError(
    validateFixture(root),
    "plugins/workflow/skills: directory not found",
  );
});

// Codex refuses to install a plugin whose root `plugin.json` is not a valid
// Agent Plugins manifest, so each rule is enforced before release.
describe("TestFlagsInvalidAgentPluginManifest", () => {
  for (const testCase of [
    {
      name: "unsupported schema",
      manifest: {
        $schema: "https://agent-plugins.org/schemas/1.1.0/plugin.schema.json",
        name: "workflow",
        version,
      },
      wantErr: "`$schema` must be",
    },
    {
      name: "wrong name",
      manifest: { $schema: agentPluginSchema, name: "other", version },
      wantErr: "`name` must be `workflow`",
    },
    {
      name: "unknown field",
      manifest: {
        $schema: agentPluginSchema,
        name: "workflow",
        version,
        skills: "./skills/",
      },
      wantErr: "`skills` is not an Agent Plugins manifest field",
    },
  ]) {
    test(testCase.name, () => {
      const root = buildFixture();
      writeJSONFile(
        join(root, "plugins/workflow/plugin.json"),
        testCase.manifest,
      );
      assertSomeError(
        validateFixture(root),
        "plugins/workflow/plugin.json",
        testCase.wantErr,
      );
    });
  }
});

test("TestFlagsActionUsingMutableTag", () => {
  const root = buildFixture();
  writeTextFile(
    join(root, demoDir, "rules/foo.md"),
    "# Foo\n\n```yaml\n- uses: actions/checkout@v7\n```\n",
  );
  assertSomeError(
    validateFixture(root),
    `${demoDir}/rules/foo.md:4`,
    "full 40-character commit SHA",
  );
});

test("TestFlagsPinnedActionWithoutRefComment", () => {
  const root = buildFixture();
  writeTextFile(
    join(root, demoDir, "rules/foo.md"),
    "# Foo\n\n```yaml\n- uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0\n```\n",
  );
  assertSomeError(
    validateFixture(root),
    `${demoDir}/rules/foo.md:4`,
    "version or source-ref comment",
  );
});

test("TestAcceptsPinnedActionsAndFullShaPlaceholders", () => {
  const root = buildFixture();
  writeTextFile(
    join(root, demoDir, "rules/foo.md"),
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
  assertNoErrors(validateFixture(root));
});

test("TestAllowsMutableRefsOnlyInActionPinningIncorrectSection", () => {
  const root = buildFixture();
  let githubActionsSkill = replaceAll(validSkill, "demo", "github-actions");
  githubActionsSkill = replaceAll(
    githubActionsSkill,
    "rules/foo.md",
    "rules/action-pinning.md",
  );
  writeTextFile(
    join(root, "plugins/workflow/skills/github-actions/SKILL.md"),
    githubActionsSkill,
  );
  writeTextFile(
    join(
      root,
      "plugins/workflow/skills/github-actions/rules/action-pinning.md",
    ),
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
  const errors = validate(root, [
    { name: "workflow", skills: ["demo", "github-actions"] },
  ]);
  assertNoErrors(errors);
});

test("TestScansYamlWorkflowFilesForMutableActionRefs", () => {
  const root = buildFixture();
  writeTextFile(
    join(root, ".github/workflows/ci.yaml"),
    "steps:\n  - uses: actions/checkout@v7\n",
  );
  assertSomeError(
    validateFixture(root),
    ".github/workflows/ci.yaml:2",
    "full 40-character commit SHA",
  );
});

// secondSkill builds a valid SKILL.md for an extra fixture skill, so the
// cross-skill checks have two skills to compare.
function secondSkill(name: string, body: string): string {
  return [
    "---",
    `name: ${name}`,
    "description: Another demo skill for tests.",
    "license: MIT",
    "allowed-tools: Read",
    "model: haiku",
    "effort: low",
    "compatibility: Requires nothing",
    "metadata:",
    "  short-description: Another demo skill.",
    "---",
    "",
    body,
    "",
    "| Rule | File |",
    "|------|------|",
    "| Bar | `rules/bar.md` |",
    "",
  ].join("\n");
}

// addSecondSkill writes a second skill into the fixture's collection.
function addSecondSkill(root: string, name: string, body: string): void {
  writeTextFile(
    join(root, "plugins/workflow/skills", name, "SKILL.md"),
    secondSkill(name, body),
  );
  writeTextFile(
    join(root, "plugins/workflow/skills", name, "rules/bar.md"),
    "# Bar\n",
  );
}

function twoSkillCollections(name: string): Collection[] {
  return [{ name: "workflow", skills: ["demo", name] }];
}

test("TestFlagsEagerLoadAllRulesPhrasing", () => {
  const root = buildFixture();
  writeTextFile(
    join(root, demoDir, "SKILL.md"),
    replaceOnce(
      validSkill,
      "You are a demo skill. Read `rules/foo.md` before proceeding.",
      "Read ALL rule files before proceeding — do not skip or ask:",
    ),
  );
  assertSomeError(
    validateFixture(root),
    demoDir,
    "instructs an unconditional read",
  );
});

// The false-positive boundary: the install and generate skills legitimately
// tell the agent to read each rule file, because they apply every one.
test("TestAllowsPerStepRuleReferences", () => {
  const root = buildFixture();
  writeTextFile(
    join(root, demoDir, "SKILL.md"),
    replaceOnce(
      validSkill,
      "You are a demo skill. Read `rules/foo.md` before proceeding.",
      "Read each rule file in `rules/` for detailed setup instructions.",
    ),
  );
  assertNoErrors(validateFixture(root));
});

// Hard-stop phrasing is sanctioned on its own — commit refuses to proceed on a
// secret-scanner hit — so it is only eager loading when a read instruction
// shares the line.
test("TestAllowsHardStopPhrasingWithoutReadInstruction", () => {
  const root = buildFixture();
  writeTextFile(
    join(root, demoDir, "SKILL.md"),
    replaceOnce(
      validSkill,
      "You are a demo skill. Read `rules/foo.md` before proceeding.",
      "STOP if the scanner reports a leak. Do not skip or ask — the commit is refused.",
    ),
  );
  assertNoErrors(validateFixture(root));
});

test("TestFlagsSkillFileOverLineBudget", () => {
  const root = buildFixture();
  const padding = "\nFiller prose line.".repeat(maxSkillLines);
  writeTextFile(
    join(root, demoDir, "SKILL.md"),
    `${validSkill}${padding}\n`,
  );
  assertSomeError(validateFixture(root), demoDir, "SKILL.md is", "max 125");
});

test("TestAllowsSkillFileAtLineBudget", () => {
  const root = buildFixture();
  let source = validSkill;
  while (countLines(source) < maxSkillLines) {
    source += "Filler prose line.\n";
  }
  const got = countLines(source);
  if (got !== maxSkillLines) {
    expect.fail(
      `fixture setup: got ${got} lines, want exactly ${maxSkillLines}`,
    );
  }
  writeTextFile(join(root, demoDir, "SKILL.md"), source);
  assertNoErrors(validateFixture(root));
});

test("TestFlagsOversizedRuleFile", () => {
  const root = buildFixture();
  writeTextFile(
    join(root, demoDir, "rules/foo.md"),
    `# Foo\n${"Filler prose line.\n".repeat(maxRuleLines)}`,
  );
  assertSomeError(validateFixture(root), demoDir, "rules/foo.md is", "max 150");
});

test("TestFlagsBlockDuplicatedAcrossSkills", () => {
  const root = buildFixture();
  const shared = [
    "Classify the request before acting, and default to read-only when the",
    "intent is ambiguous or diagnostic. Produce an evidence-backed report",
    "and make no file edits at all.",
  ].join("\n");
  writeTextFile(
    join(root, demoDir, "SKILL.md"),
    `${validSkill}\n${shared}\n`,
  );
  addSecondSkill(root, "other", shared);
  assertSomeError(
    validate(root, twoSkillCollections("other")),
    "block duplicated from",
  );
});

// Frontmatter is blanked rather than cut, so the reported offset points at the
// block's real line in the file rather than several lines above it.
test("TestDuplicateBlockReportsRealLineNumber", () => {
  const root = buildFixture();
  const shared = [
    "Classify the request before acting, and default to read-only when the",
    "intent is ambiguous or diagnostic. Produce an evidence-backed report",
    "and make no file edits at all.",
  ].join("\n");
  const source = `${validSkill}\n${shared}\n`;
  writeTextFile(join(root, demoDir, "SKILL.md"), source);
  addSecondSkill(root, "other", shared);

  const want =
    1 + source.slice(0, source.indexOf(shared)).split("\n").length - 1;
  assertSomeError(
    validate(root, twoSkillCollections("other")),
    `${demoDir}/SKILL.md:${want}`,
  );
});

// Within one skill, repetition is legitimate — the per-language references/
// guides restate a caveat with local context on purpose.
test("TestAllowsSameBlockRepeatedWithinOneSkill", () => {
  const root = buildFixture();
  const shared = [
    "Classify the request before acting, and default to read-only when the",
    "intent is ambiguous or diagnostic. Produce an evidence-backed report",
    "and make no file edits at all.",
  ].join("\n");
  writeTextFile(
    join(root, demoDir, "SKILL.md"),
    `${validSkill}\n${shared}\n`,
  );
  writeTextFile(join(root, demoDir, "rules/foo.md"), `# Foo\n\n${shared}\n`);
  assertNoErrors(validateFixture(root));
});

// A one-line shared fact is shared vocabulary, not a duplicated instruction.
test("TestAllowsShortSharedLineAcrossSkills", () => {
  const root = buildFixture();
  const shared =
    "Detect the package manager from the lockfile, in this order: pnpm, bun, yarn, npm. With no lockfile, ask.";
  writeTextFile(
    join(root, demoDir, "SKILL.md"),
    `${validSkill}\n${shared}\n`,
  );
  addSecondSkill(root, "other", shared);
  assertNoErrors(validate(root, twoSkillCollections("other")));
});

// Two skills quoting the same command is not duplicated guidance.
test("TestAllowsSharedFencedCodeAcrossSkills", () => {
  const root = buildFixture();
  const shared = [
    "```bash",
    "pip-audit                       # audit the current environment",
    "pip-audit -r requirements.txt   # audit a requirements file",
    "```",
  ].join("\n");
  writeTextFile(
    join(root, demoDir, "SKILL.md"),
    `${validSkill}\n${shared}\n`,
  );
  addSecondSkill(root, "other", shared);
  assertNoErrors(validate(root, twoSkillCollections("other")));
});

// The content budgets are scoped to collection skills; the generated xcode-skills/ export
// carries much larger Apple-authored files and must never be measured.
test("TestIgnoresContentBudgetsInXcodeExport", () => {
  const root = buildFixture();
  writeTextFile(
    join(root, "xcode-skills/sample/SKILL.md"),
    `# Sample\n${"Filler prose line.\n".repeat(maxSkillLines * 3)}`,
  );
  assertNoErrors(validateFixture(root));
});

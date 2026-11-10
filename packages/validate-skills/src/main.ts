// Command validate-skills checks the repository's skill structure, plugin
// manifests, plugin-root containment, and GitHub Action pinning discipline.
//
// Run from the repo root: node packages/validate-skills/src/main.ts
//
// A one-to-one port of scripts/validate-skills/main.go: same checks, same
// order, same error text.

import {
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  statSync,
} from "node:fs";
import { basename, join, relative, sep } from "node:path";

// Skill collections: each entry is a `plugins/<name>/` plugin whose
// `skills/<skill>/` directories hold the real skill files. A plugin must be
// self-contained — Codex drops symlinks when it copies a plugin into its cache,
// and the Agent Plugins spec has clients reject paths that resolve outside the
// plugin root. Membership is validated in validateCollections.
export type Collection = {
  name: string;
  skills: string[];
};

export const collections: Collection[] = [
  {
    name: "workflow",
    skills: [
      "clean-branches",
      "commit",
      "create-branch",
      "create-pr",
      "github-actions",
      "github-issues",
    ],
  },
  {
    name: "quality",
    skills: ["refactor", "naming-format", "project-structure", "i18n"],
  },
  { name: "security", skills: ["security", "deps"] },
  { name: "tooling", skills: ["setup", "testing", "update-project"] },
  {
    name: "design",
    skills: [
      "ux-psychology",
      "visual-design",
      "apple-featuring",
      "accessibility",
    ],
  },
];

// Each collection carries a root `plugin.json` per the Agent Plugins spec
// (agent-plugins.org). 1.0.0 is pinned deliberately: it is the only version
// Codex accepts, and a client must reject a version it does not support.
export const agentPluginSchema =
  "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";

// The spec's manifest schema is closed — anything client-specific belongs
// under `extensions` or in the per-channel manifests.
const agentPluginFields = new Set([
  "$schema",
  "name",
  "version",
  "description",
  "author",
  "homepage",
  "repository",
  "license",
  "keywords",
  "extensions",
]);

export function agentPluginManifest(name: string): string {
  return `plugins/${name}/plugin.json`;
}

function collectionSkillsDir(name: string): string {
  return `plugins/${name}/skills`;
}

// Plugin manifests whose `version` release-please keeps in sync with the
// released version (via `extra-files` in release-please-config.json).
export const pluginManifests = manifestPaths();

function manifestPaths(): string[] {
  const plugins: string[] = [];
  const manifests: string[] = [];
  for (const coll of collections) {
    plugins.push(coll.name);
    manifests.push(agentPluginManifest(coll.name));
  }
  plugins.push("xcode-skills");

  for (const plugin of plugins) {
    for (const channel of [
      ".codex-plugin",
      ".claude-plugin",
      ".cursor-plugin",
      ".antigravity-plugin",
    ]) {
      manifests.push(`plugins/${plugin}/${channel}/plugin.json`);
    }
  }
  return manifests;
}

// A skill's name plus its directory relative to the repo root, used both to
// read it and to label every error about it.
type SkillRef = {
  name: string;
  dir: string;
};

// Marketplace manifests distributed alongside the plugin manifests.
export const marketplaces = [
  ".claude-plugin/marketplace.json",
  ".cursor-plugin/marketplace.json",
  ".agents/plugins/marketplace.json",
];

// The xcode-skills wrapper exposes the untouched Xcode export through one
// `skills` symlink, whose exact destination is checked.
const wrapperSymlinks = [
  { path: "plugins/xcode-skills/skills", target: "../../xcode-skills" },
];

// `xcode-skills/` is a generated Xcode export — its skill content is
// deliberately excluded from the rules checks below. Only the
// `plugins/xcode-skills` manifests (in pluginManifests) are validated.
const actionPinningRule =
  "plugins/workflow/skills/github-actions/rules/action-pinning.md";

// Go's `\s` is ASCII-only and its `.` matches `\r`, so the patterns spell out
// `[\t\n\f\r ]` and `[^\n]` instead of JavaScript's wider `\s` and narrower `.`.
const actionUseRE =
  /\buses:[\t\n\f\r ]*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*)@([^\t\n\f\r `]+)/g;
const fullCommitShaRE = /^[a-f0-9]{40}$/i;
const refCommentRE = /^[\t\n\f\r ]+#[\t\n\f\r ]+[^\t\n\f\r ]/;
const rulesRefRE = /rules\/([A-Za-z0-9][A-Za-z0-9-]*)\.md/g;
const referencesRefRE = /references\/([A-Za-z0-9][A-Za-z0-9-]*)\.md/g;
const skillNameRE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const topLevelKeyRE = /^([A-Za-z][A-Za-z0-9_-]*):(?:[\t\n\f\r ]+([^\n]*))?$/;
const nestedKeyRE =
  /^[\t\n\f\r ]+([A-Za-z][A-Za-z0-9_-]*):(?:[\t\n\f\r ]+([^\n]*))?$/;

// Up-front "read everything" phrasing defeats progressive disclosure: the
// rules table plus the workflow steps already say what to read when.
// Deliberately narrow — "read each rule file" is legitimate in the
// install/generate skills, which genuinely apply every rule. The second
// alternative stays bound to a read instruction on the same line: hard-stop
// phrasing like "do not skip or ask" is sanctioned on its own, and commit's
// refusal on a secret-scanner hit relies on it.
const eagerLoadRE =
  /\bread (all|every) [^.\n]{0,40}\b(rule|reference) files?\b|\bread\b[^\n]{0,60}\bdo not skip or ask\b/iu;

// Frontmatter limits from the Agent Skills spec (agentskills.io/specification).
const maxDescriptionLen = 1024;
export const maxCompatibilityLen = 500;
const maxSkillNameLen = 64;

// Content budgets, measured like `wc -l`. SKILL.md is the always-loaded entry
// point, so detail belongs in rules/ or references/ instead. Both ceilings sit
// just above the current maxima — raise them only with a reason, since the
// point is to make growth deliberate. Scoped to collection skills: the generated
// xcode-skills/ export carries much larger Apple-authored files.
export const maxSkillLines = 125;
export const maxRuleLines = 150;

// Thresholds for the cross-skill duplicate-block check. Below these a repeated
// block is a shared command or a table row, not a duplicated instruction.
//
// dupMinLines is what keeps the check honest. The target is copy-pasted policy
// and report templates — multi-line blocks. Two skills stating the same
// one-line fact ("detect the package manager from the lockfile") are sharing
// vocabulary, not duplicating an instruction, and they cannot factor it out
// anyway: each skill ships on its own.
const dupMinChars = 80;
const dupMinTokens = 12;
const dupMinLines = 3;

// The characters Go's unicode.IsSpace accepts, so trimming and splitting
// behave exactly as strings.TrimSpace and strings.Fields do.
const space =
  "\\t\\n\\v\\f\\r \\u0085\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000";
const trimSpaceRE = new RegExp(`^[${space}]+|[${space}]+$`, "g");
const fieldRE = new RegExp(`[^${space}]+`, "g");

function trimSpace(text: string): string {
  return text.replace(trimSpaceRE, "");
}

function fields(text: string): string[] {
  return text.match(fieldRE) ?? [];
}

// Go measures a string in bytes, and the limits below were set that way.
function byteLength(text: string): number {
  return Buffer.byteLength(text);
}

// Go sorts strings by their UTF-8 bytes, which is code point order; the
// default JavaScript sort compares UTF-16 units and differs above U+FFFF.
function compareBytes(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a), Buffer.from(b));
}

function count(text: string, substring: string): number {
  return text.split(substring).length - 1;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// Go's `%q`, so the duplicate-block excerpt reads the same in both validators.
function quote(text: string): string {
  const escapes: Record<string, string> = {
    "\x07": "\\a",
    "\b": "\\b",
    "\f": "\\f",
    "\n": "\\n",
    "\r": "\\r",
    "\t": "\\t",
    "\v": "\\v",
    '"': '\\"',
    "\\": "\\\\",
  };
  let quoted = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const hex = (width: number) => code.toString(16).padStart(width, "0");
    if (escapes[char] !== undefined) {
      quoted += escapes[char];
    } else if (/[\p{L}\p{M}\p{N}\p{P}\p{S} ]/u.test(char)) {
      quoted += char;
    } else if (code < 0x80) {
      quoted += `\\x${hex(2)}`;
    } else if (code < 0x10000) {
      quoted += `\\u${hex(4)}`;
    } else {
      quoted += `\\U${hex(8)}`;
    }
  }
  return `"${quoted}"`;
}

function pathExists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

// Directory entries sorted by name, as Go's os.ReadDir returns them.
function readDir(dir: string) {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    compareBytes(a.name, b.name),
  );
}

type WalkEntry = {
  name: string;
  isDir: boolean;
  isSymlink: boolean;
};

// Go's filepath.WalkDir: visits the root and everything under it in lexical
// order, does not follow symlinks, and skips what it cannot read.
function walkDir(
  root: string,
  visit: (path: string, entry: WalkEntry) => void,
): void {
  const walk = (path: string, entry: WalkEntry) => {
    visit(path, entry);
    if (!entry.isDir) {
      return;
    }
    let entries: ReturnType<typeof readDir>;
    try {
      entries = readDir(path);
    } catch {
      return;
    }
    for (const child of entries) {
      walk(join(path, child.name), {
        name: child.name,
        isDir: child.isDirectory(),
        isSymlink: child.isSymbolicLink(),
      });
    }
  };

  let stats: ReturnType<typeof lstatSync>;
  try {
    stats = lstatSync(root);
  } catch {
    return;
  }
  walk(root, {
    name: basename(root),
    isDir: stats.isDirectory(),
    isSymlink: stats.isSymbolicLink(),
  });
}

function readJSON(
  root: string,
  relPath: string,
  errors: string[],
): Record<string, unknown> | null {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(join(root, relPath), "utf8"));
  } catch (error) {
    errors.push(`${relPath}: not valid JSON (${errorText(error)})`);
    return null;
  }
  // Go decodes a JSON `null` into a nil map without an error.
  if (value === null) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${relPath}: not valid JSON (expected an object)`);
    return null;
  }
  return value as Record<string, unknown>;
}

function collectFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  if (!pathExists(dir)) {
    return files;
  }
  walkDir(dir, (path, entry) => {
    if (entry.isDir) {
      return;
    }
    if (extensions.some((extension) => entry.name.endsWith(extension))) {
      files.push(path);
    }
  });
  return files;
}

function relativePath(root: string, file: string): string {
  return relative(root, file).replaceAll(sep, "/");
}

function checkActionUses(
  root: string,
  file: string,
  source: string,
  errors: string[],
): void {
  const relPath = relativePath(root, file);
  let allowMutableExample = false;

  for (const [index, line] of source.split("\n").entries()) {
    if (relPath === actionPinningRule && line.startsWith("### ")) {
      allowMutableExample = line === "### Incorrect";
    }

    for (const match of line.matchAll(actionUseRE)) {
      const [whole, action, ref] = match;
      if (allowMutableExample || ref === "<full-SHA>") {
        continue;
      }

      const location = `${relPath}:${index + 1}`;
      if (!fullCommitShaRE.test(ref)) {
        errors.push(
          `${location}: \`${action}@${ref}\` must use a full 40-character commit SHA`,
        );
        continue;
      }

      const remainder = line.slice(match.index + whole.length);
      if (!refCommentRE.test(remainder)) {
        errors.push(
          `${location}: \`${action}@${ref}\` must include a version or source-ref comment`,
        );
      }
    }
  }
}

function validateActionPinning(
  root: string,
  skills: SkillRef[],
  errors: string[],
): void {
  const files: string[] = [];
  for (const skill of skills) {
    files.push(...collectFiles(join(root, skill.dir), [".md"]));
  }
  files.push(
    ...collectFiles(join(root, ".github/workflows"), [".yml", ".yaml"]),
  );

  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch (error) {
      errors.push(`${file}: ${errorText(error)}`);
      continue;
    }
    checkActionUses(root, file, source, errors);
  }
}

// Collect every rule file name a SKILL.md refers to, from explicit
// `rules/<name>.md` paths in a table's File column.
function extractReferencedRules(source: string): Set<string> {
  return new Set(Array.from(source.matchAll(rulesRefRE), (match) => match[1]));
}

// Collect literal `references/<name>.md` paths a SKILL.md refers to. Used for
// `references/` (progressive-disclosure guides). Template placeholders such as
// `references/<lang>.md` contain `<`, which is outside the character class, so
// they are simply ignored rather than treated as a real (missing) file.
function extractReferencedFiles(source: string): Set<string> {
  return new Set(
    Array.from(source.matchAll(referencesRefRE), (match) => match[1]),
  );
}

function sortedKeys(set: Set<string>): string[] {
  return [...set].sort(compareBytes);
}

// Compare the `<name>.md` files present in `<skillDir>/<subdir>` against the
// set referenced by SKILL.md, appending an error for every missing reference
// and every orphaned file.
function checkSubdir(
  root: string,
  skill: SkillRef,
  subdir: string,
  referenced: Set<string>,
  errors: string[],
): void {
  const dir = join(root, skill.dir, subdir);
  const fileSet = new Set<string>();
  if (pathExists(dir)) {
    let entries: ReturnType<typeof readDir> = [];
    try {
      entries = readDir(dir);
    } catch {
      // An unreadable directory is treated as empty.
    }
    for (const entry of entries) {
      if (!entry.name.endsWith(".md")) {
        continue;
      }
      fileSet.add(entry.name.slice(0, -".md".length));
      let data: string;
      try {
        data = readFileSync(join(dir, entry.name), "utf8");
      } catch {
        continue;
      }
      const lines = countLines(data);
      if (lines > maxRuleLines) {
        errors.push(
          `${skill.dir}: ${subdir}/${entry.name} is ${lines} lines (max ${maxRuleLines}) — split it or trim the examples`,
        );
      }
    }
  }

  for (const name of sortedKeys(referenced)) {
    if (!fileSet.has(name)) {
      errors.push(
        `${skill.dir}: references \`${subdir}/${name}.md\` which does not exist`,
      );
    }
  }
  for (const name of sortedKeys(fileSet)) {
    if (!referenced.has(name)) {
      errors.push(
        `${skill.dir}: \`${subdir}/${name}.md\` is never referenced in SKILL.md (orphan)`,
      );
    }
  }
}

// parseFrontmatter splits a SKILL.md into its YAML frontmatter keys. Only the
// shapes this repo actually uses are understood: top-level `key: value` pairs
// plus one level of indented nesting (used by `metadata:`). Nested keys are
// returned dotted, e.g. `metadata.short-description`. Returns null when the
// document has no frontmatter block.
function parseFrontmatter(source: string): Map<string, string> | null {
  if (!source.startsWith("---\n")) {
    return null;
  }
  const end = source.indexOf("\n---\n", 3);
  if (end < 0) {
    return null;
  }

  const parsed = new Map<string, string>();
  let parent = "";
  for (const line of source.slice(4, end + 1).split("\n")) {
    if (trimSpace(line) === "" || trimSpace(line).startsWith("#")) {
      continue;
    }
    const topLevel = topLevelKeyRE.exec(line);
    if (topLevel !== null) {
      parent = topLevel[1];
      parsed.set(topLevel[1], trimSpace(topLevel[2] ?? ""));
      continue;
    }
    const nested = nestedKeyRE.exec(line);
    if (nested !== null && parent !== "") {
      parsed.set(`${parent}.${nested[1]}`, trimSpace(nested[2] ?? ""));
    }
  }
  return parsed;
}

// Every skill must carry the portable Agent Skills metadata that non-Claude
// distribution channels actually read: `name`/`description` (universal),
// `license` and `compatibility` (spec-optional but repo-mandatory), and
// `metadata.short-description` — the only field beyond name/description that
// Codex's skill loader parses. The Claude-only fields (`model`, `effort`,
// `context`, `agent`) are deliberately unchecked; other clients ignore them.
function validateFrontmatter(
  skill: SkillRef,
  source: string,
  errors: string[],
): void {
  const report = (message: string) => {
    errors.push(`${skill.dir}: ${message}`);
  };

  const parsed = parseFrontmatter(source);
  if (parsed === null) {
    report("SKILL.md has no YAML frontmatter block");
    return;
  }
  const field = (key: string) => parsed.get(key) ?? "";

  const name = field("name");
  if (name === "") {
    report("frontmatter missing `name`");
  } else if (name !== skill.name) {
    report(`frontmatter \`name: ${name}\` does not match directory name`);
  } else if (byteLength(name) > maxSkillNameLen || !skillNameRE.test(name)) {
    report(`frontmatter \`name: ${name}\` is not a valid Agent Skills name`);
  }

  const description = field("description");
  if (description === "") {
    report("frontmatter missing `description`");
  } else if (byteLength(description) > maxDescriptionLen) {
    report(
      `frontmatter \`description\` is ${byteLength(description)} characters (max ${maxDescriptionLen})`,
    );
  }

  if (field("license") === "") {
    report("frontmatter missing `license`");
  }

  const compatibility = field("compatibility");
  if (compatibility === "") {
    report("frontmatter missing `compatibility`");
  } else if (byteLength(compatibility) > maxCompatibilityLen) {
    report(
      `frontmatter \`compatibility\` is ${byteLength(compatibility)} characters (max ${maxCompatibilityLen})`,
    );
  }

  if (field("metadata.short-description") === "") {
    report("frontmatter missing `metadata.short-description`");
  }
}

// countLines matches `wc -l` for newline-terminated files.
export function countLines(source: string): number {
  return source.replace(/\n+$/, "").split("\n").length;
}

// Flag phrasing that tells the agent to read every rule file up front, which
// loads a skill's whole rules/ directory on every invocation.
function checkEagerLoad(
  skill: SkillRef,
  source: string,
  errors: string[],
): void {
  for (const [index, line] of source.split("\n").entries()) {
    if (eagerLoadRE.test(line)) {
      errors.push(
        `${skill.dir}: SKILL.md:${index + 1} instructs an unconditional read of all rule files — reference each rule where the workflow needs it`,
      );
    }
  }
}

// SKILL.md must exist, carry the portable frontmatter checked in
// validateFrontmatter, stay within maxSkillLines, avoid eager-load phrasing,
// and have its referenced `rules/*.md` and `references/*.md` files resolve
// (with none left orphaned).
function validateSkill(root: string, skill: SkillRef, errors: string[]): void {
  const skillFile = join(root, skill.dir, "SKILL.md");
  if (!pathExists(skillFile)) {
    errors.push(`${skill.dir}: missing SKILL.md`);
    return;
  }

  let source: string;
  try {
    source = readFileSync(skillFile, "utf8");
  } catch (error) {
    errors.push(`${skill.dir}: ${errorText(error)}`);
    return;
  }

  validateFrontmatter(skill, source, errors);
  checkEagerLoad(skill, source, errors);
  const lines = countLines(source);
  if (lines > maxSkillLines) {
    errors.push(
      `${skill.dir}: SKILL.md is ${lines} lines (max ${maxSkillLines}) — move detail into rules/ or references/`,
    );
  }
  checkSubdir(root, skill, "rules", extractReferencedRules(source), errors);
  checkSubdir(
    root,
    skill,
    "references",
    extractReferencedFiles(source),
    errors,
  );
}

function validatePlugins(
  root: string,
  colls: Collection[],
  errors: string[],
): void {
  const releaseManifest = readJSON(
    root,
    ".release-please-manifest.json",
    errors,
  );
  const expectedVersion = stringField(releaseManifest?.["."]);
  if (expectedVersion === "") {
    errors.push(".release-please-manifest.json: missing `.` version");
  }

  for (const manifestPath of pluginManifests) {
    const manifest = readJSON(root, manifestPath, errors);
    if (manifest === null) {
      continue;
    }
    const version = stringField(manifest.version);
    if (version === "") {
      errors.push(`${manifestPath}: missing version field`);
    } else if (expectedVersion !== "" && version !== expectedVersion) {
      errors.push(
        `${manifestPath}: version \`${version}\` does not match .release-please-manifest.json \`${expectedVersion}\``,
      );
    }
  }

  for (const marketplacePath of marketplaces) {
    readJSON(root, marketplacePath, errors);
  }

  for (const coll of colls) {
    validateAgentPluginManifest(root, coll.name, errors);
  }
}

// Codex treats a root `plugin.json` as an Agent Plugins manifest and refuses
// to install the plugin when it does not validate, so the closed schema is
// enforced here rather than discovered at install time.
function validateAgentPluginManifest(
  root: string,
  name: string,
  errors: string[],
): void {
  const manifestPath = agentPluginManifest(name);
  const manifest = readJSON(root, manifestPath, errors);
  if (manifest === null) {
    return;
  }
  if (stringField(manifest.$schema) !== agentPluginSchema) {
    errors.push(`${manifestPath}: \`$schema\` must be \`${agentPluginSchema}\``);
  }
  if (stringField(manifest.name) !== name) {
    errors.push(`${manifestPath}: \`name\` must be \`${name}\``);
  }
  for (const field of Object.keys(manifest).sort(compareBytes)) {
    if (!agentPluginFields.has(field)) {
      errors.push(
        `${manifestPath}: \`${field}\` is not an Agent Plugins manifest field — move it under \`extensions\` or a per-channel manifest`,
      );
    }
  }
}

function checkSymlink(
  root: string,
  linkPath: string,
  expectedTarget: string,
  errors: string[],
): void {
  const fullPath = join(root, linkPath);

  let isSymlink: boolean;
  try {
    isSymlink = lstatSync(fullPath).isSymbolicLink();
  } catch {
    errors.push(`${linkPath}: broken or missing symlink`);
    return;
  }
  if (!isSymlink) {
    errors.push(`${linkPath}: expected a symlink`);
    return;
  }
  let actualTarget: string;
  try {
    actualTarget = readlinkSync(fullPath);
  } catch {
    errors.push(`${linkPath}: broken or missing symlink`);
    return;
  }
  if (actualTarget !== expectedTarget) {
    errors.push(
      `${linkPath}: points at \`${actualTarget}\`, expected \`${expectedTarget}\``,
    );
    return;
  }
  let targetIsDir: boolean;
  try {
    targetIsDir = statSync(fullPath).isDirectory();
  } catch {
    errors.push(`${linkPath}: broken or missing symlink`);
    return;
  }
  if (!targetIsDir) {
    errors.push(`${linkPath}: symlink target is not a directory`);
  }
}

function validateSymlinks(root: string, errors: string[]): void {
  for (const link of wrapperSymlinks) {
    checkSymlink(root, link.path, link.target, errors);
  }
}

// Collection plugins must hold exactly their assigned skills as real
// directories, and each skill must belong to exactly one collection so a
// newly added skill cannot silently ship in none (or two) of the plugins.
// Returns the skills found, sorted by directory, for the per-skill checks.
function validateCollections(
  root: string,
  colls: Collection[],
  errors: string[],
): SkillRef[] {
  const assigned = new Map<string, string>();
  for (const coll of colls) {
    for (const skill of coll.skills) {
      const previous = assigned.get(skill);
      if (previous !== undefined) {
        errors.push(
          `collections: \`${skill}\` assigned to both \`${previous}\` and \`${coll.name}\``,
        );
      }
      assigned.set(skill, coll.name);
    }
  }

  const skills: SkillRef[] = [];
  for (const coll of colls) {
    const skillsDir = collectionSkillsDir(coll.name);
    let entries: ReturnType<typeof readDir>;
    try {
      entries = readDir(join(root, skillsDir));
    } catch {
      errors.push(`${skillsDir}: directory not found`);
      continue;
    }
    const expected = new Set(coll.skills);
    const present = new Set<string>();
    for (const entry of entries) {
      const dir = `${skillsDir}/${entry.name}`;
      present.add(entry.name);
      if (!expected.has(entry.name)) {
        errors.push(
          `${dir}: not part of the \`${coll.name}\` collection — add it to the collections table`,
        );
      } else if (entry.isSymbolicLink()) {
        // Reported by validateContainment.
      } else if (!entry.isDirectory()) {
        errors.push(`${dir}: expected a skill directory`);
      } else {
        skills.push({ name: entry.name, dir });
      }
    }
    for (const skill of coll.skills) {
      if (!present.has(skill)) {
        errors.push(
          `collections: lists \`${skill}\` which does not exist in ${skillsDir}/`,
        );
      }
    }
  }

  return skills.sort((a, b) => compareBytes(a.dir, b.dir));
}

// A collection plugin must not contain symlinks. Codex skips them when it
// copies the plugin into its cache (the skill silently vanishes), and Agent
// Plugins clients must reject any path that resolves outside the plugin root.
function validateContainment(
  root: string,
  colls: Collection[],
  errors: string[],
): void {
  for (const coll of colls) {
    walkDir(join(root, "plugins", coll.name), (path, entry) => {
      if (!entry.isSymlink) {
        return;
      }
      errors.push(
        `${relativePath(root, path)}: symlink inside a plugin — commit the real file; Codex drops symlinks on install`,
      );
    });
  }
}

// normaliseBlock collapses whitespace runs so that reflowed copies of the same
// paragraph still compare equal. Case is kept: exact-after-normalisation is
// predictable, where fuzzy matching produces false positives faster than it
// finds real duplication.
function normaliseBlock(block: string): string {
  return fields(block).join(" ");
}

// stripFences blanks out fenced code blocks, keeping line numbering intact.
//
// Prose is the target. Two skills legitimately quote the same command — the
// `pip-audit` invocation belongs in both the security audit and the Python
// dependency guide — and neither is a duplicated instruction.
function stripFences(source: string): string {
  const lines = source.split("\n");
  let inFence = false;
  for (const [index, line] of lines.entries()) {
    if (trimSpace(line).startsWith("```")) {
      inFence = !inFence;
      lines[index] = "";
      continue;
    }
    if (inFence) {
      lines[index] = "";
    }
  }
  return lines.join("\n");
}

// Report prose blocks repeated verbatim across two different skills. Each skill
// ships independently (per collection, and individually via skills.sh), so
// shared text cannot be factored out — it has to be written once, in the skill
// that owns the rule.
//
// Only cross-skill repeats are errors. Within a single skill, repetition is
// often legitimate: the per-language references/ guides restate a caveat with
// local context on purpose.
//
// Two limitations to accept rather than engineer around. Only byte-identical
// blocks are caught, so a reworded near-duplicate (six report templates with
// different row labels) still needs a human eye. And fenced code is excluded,
// so a shared command is never reported. Both bounds keep the check quiet
// enough to be trusted; widening either produces false positives faster than
// true ones.
function validateDuplicateBlocks(
  root: string,
  skills: SkillRef[],
  errors: string[],
): void {
  const seen = new Map<string, { skill: string; where: string }>();

  for (const skill of skills) {
    const files = collectFiles(join(root, skill.dir), [".md"]).sort(compareBytes);
    for (const file of files) {
      let source: string;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      // Blank the frontmatter rather than cutting it, so reported line
      // numbers stay anchored to the real file. stripFences below does
      // the same for fenced code.
      if (parseFrontmatter(source) !== null) {
        const cut = source.indexOf("\n---\n", 3) + "\n---\n".length;
        source =
          "\n".repeat(count(source.slice(0, cut), "\n")) + source.slice(cut);
      }

      source = stripFences(source);

      const relPath = relative(root, file);

      let lineNumber = 1;
      for (const block of source.split("\n\n")) {
        const startLine = lineNumber;
        lineNumber += count(block, "\n") + 2;

        const normalised = normaliseBlock(block);
        if (
          byteLength(normalised) < dupMinChars ||
          fields(normalised).length < dupMinTokens
        ) {
          continue;
        }
        if (trimSpace(block).split("\n").length < dupMinLines) {
          continue;
        }

        const where = `${relPath}:${startLine}`;
        const first = seen.get(normalised);
        if (first === undefined) {
          seen.set(normalised, { skill: skill.name, where });
          continue;
        }
        if (first.skill === skill.name) {
          continue;
        }
        const excerpt = Array.from(normalised).slice(0, 60).join("");
        errors.push(
          `${where}: block duplicated from ${first.where} (${quote(excerpt)}…) — keep one copy where the rule is defined`,
        );
      }
    }
  }
}

export function validate(root: string, colls: Collection[]): string[] {
  const errors: string[] = [];

  const skills = validateCollections(root, colls, errors);
  for (const skill of skills) {
    validateSkill(root, skill, errors);
  }

  validateDuplicateBlocks(root, skills, errors);
  validatePlugins(root, colls, errors);
  validateSymlinks(root, errors);
  validateContainment(root, colls, errors);
  validateActionPinning(root, skills, errors);

  return errors;
}

function main(): void {
  const root = process.argv[2] ?? ".";
  const errors = validate(root, collections);
  if (errors.length > 0) {
    console.error(
      `✖ Skill validation failed with ${errors.length} error(s):\n`,
    );
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log("✓ Skill validation passed");
}

if (import.meta.main) {
  main();
}

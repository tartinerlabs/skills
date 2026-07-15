import { access, lstat, readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { MANIFESTS } from "./sync-plugin-versions.mjs";

// Marketplace manifests distributed alongside the plugin manifests.
const MARKETPLACES = [
  ".claude-plugin/marketplace.json",
  ".cursor-plugin/marketplace.json",
  ".agents/plugins/marketplace.json",
];

// Plugin wrappers expose their skill source through a `skills` symlink.
const WRAPPER_SYMLINKS = [
  "plugins/tartinerlabs/skills",
  "plugins/xcode-skills/skills",
];

// `xcode-skills/` is a generated Xcode export — its skill content is
// deliberately excluded from the frontmatter/rules checks. Only the
// `plugins/xcode-skills` manifests (in MANIFESTS) are validated.
const SKILLS_DIR = "skills";

const REQUIRED_FIELDS = [
  "name",
  "description",
  "allowed-tools",
  "model",
  "effort",
];
const VALID_MODELS = new Set(["haiku", "sonnet"]);
const VALID_EFFORTS = new Set(["low", "medium", "high", "max"]);

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(root, relPath, errors) {
  const fullPath = join(root, relPath);
  try {
    return JSON.parse(await readFile(fullPath, "utf8"));
  } catch (error) {
    errors.push(`${relPath}: not valid JSON (${error.message})`);
    return null;
  }
}

// Extract the raw YAML frontmatter block delimited by the first pair of `---`.
function extractFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}

// Collect every rule file name a SKILL.md refers to. Two patterns are used
// across the collection:
//   1. Explicit `rules/<name>.md` paths in a table's File column.
//   2. Compact prefix tables (e.g. refactor) with a `` `general-` `` prefix
//      cell and a comma-separated suffix list — reconstructed as prefix+suffix.
function extractReferencedRules(source) {
  const names = new Set();

  for (const match of source.matchAll(
    /rules\/([A-Za-z0-9][A-Za-z0-9-]*)\.md/g,
  )) {
    names.add(match[1]);
  }

  for (const line of source.split("\n")) {
    if (!line.trimStart().startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((cell) => cell.replaceAll("`", "").trim());
    const prefixes = [];
    const suffixLists = [];
    for (const cell of cells) {
      if (/^[a-z0-9]+-$/.test(cell)) {
        prefixes.push(cell);
      } else if (cell.includes(",")) {
        const tokens = cell.split(",").map((token) => token.trim());
        if (tokens.every((token) => /^[a-z0-9][a-z0-9-]*$/.test(token))) {
          suffixLists.push(tokens);
        }
      }
    }
    for (const prefix of prefixes) {
      for (const tokens of suffixLists) {
        for (const token of tokens) names.add(prefix + token);
      }
    }
  }

  return names;
}

async function validateSkill(root, skillName, errors) {
  const skillDir = join(root, SKILLS_DIR, skillName);
  const skillFile = join(skillDir, "SKILL.md");
  if (!(await pathExists(skillFile))) {
    errors.push(`${SKILLS_DIR}/${skillName}: missing SKILL.md`);
    return;
  }

  const source = await readFile(skillFile, "utf8");
  const frontmatterBlock = extractFrontmatter(source);
  if (!frontmatterBlock) {
    errors.push(
      `${SKILLS_DIR}/${skillName}/SKILL.md: missing YAML frontmatter`,
    );
    return;
  }

  let frontmatter;
  try {
    frontmatter = parseYaml(frontmatterBlock);
  } catch (error) {
    errors.push(
      `${SKILLS_DIR}/${skillName}/SKILL.md: frontmatter is not valid YAML (${error.message})`,
    );
    return;
  }
  if (!frontmatter || typeof frontmatter !== "object") {
    errors.push(
      `${SKILLS_DIR}/${skillName}/SKILL.md: frontmatter is not a mapping`,
    );
    return;
  }

  const prefix = `${SKILLS_DIR}/${skillName}/SKILL.md`;
  for (const field of REQUIRED_FIELDS) {
    if (
      frontmatter[field] === undefined ||
      frontmatter[field] === null ||
      frontmatter[field] === ""
    ) {
      errors.push(`${prefix}: missing required field \`${field}\``);
    }
  }

  if (frontmatter.name !== undefined && frontmatter.name !== skillName) {
    errors.push(
      `${prefix}: name \`${frontmatter.name}\` does not match directory \`${skillName}\``,
    );
  }
  if (frontmatter.model !== undefined && !VALID_MODELS.has(frontmatter.model)) {
    errors.push(
      `${prefix}: model \`${frontmatter.model}\` must be one of ${[...VALID_MODELS].join(", ")}`,
    );
  }
  if (
    frontmatter.effort !== undefined &&
    !VALID_EFFORTS.has(frontmatter.effort)
  ) {
    errors.push(
      `${prefix}: effort \`${frontmatter.effort}\` must be one of ${[...VALID_EFFORTS].join(", ")}`,
    );
  }

  const hasContext = frontmatter.context !== undefined;
  const hasAgent = frontmatter.agent !== undefined;
  if (hasContext && frontmatter.context !== "fork") {
    errors.push(
      `${prefix}: context \`${frontmatter.context}\` must be \`fork\``,
    );
  }
  if (hasContext !== hasAgent) {
    errors.push(
      `${prefix}: \`context: fork\` and \`agent\` must appear together`,
    );
  }

  // Rules cross-checks: referenced files must exist, and no rule file may be
  // left unreferenced (orphaned).
  const referenced = extractReferencedRules(source);
  const rulesDir = join(skillDir, "rules");
  let ruleFiles = [];
  if (await pathExists(rulesDir)) {
    ruleFiles = (await readdir(rulesDir))
      .filter((entry) => entry.endsWith(".md"))
      .map((entry) => entry.slice(0, -3));
  }
  const ruleFileSet = new Set(ruleFiles);

  for (const name of referenced) {
    if (!ruleFileSet.has(name)) {
      errors.push(
        `${SKILLS_DIR}/${skillName}: references \`rules/${name}.md\` which does not exist`,
      );
    }
  }
  for (const name of ruleFiles) {
    if (!referenced.has(name)) {
      errors.push(
        `${SKILLS_DIR}/${skillName}: \`rules/${name}.md\` is never referenced in SKILL.md (orphan)`,
      );
    }
  }
}

async function validatePlugins(root, errors) {
  const pkg = await readJson(root, "package.json", errors);
  const expectedVersion = pkg?.version;
  if (!expectedVersion) {
    errors.push("package.json: missing version");
  }

  for (const manifestPath of MANIFESTS) {
    const manifest = await readJson(root, manifestPath, errors);
    if (!manifest) continue;
    if (!manifest.version) {
      errors.push(`${manifestPath}: missing version field`);
    } else if (expectedVersion && manifest.version !== expectedVersion) {
      errors.push(
        `${manifestPath}: version \`${manifest.version}\` does not match package.json \`${expectedVersion}\``,
      );
    }
  }

  for (const marketplacePath of MARKETPLACES) {
    await readJson(root, marketplacePath, errors);
  }
}

async function validateSymlinks(root, errors) {
  for (const symlinkPath of WRAPPER_SYMLINKS) {
    const fullPath = join(root, symlinkPath);
    try {
      const linkStat = await lstat(fullPath);
      if (!linkStat.isSymbolicLink()) {
        errors.push(`${symlinkPath}: expected a symlink`);
        continue;
      }
      const targetStat = await stat(fullPath);
      if (!targetStat.isDirectory()) {
        errors.push(`${symlinkPath}: symlink target is not a directory`);
      }
    } catch {
      errors.push(`${symlinkPath}: broken or missing symlink`);
    }
  }
}

export async function validate(root) {
  const errors = [];

  const skillsRoot = join(root, SKILLS_DIR);
  if (await pathExists(skillsRoot)) {
    const entries = await readdir(skillsRoot, { withFileTypes: true });
    const skillNames = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const skillName of skillNames) {
      await validateSkill(root, skillName, errors);
    }
  } else {
    errors.push(`${SKILLS_DIR}/: directory not found`);
  }

  await validatePlugins(root, errors);
  await validateSymlinks(root, errors);

  return errors;
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const errors = await validate(root);
  if (errors.length > 0) {
    console.error(
      `✖ Skill validation failed with ${errors.length} error(s):\n`,
    );
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }
  console.log("✓ Skill validation passed");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}

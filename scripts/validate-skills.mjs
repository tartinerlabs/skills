import {
  access,
  lstat,
  readdir,
  readFile,
  readlink,
  stat,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MANIFESTS } from "./sync-plugin-versions.mjs";

// Marketplace manifests distributed alongside the plugin manifests.
const MARKETPLACES = [
  ".claude-plugin/marketplace.json",
  ".cursor-plugin/marketplace.json",
  ".agents/plugins/marketplace.json",
];

// Plugin wrappers expose their skill source through a `skills` symlink that
// must point at a specific collection — swapping the targets would publish the
// wrong skills through that wrapper, so the exact destination is checked.
const WRAPPER_SYMLINKS = [
  { path: "plugins/tartinerlabs/skills", target: "../../skills" },
  { path: "plugins/xcode-skills/skills", target: "../../xcode-skills" },
];

// `xcode-skills/` is a generated Xcode export — its skill content is
// deliberately excluded from the rules checks below. Only the
// `plugins/xcode-skills` manifests (in MANIFESTS) are validated.
const SKILLS_DIR = "skills";

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

// Collect literal `<subdir>/<name>.md` paths a SKILL.md refers to. Used for
// `references/` (progressive-disclosure guides). Template placeholders such as
// `references/<lang>.md` contain `<`, which is outside the character class, so
// they are simply ignored rather than treated as a real (missing) file.
function extractReferencedFiles(source, subdir) {
  const names = new Set();
  const re = new RegExp(`${subdir}\\/([A-Za-z0-9][A-Za-z0-9-]*)\\.md`, "g");
  for (const match of source.matchAll(re)) {
    names.add(match[1]);
  }
  return names;
}

// Compare the `<name>.md` files present in `<skillDir>/<subdir>` against the
// set referenced by SKILL.md, pushing an error for every missing reference and
// every orphaned file. Returns nothing; mutates `errors`.
async function checkSubdir(skillDir, skillName, subdir, referenced, errors) {
  const dir = join(skillDir, subdir);
  let files = [];
  if (await pathExists(dir)) {
    files = (await readdir(dir))
      .filter((entry) => entry.endsWith(".md"))
      .map((entry) => entry.slice(0, -3));
  }
  const fileSet = new Set(files);

  for (const name of referenced) {
    if (!fileSet.has(name)) {
      errors.push(
        `${SKILLS_DIR}/${skillName}: references \`${subdir}/${name}.md\` which does not exist`,
      );
    }
  }
  for (const name of files) {
    if (!referenced.has(name)) {
      errors.push(
        `${SKILLS_DIR}/${skillName}: \`${subdir}/${name}.md\` is never referenced in SKILL.md (orphan)`,
      );
    }
  }
}

// Structure check only: SKILL.md exists and its referenced `rules/*.md` and
// `references/*.md` files resolve (and none are left orphaned). Frontmatter
// fields are not parsed or validated.
async function validateSkill(root, skillName, errors) {
  const skillDir = join(root, SKILLS_DIR, skillName);
  const skillFile = join(skillDir, "SKILL.md");
  if (!(await pathExists(skillFile))) {
    errors.push(`${SKILLS_DIR}/${skillName}: missing SKILL.md`);
    return;
  }

  const source = await readFile(skillFile, "utf8");

  await checkSubdir(
    skillDir,
    skillName,
    "rules",
    extractReferencedRules(source),
    errors,
  );
  await checkSubdir(
    skillDir,
    skillName,
    "references",
    extractReferencedFiles(source, "references"),
    errors,
  );
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
  for (const {
    path: symlinkPath,
    target: expectedTarget,
  } of WRAPPER_SYMLINKS) {
    const fullPath = join(root, symlinkPath);
    try {
      const linkStat = await lstat(fullPath);
      if (!linkStat.isSymbolicLink()) {
        errors.push(`${symlinkPath}: expected a symlink`);
        continue;
      }
      const actualTarget = await readlink(fullPath);
      if (actualTarget !== expectedTarget) {
        errors.push(
          `${symlinkPath}: points at \`${actualTarget}\`, expected \`${expectedTarget}\``,
        );
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

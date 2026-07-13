import { cp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = "xcode-skills";
const TARGET = "plugins/xcode-skills/skills-codex";

// Codex's plugin installer silently drops symlinked directories
// (openai/codex#24770), so the Codex manifest needs a real copy of
// xcode-skills/ instead of the skills symlink Claude/Cursor use.
export async function syncXcodeCodexSkills(cwd) {
  const source = join(cwd, SOURCE);
  const target = join(cwd, TARGET);
  await rm(target, { recursive: true, force: true });
  await cp(source, target, { recursive: true });
}

export async function prepare(_pluginConfig, { cwd }) {
  await syncXcodeCodexSkills(cwd);
}

const isMain =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  await syncXcodeCodexSkills(repoRoot);
}

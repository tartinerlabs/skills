import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const MANIFESTS = [
  "plugins/tartinerlabs/.codex-plugin/plugin.json",
  "plugins/tartinerlabs/.claude-plugin/plugin.json",
  "plugins/tartinerlabs/.cursor-plugin/plugin.json",
  "plugins/tartinerlabs/.antigravity-plugin/plugin.json",
  "plugins/xcode-skills/.codex-plugin/plugin.json",
  "plugins/xcode-skills/.claude-plugin/plugin.json",
  "plugins/xcode-skills/.cursor-plugin/plugin.json",
  "plugins/xcode-skills/.antigravity-plugin/plugin.json",
];
const VERSION_FIELD = /"version":\s*"[^"]+"/;

export async function prepare(_pluginConfig, { nextRelease, cwd }) {
  const version = nextRelease?.version;
  if (!version) {
    throw new Error("Missing nextRelease.version");
  }

  await Promise.all(
    MANIFESTS.map(async (manifestPath) => {
      const fullPath = join(cwd, manifestPath);
      const manifest = await readFile(fullPath, "utf8");
      JSON.parse(manifest);
      if (!VERSION_FIELD.test(manifest)) {
        throw new Error(`Missing version field in ${manifestPath}`);
      }
      const next = manifest.replace(VERSION_FIELD, `"version": "${version}"`);
      await writeFile(fullPath, next);
    }),
  );
}

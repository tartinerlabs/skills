import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MANIFESTS = [
  ".codex-plugin/plugin.json",
  ".claude-plugin/plugin.json",
  ".cursor-plugin/plugin.json",
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

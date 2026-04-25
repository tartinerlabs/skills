import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Plugin, tool } from "@opencode-ai/plugin";

const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../skills");

const parseFrontmatter = (md: string): { description: string } => {
  const match = md.match(/^---\n([\s\S]*?)\n---/);
  const body = match?.[1] ?? "";
  const desc = body.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
  return { description: desc };
};

const plugin: Plugin = async () => {
  const tools: Record<string, ReturnType<typeof tool>> = {};
  for (const name of readdirSync(SKILLS_DIR)) {
    const md = join(SKILLS_DIR, name, "SKILL.md");
    if (!statSync(md, { throwIfNoEntry: false })?.isFile()) continue;
    const content = readFileSync(md, "utf8");
    const { description } = parseFrontmatter(content);
    tools[`skills_${name.replace(/-/g, "_")}`] = tool({
      description: description || name,
      args: {},
      execute: async () => content,
    });
  }
  return { tool: tools };
};

export default plugin;

import { readdirSync, readFileSync } from "node:fs";
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
  for (const entry of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const md = join(SKILLS_DIR, entry.name, "SKILL.md");
    let content: string;
    try {
      content = readFileSync(md, "utf8");
    } catch {
      continue;
    }
    const { description } = parseFrontmatter(content);
    tools[`skills_${entry.name.replace(/-/g, "_")}`] = tool({
      description: description || entry.name,
      args: {},
      execute: async () => content,
    });
  }
  return { tool: tools };
};

export default plugin;

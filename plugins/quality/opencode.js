// OpenCode v2 plugin: registers this collection's skills.
// Installed with `opencode plugin add 'github:tartinerlabs/skills#main::path:plugins/quality'`.
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "skills")

export default {
  id: "tartinerlabs.quality",
  async setup(ctx) {
    const skills = readdirSync(root).map((id) => {
      const path = join(root, id, "SKILL.md")
      const [, frontmatter, content] = readFileSync(path, "utf8").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
      const description = frontmatter.match(/^description: (.*)$/m)[1]
      return { id, name: id, description, path, content }
    })
    await ctx.skill.transform((editor) => skills.forEach((skill) => editor.add(skill)))
  },
}

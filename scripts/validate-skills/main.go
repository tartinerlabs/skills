// Command validate-skills checks the repository's skill structure, plugin
// manifests, plugin-root containment, and GitHub Action pinning discipline.
//
// Run from the repo root: go run ./scripts/validate-skills
package main

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// Skill collections: each entry is a `plugins/<name>/` plugin whose
// `skills/<skill>/` directories hold the real skill files. A plugin must be
// self-contained — Codex drops symlinks when it copies a plugin into its cache,
// and the Agent Plugins spec has clients reject paths that resolve outside the
// plugin root. Membership is validated in validateCollections.
type collection struct {
	name   string
	skills []string
}

var collections = []collection{
	{name: "workflow", skills: []string{"clean-branches", "commit", "create-branch", "create-pr", "github-actions", "github-issues"}},
	{name: "quality", skills: []string{"refactor", "naming-format", "project-structure"}},
	{name: "security", skills: []string{"security", "deps"}},
	{name: "tooling", skills: []string{"setup", "testing", "update-project"}},
}

// Plugin manifests whose `version` release-please keeps in sync with the
// released version (via `extra-files` in release-please-config.json).
var pluginManifests = manifestPaths()

func manifestPaths() []string {
	plugins := make([]string, 0, len(collections)+1)
	var manifests []string
	for _, coll := range collections {
		plugins = append(plugins, coll.name)
		manifests = append(manifests, agentPluginManifest(coll.name))
	}
	plugins = append(plugins, "xcode-skills")

	for _, plugin := range plugins {
		for _, channel := range []string{".codex-plugin", ".claude-plugin", ".cursor-plugin", ".antigravity-plugin"} {
			manifests = append(manifests, fmt.Sprintf("plugins/%s/%s/plugin.json", plugin, channel))
		}
	}
	return manifests
}

// Each collection carries a root `plugin.json` per the Agent Plugins spec
// (agent-plugins.org). 1.0.0 is pinned deliberately: it is the only version
// Codex accepts, and a client must reject a version it does not support.
const agentPluginSchema = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"

// The spec's manifest schema is closed — anything client-specific belongs
// under `extensions` or in the per-channel manifests.
var agentPluginFields = map[string]bool{
	"$schema": true, "name": true, "version": true, "description": true, "author": true,
	"homepage": true, "repository": true, "license": true, "keywords": true, "extensions": true,
}

func agentPluginManifest(name string) string {
	return fmt.Sprintf("plugins/%s/plugin.json", name)
}

func collectionSkillsDir(name string) string {
	return fmt.Sprintf("plugins/%s/skills", name)
}

// A skill's name plus its directory relative to the repo root, used both to
// read it and to label every error about it.
type skillRef struct {
	name string
	dir  string
}

// Marketplace manifests distributed alongside the plugin manifests.
var marketplaces = []string{
	".claude-plugin/marketplace.json",
	".cursor-plugin/marketplace.json",
	".agents/plugins/marketplace.json",
}

// The xcode-skills wrapper exposes the untouched Xcode export through one
// `skills` symlink, whose exact destination is checked.
var wrapperSymlinks = []struct {
	path   string
	target string
}{
	{path: "plugins/xcode-skills/skills", target: "../../xcode-skills"},
}

// `xcode-skills/` is a generated Xcode export — its skill content is
// deliberately excluded from the rules checks below. Only the
// `plugins/xcode-skills` manifests (in pluginManifests) are validated.
const actionPinningRule = "plugins/workflow/skills/github-actions/rules/action-pinning.md"

var (
	actionUseRE     = regexp.MustCompile("\\buses:\\s*([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*)@([^\\s`]+)")
	fullCommitShaRE = regexp.MustCompile(`(?i)^[a-f0-9]{40}$`)
	refCommentRE    = regexp.MustCompile(`^\s+#\s+\S`)
	rulesRefRE      = regexp.MustCompile(`rules/([A-Za-z0-9][A-Za-z0-9-]*)\.md`)
	referencesRefRE = regexp.MustCompile(`references/([A-Za-z0-9][A-Za-z0-9-]*)\.md`)
	skillNameRE     = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	topLevelKeyRE   = regexp.MustCompile(`^([A-Za-z][A-Za-z0-9_-]*):(?:\s+(.*))?$`)
	nestedKeyRE     = regexp.MustCompile(`^\s+([A-Za-z][A-Za-z0-9_-]*):(?:\s+(.*))?$`)

	// Up-front "read everything" phrasing defeats progressive disclosure: the
	// rules table plus the workflow steps already say what to read when.
	// Deliberately narrow — "read each rule file" is legitimate in the
	// install/generate skills, which genuinely apply every rule. The second
	// alternative stays bound to a read instruction on the same line: hard-stop
	// phrasing like "do not skip or ask" is sanctioned on its own, and commit's
	// refusal on a secret-scanner hit relies on it.
	eagerLoadRE = regexp.MustCompile(`(?i)\bread (all|every) [^.\n]{0,40}\b(rule|reference) files?\b|\bread\b[^\n]{0,60}\bdo not skip or ask\b`)
)

// Frontmatter limits from the Agent Skills spec (agentskills.io/specification).
const (
	maxDescriptionLen   = 1024
	maxCompatibilityLen = 500
	maxSkillNameLen     = 64
)

// Content budgets, measured like `wc -l`. SKILL.md is the always-loaded entry
// point, so detail belongs in rules/ or references/ instead. Both ceilings sit
// just above the current maxima — raise them only with a reason, since the
// point is to make growth deliberate. Scoped to collection skills: the generated
// xcode-skills/ export carries much larger Apple-authored files.
const (
	maxSkillLines = 125
	maxRuleLines  = 150
)

// Thresholds for the cross-skill duplicate-block check. Below these a repeated
// block is a shared command or a table row, not a duplicated instruction.
//
// dupMinLines is what keeps the check honest. The target is copy-pasted policy
// and report templates — multi-line blocks. Two skills stating the same
// one-line fact ("detect the package manager from the lockfile") are sharing
// vocabulary, not duplicating an instruction, and they cannot factor it out
// anyway: each skill ships on its own.
const (
	dupMinChars  = 80
	dupMinTokens = 12
	dupMinLines  = 3
)

func pathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func readJSON(root, relPath string, errors *[]string) map[string]interface{} {
	data, err := os.ReadFile(filepath.Join(root, relPath))
	if err != nil {
		*errors = append(*errors, fmt.Sprintf("%s: not valid JSON (%s)", relPath, err))
		return nil
	}
	var value map[string]interface{}
	if err := json.Unmarshal(data, &value); err != nil {
		*errors = append(*errors, fmt.Sprintf("%s: not valid JSON (%s)", relPath, err))
		return nil
	}
	return value
}

func collectFiles(dir string, extensions []string) []string {
	if !pathExists(dir) {
		return nil
	}
	var files []string
	filepath.WalkDir(dir, func(path string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return nil
		}
		for _, extension := range extensions {
			if strings.HasSuffix(entry.Name(), extension) {
				files = append(files, path)
				break
			}
		}
		return nil
	})
	return files
}

func checkActionUses(root, file, source string, errors *[]string) {
	relPath, err := filepath.Rel(root, file)
	if err != nil {
		relPath = file
	}
	relPath = filepath.ToSlash(relPath)
	allowMutableExample := false

	for index, line := range strings.Split(source, "\n") {
		if relPath == actionPinningRule && strings.HasPrefix(line, "### ") {
			allowMutableExample = line == "### Incorrect"
		}

		for _, match := range actionUseRE.FindAllStringSubmatchIndex(line, -1) {
			action := line[match[2]:match[3]]
			ref := line[match[4]:match[5]]
			if allowMutableExample || ref == "<full-SHA>" {
				continue
			}

			location := fmt.Sprintf("%s:%d", relPath, index+1)
			if !fullCommitShaRE.MatchString(ref) {
				*errors = append(*errors, fmt.Sprintf(
					"%s: `%s@%s` must use a full 40-character commit SHA",
					location, action, ref))
				continue
			}

			remainder := line[match[1]:]
			if !refCommentRE.MatchString(remainder) {
				*errors = append(*errors, fmt.Sprintf(
					"%s: `%s@%s` must include a version or source-ref comment",
					location, action, ref))
			}
		}
	}
}

func validateActionPinning(root string, skills []skillRef, errors *[]string) {
	var files []string
	for _, skill := range skills {
		files = append(files, collectFiles(filepath.Join(root, skill.dir), []string{".md"})...)
	}
	files = append(files, collectFiles(filepath.Join(root, ".github/workflows"), []string{".yml", ".yaml"})...)

	for _, file := range files {
		source, err := os.ReadFile(file)
		if err != nil {
			*errors = append(*errors, fmt.Sprintf("%s: %s", file, err))
			continue
		}
		checkActionUses(root, file, string(source), errors)
	}
}

// Collect every rule file name a SKILL.md refers to, from explicit
// `rules/<name>.md` paths in a table's File column.
func extractReferencedRules(source string) map[string]bool {
	names := map[string]bool{}
	for _, match := range rulesRefRE.FindAllStringSubmatch(source, -1) {
		names[match[1]] = true
	}
	return names
}

// Collect literal `references/<name>.md` paths a SKILL.md refers to. Used for
// `references/` (progressive-disclosure guides). Template placeholders such as
// `references/<lang>.md` contain `<`, which is outside the character class, so
// they are simply ignored rather than treated as a real (missing) file.
func extractReferencedFiles(source string) map[string]bool {
	names := map[string]bool{}
	for _, match := range referencesRefRE.FindAllStringSubmatch(source, -1) {
		names[match[1]] = true
	}
	return names
}

func sortedKeys(set map[string]bool) []string {
	keys := make([]string, 0, len(set))
	for key := range set {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// Compare the `<name>.md` files present in `<skillDir>/<subdir>` against the
// set referenced by SKILL.md, appending an error for every missing reference
// and every orphaned file.
func checkSubdir(root string, skill skillRef, subdir string, referenced map[string]bool, errors *[]string) {
	dir := filepath.Join(root, skill.dir, subdir)
	fileSet := map[string]bool{}
	if pathExists(dir) {
		entries, err := os.ReadDir(dir)
		if err == nil {
			for _, entry := range entries {
				if !strings.HasSuffix(entry.Name(), ".md") {
					continue
				}
				fileSet[strings.TrimSuffix(entry.Name(), ".md")] = true
				if data, err := os.ReadFile(filepath.Join(dir, entry.Name())); err == nil {
					if lines := countLines(string(data)); lines > maxRuleLines {
						*errors = append(*errors, fmt.Sprintf(
							"%s: %s/%s is %d lines (max %d) — split it or trim the examples",
							skill.dir, subdir, entry.Name(), lines, maxRuleLines))
					}
				}
			}
		}
	}

	for _, name := range sortedKeys(referenced) {
		if !fileSet[name] {
			*errors = append(*errors, fmt.Sprintf(
				"%s: references `%s/%s.md` which does not exist",
				skill.dir, subdir, name))
		}
	}
	for _, name := range sortedKeys(fileSet) {
		if !referenced[name] {
			*errors = append(*errors, fmt.Sprintf(
				"%s: `%s/%s.md` is never referenced in SKILL.md (orphan)",
				skill.dir, subdir, name))
		}
	}
}

// parseFrontmatter splits a SKILL.md into its YAML frontmatter keys and the
// remaining body. Only the shapes this repo actually uses are understood:
// top-level `key: value` pairs plus one level of indented nesting (used by
// `metadata:`). Nested keys are returned dotted, e.g. `metadata.short-description`.
// Returns ok=false when the document has no frontmatter block.
func parseFrontmatter(source string) (fields map[string]string, ok bool) {
	if !strings.HasPrefix(source, "---\n") {
		return nil, false
	}
	end := strings.Index(source[3:], "\n---\n")
	if end < 0 {
		return nil, false
	}

	fields = map[string]string{}
	parent := ""
	for _, line := range strings.Split(source[4:3+end+1], "\n") {
		if strings.TrimSpace(line) == "" || strings.HasPrefix(strings.TrimSpace(line), "#") {
			continue
		}
		if match := topLevelKeyRE.FindStringSubmatch(line); match != nil {
			parent = match[1]
			fields[match[1]] = strings.TrimSpace(match[2])
			continue
		}
		if match := nestedKeyRE.FindStringSubmatch(line); match != nil && parent != "" {
			fields[parent+"."+match[1]] = strings.TrimSpace(match[2])
		}
	}
	return fields, true
}

// Every skill must carry the portable Agent Skills metadata that non-Claude
// distribution channels actually read: `name`/`description` (universal),
// `license` and `compatibility` (spec-optional but repo-mandatory), and
// `metadata.short-description` — the only field beyond name/description that
// Codex's skill loader parses. The Claude-only fields (`model`, `effort`,
// `context`, `agent`) are deliberately unchecked; other clients ignore them.
func validateFrontmatter(skill skillRef, source string, errors *[]string) {
	skillName := skill.name
	report := func(format string, args ...interface{}) {
		*errors = append(*errors, fmt.Sprintf("%s: %s",
			skill.dir, fmt.Sprintf(format, args...)))
	}

	fields, ok := parseFrontmatter(source)
	if !ok {
		report("SKILL.md has no YAML frontmatter block")
		return
	}

	switch name := fields["name"]; {
	case name == "":
		report("frontmatter missing `name`")
	case name != skillName:
		report("frontmatter `name: %s` does not match directory name", name)
	case len(name) > maxSkillNameLen || !skillNameRE.MatchString(name):
		report("frontmatter `name: %s` is not a valid Agent Skills name", name)
	}

	if description := fields["description"]; description == "" {
		report("frontmatter missing `description`")
	} else if len(description) > maxDescriptionLen {
		report("frontmatter `description` is %d characters (max %d)",
			len(description), maxDescriptionLen)
	}

	if fields["license"] == "" {
		report("frontmatter missing `license`")
	}

	if compatibility := fields["compatibility"]; compatibility == "" {
		report("frontmatter missing `compatibility`")
	} else if len(compatibility) > maxCompatibilityLen {
		report("frontmatter `compatibility` is %d characters (max %d)",
			len(compatibility), maxCompatibilityLen)
	}

	if fields["metadata.short-description"] == "" {
		report("frontmatter missing `metadata.short-description`")
	}
}

// countLines matches `wc -l` for newline-terminated files.
func countLines(source string) int {
	return len(strings.Split(strings.TrimRight(source, "\n"), "\n"))
}

// Flag phrasing that tells the agent to read every rule file up front, which
// loads a skill's whole rules/ directory on every invocation.
func checkEagerLoad(skill skillRef, source string, errors *[]string) {
	for index, line := range strings.Split(source, "\n") {
		if eagerLoadRE.MatchString(line) {
			*errors = append(*errors, fmt.Sprintf(
				"%s: SKILL.md:%d instructs an unconditional read of all rule files — reference each rule where the workflow needs it",
				skill.dir, index+1))
		}
	}
}

// SKILL.md must exist, carry the portable frontmatter checked in
// validateFrontmatter, stay within maxSkillLines, avoid eager-load phrasing,
// and have its referenced `rules/*.md` and `references/*.md` files resolve
// (with none left orphaned).
func validateSkill(root string, skill skillRef, errors *[]string) {
	skillFile := filepath.Join(root, skill.dir, "SKILL.md")
	if !pathExists(skillFile) {
		*errors = append(*errors, fmt.Sprintf("%s: missing SKILL.md", skill.dir))
		return
	}

	data, err := os.ReadFile(skillFile)
	if err != nil {
		*errors = append(*errors, fmt.Sprintf("%s: %s", skill.dir, err))
		return
	}
	source := string(data)

	validateFrontmatter(skill, source, errors)
	checkEagerLoad(skill, source, errors)
	if lines := countLines(source); lines > maxSkillLines {
		*errors = append(*errors, fmt.Sprintf(
			"%s: SKILL.md is %d lines (max %d) — move detail into rules/ or references/",
			skill.dir, lines, maxSkillLines))
	}
	checkSubdir(root, skill, "rules", extractReferencedRules(source), errors)
	checkSubdir(root, skill, "references", extractReferencedFiles(source), errors)
}

func validatePlugins(root string, colls []collection, errors *[]string) {
	releaseManifest := readJSON(root, ".release-please-manifest.json", errors)
	var expectedVersion string
	if releaseManifest != nil {
		expectedVersion, _ = releaseManifest["."].(string)
	}
	if expectedVersion == "" {
		*errors = append(*errors, ".release-please-manifest.json: missing `.` version")
	}

	for _, manifestPath := range pluginManifests {
		manifest := readJSON(root, manifestPath, errors)
		if manifest == nil {
			continue
		}
		version, _ := manifest["version"].(string)
		if version == "" {
			*errors = append(*errors, fmt.Sprintf("%s: missing version field", manifestPath))
		} else if expectedVersion != "" && version != expectedVersion {
			*errors = append(*errors, fmt.Sprintf(
				"%s: version `%s` does not match .release-please-manifest.json `%s`",
				manifestPath, version, expectedVersion))
		}
	}

	for _, marketplacePath := range marketplaces {
		readJSON(root, marketplacePath, errors)
	}

	for _, coll := range colls {
		validateAgentPluginManifest(root, coll.name, errors)
	}
}

// Codex treats a root `plugin.json` as an Agent Plugins manifest and refuses
// to install the plugin when it does not validate, so the closed schema is
// enforced here rather than discovered at install time.
func validateAgentPluginManifest(root, name string, errors *[]string) {
	manifestPath := agentPluginManifest(name)
	manifest := readJSON(root, manifestPath, errors)
	if manifest == nil {
		return
	}
	if schema, _ := manifest["$schema"].(string); schema != agentPluginSchema {
		*errors = append(*errors, fmt.Sprintf(
			"%s: `$schema` must be `%s`", manifestPath, agentPluginSchema))
	}
	if manifestName, _ := manifest["name"].(string); manifestName != name {
		*errors = append(*errors, fmt.Sprintf(
			"%s: `name` must be `%s`", manifestPath, name))
	}
	fields := map[string]bool{}
	for field := range manifest {
		fields[field] = true
	}
	for _, field := range sortedKeys(fields) {
		if !agentPluginFields[field] {
			*errors = append(*errors, fmt.Sprintf(
				"%s: `%s` is not an Agent Plugins manifest field — move it under `extensions` or a per-channel manifest",
				manifestPath, field))
		}
	}
}

func checkSymlink(root, linkPath, expectedTarget string, errors *[]string) {
	fullPath := filepath.Join(root, linkPath)

	info, err := os.Lstat(fullPath)
	if err != nil {
		*errors = append(*errors, fmt.Sprintf("%s: broken or missing symlink", linkPath))
		return
	}
	if info.Mode()&os.ModeSymlink == 0 {
		*errors = append(*errors, fmt.Sprintf("%s: expected a symlink", linkPath))
		return
	}
	actualTarget, err := os.Readlink(fullPath)
	if err != nil {
		*errors = append(*errors, fmt.Sprintf("%s: broken or missing symlink", linkPath))
		return
	}
	if actualTarget != expectedTarget {
		*errors = append(*errors, fmt.Sprintf(
			"%s: points at `%s`, expected `%s`", linkPath, actualTarget, expectedTarget))
		return
	}
	targetInfo, err := os.Stat(fullPath)
	if err != nil {
		*errors = append(*errors, fmt.Sprintf("%s: broken or missing symlink", linkPath))
		return
	}
	if !targetInfo.IsDir() {
		*errors = append(*errors, fmt.Sprintf("%s: symlink target is not a directory", linkPath))
	}
}

func validateSymlinks(root string, errors *[]string) {
	for _, link := range wrapperSymlinks {
		checkSymlink(root, link.path, link.target, errors)
	}
}

// Collection plugins must hold exactly their assigned skills as real
// directories, and each skill must belong to exactly one collection so a
// newly added skill cannot silently ship in none (or two) of the plugins.
// Returns the skills found, sorted by directory, for the per-skill checks.
func validateCollections(root string, colls []collection, errors *[]string) []skillRef {
	assigned := map[string]string{}
	for _, coll := range colls {
		for _, skill := range coll.skills {
			if previous, ok := assigned[skill]; ok {
				*errors = append(*errors, fmt.Sprintf(
					"collections: `%s` assigned to both `%s` and `%s`",
					skill, previous, coll.name))
			}
			assigned[skill] = coll.name
		}
	}

	var skills []skillRef
	for _, coll := range colls {
		skillsDir := collectionSkillsDir(coll.name)
		entries, err := os.ReadDir(filepath.Join(root, skillsDir))
		if err != nil {
			*errors = append(*errors, fmt.Sprintf("%s: directory not found", skillsDir))
			continue
		}
		expected := map[string]bool{}
		for _, skill := range coll.skills {
			expected[skill] = true
		}
		present := map[string]bool{}
		for _, entry := range entries {
			dir := skillsDir + "/" + entry.Name()
			present[entry.Name()] = true
			switch {
			case !expected[entry.Name()]:
				*errors = append(*errors, fmt.Sprintf(
					"%s: not part of the `%s` collection — add it to the collections table", dir, coll.name))
			case entry.Type()&os.ModeSymlink != 0:
				// Reported by validateContainment.
			case !entry.IsDir():
				*errors = append(*errors, fmt.Sprintf("%s: expected a skill directory", dir))
			default:
				skills = append(skills, skillRef{name: entry.Name(), dir: dir})
			}
		}
		for _, skill := range coll.skills {
			if !present[skill] {
				*errors = append(*errors, fmt.Sprintf(
					"collections: lists `%s` which does not exist in %s/", skill, skillsDir))
			}
		}
	}

	sort.Slice(skills, func(i, j int) bool { return skills[i].dir < skills[j].dir })
	return skills
}

// A collection plugin must not contain symlinks. Codex skips them when it
// copies the plugin into its cache (the skill silently vanishes), and Agent
// Plugins clients must reject any path that resolves outside the plugin root.
func validateContainment(root string, colls []collection, errors *[]string) {
	for _, coll := range colls {
		pluginDir := filepath.Join(root, "plugins", coll.name)
		filepath.WalkDir(pluginDir, func(path string, entry fs.DirEntry, err error) error {
			if err != nil || entry.Type()&os.ModeSymlink == 0 {
				return nil
			}
			relPath, relErr := filepath.Rel(root, path)
			if relErr != nil {
				relPath = path
			}
			*errors = append(*errors, fmt.Sprintf(
				"%s: symlink inside a plugin — commit the real file; Codex drops symlinks on install",
				filepath.ToSlash(relPath)))
			return nil
		})
	}
}

// normaliseBlock collapses whitespace runs so that reflowed copies of the same
// paragraph still compare equal. Case is kept: exact-after-normalisation is
// predictable, where fuzzy matching produces false positives faster than it
// finds real duplication.
func normaliseBlock(block string) string {
	return strings.Join(strings.Fields(block), " ")
}

// stripFences blanks out fenced code blocks, keeping line numbering intact.
//
// Prose is the target. Two skills legitimately quote the same command — the
// `pip-audit` invocation belongs in both the security audit and the Python
// dependency guide — and neither is a duplicated instruction.
func stripFences(source string) string {
	lines := strings.Split(source, "\n")
	inFence := false
	for index, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), "```") {
			inFence = !inFence
			lines[index] = ""
			continue
		}
		if inFence {
			lines[index] = ""
		}
	}
	return strings.Join(lines, "\n")
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
func validateDuplicateBlocks(root string, skills []skillRef, errors *[]string) {
	type location struct{ skill, where string }
	seen := map[string]location{}

	for _, skill := range skills {
		skillName := skill.name
		files := collectFiles(filepath.Join(root, skill.dir), []string{".md"})
		sort.Strings(files)
		for _, file := range files {
			data, err := os.ReadFile(file)
			if err != nil {
				continue
			}
			// Blank the frontmatter rather than cutting it, so reported line
			// numbers stay anchored to the real file. stripFences below does
			// the same for fenced code.
			source := string(data)
			if _, ok := parseFrontmatter(source); ok {
				if end := strings.Index(source[3:], "\n---\n"); end >= 0 {
					cut := 3 + end + len("\n---\n")
					source = strings.Repeat("\n", strings.Count(source[:cut], "\n")) + source[cut:]
				}
			}

			source = stripFences(source)

			relPath, err := filepath.Rel(root, file)
			if err != nil {
				relPath = file
			}

			lineNumber := 1
			for _, block := range strings.Split(source, "\n\n") {
				startLine := lineNumber
				lineNumber += strings.Count(block, "\n") + 2

				normalised := normaliseBlock(block)
				if len(normalised) < dupMinChars || len(strings.Fields(normalised)) < dupMinTokens {
					continue
				}
				if len(strings.Split(strings.TrimSpace(block), "\n")) < dupMinLines {
					continue
				}

				where := fmt.Sprintf("%s:%d", relPath, startLine)
				first, ok := seen[normalised]
				if !ok {
					seen[normalised] = location{skill: skillName, where: where}
					continue
				}
				if first.skill == skillName {
					continue
				}
				excerpt := normalised
				if runes := []rune(excerpt); len(runes) > 60 {
					excerpt = string(runes[:60])
				}
				*errors = append(*errors, fmt.Sprintf(
					"%s: block duplicated from %s (%q…) — keep one copy where the rule is defined",
					where, first.where, excerpt))
			}
		}
	}
}

func validate(root string, colls []collection) []string {
	errors := []string{}

	skills := validateCollections(root, colls, &errors)
	for _, skill := range skills {
		validateSkill(root, skill, &errors)
	}

	validateDuplicateBlocks(root, skills, &errors)
	validatePlugins(root, colls, &errors)
	validateSymlinks(root, &errors)
	validateContainment(root, colls, &errors)
	validateActionPinning(root, skills, &errors)

	return errors
}

func main() {
	root := "."
	if len(os.Args) > 1 {
		root = os.Args[1]
	}
	errors := validate(root, collections)
	if len(errors) > 0 {
		fmt.Fprintf(os.Stderr, "✖ Skill validation failed with %d error(s):\n\n", len(errors))
		for _, err := range errors {
			fmt.Fprintf(os.Stderr, "  - %s\n", err)
		}
		os.Exit(1)
	}
	fmt.Println("✓ Skill validation passed")
}

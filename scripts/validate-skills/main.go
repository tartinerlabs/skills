// Command validate-skills checks the repository's skill structure, plugin
// manifest versions, wrapper symlinks, and GitHub Action pinning discipline.
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

// Skill collections: each entry is a `plugins/<name>/` wrapper exposing the
// listed skills through per-skill symlinks (`skills/<skill>` →
// `../../../skills/<skill>`). Every directory under `skills/` must belong to
// exactly one collection — validated in validateCollections.
type collection struct {
	name   string
	skills []string
}

var collections = []collection{
	{name: "workflow", skills: []string{"commit", "create-branch", "create-pr", "github-actions", "github-issues"}},
	{name: "quality", skills: []string{"refactor", "naming-format", "project-structure", "tailwind"}},
	{name: "security", skills: []string{"security", "deps"}},
	{name: "tooling", skills: []string{"setup", "testing", "update-project"}},
}

// Plugin manifests whose `version` release-please keeps in sync with the
// released version (via `extra-files` in release-please-config.json).
var pluginManifests = manifestPaths()

func manifestPaths() []string {
	plugins := make([]string, 0, len(collections)+2)
	for _, coll := range collections {
		plugins = append(plugins, coll.name)
	}
	plugins = append(plugins, "tartinerlabs", "xcode-skills")

	var manifests []string
	for _, plugin := range plugins {
		for _, channel := range []string{".codex-plugin", ".claude-plugin", ".cursor-plugin", ".antigravity-plugin"} {
			manifests = append(manifests, fmt.Sprintf("plugins/%s/%s/plugin.json", plugin, channel))
		}
	}
	return manifests
}

// Marketplace manifests distributed alongside the plugin manifests.
var marketplaces = []string{
	".claude-plugin/marketplace.json",
	".cursor-plugin/marketplace.json",
	".agents/plugins/marketplace.json",
}

// Whole-directory wrappers expose their skill source through a `skills`
// symlink that must point at a specific source — swapping the targets would
// publish the wrong skills through that wrapper, so the exact destination is
// checked. Collection wrappers instead use per-skill symlinks derived from
// the collections table (validated in validateCollections).
var wrapperSymlinks = []struct {
	path   string
	target string
}{
	{path: "plugins/tartinerlabs/skills", target: "../../skills"},
	{path: "plugins/xcode-skills/skills", target: "../../xcode-skills"},
}

// `xcode-skills/` is a generated Xcode export — its skill content is
// deliberately excluded from the rules checks below. Only the
// `plugins/xcode-skills` manifests (in pluginManifests) are validated.
const (
	skillsDir         = "skills"
	actionPinningRule = "skills/github-actions/rules/action-pinning.md"
)

var (
	actionUseRE     = regexp.MustCompile("\\buses:\\s*([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*)@([^\\s`]+)")
	fullCommitShaRE = regexp.MustCompile(`(?i)^[a-f0-9]{40}$`)
	refCommentRE    = regexp.MustCompile(`^\s+#\s+\S`)
	rulesRefRE      = regexp.MustCompile(`rules/([A-Za-z0-9][A-Za-z0-9-]*)\.md`)
	referencesRefRE = regexp.MustCompile(`references/([A-Za-z0-9][A-Za-z0-9-]*)\.md`)
	prefixCellRE    = regexp.MustCompile(`^[a-z0-9]+-$`)
	suffixTokenRE   = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)
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

func validateActionPinning(root string, errors *[]string) {
	files := collectFiles(filepath.Join(root, skillsDir), []string{".md"})
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

// Collect every rule file name a SKILL.md refers to. Two patterns are used
// across the collection:
//  1. Explicit `rules/<name>.md` paths in a table's File column.
//  2. Compact prefix tables (e.g. refactor) with a `general-` prefix cell and
//     a comma-separated suffix list — reconstructed as prefix+suffix.
func extractReferencedRules(source string) map[string]bool {
	names := map[string]bool{}

	for _, match := range rulesRefRE.FindAllStringSubmatch(source, -1) {
		names[match[1]] = true
	}

	for _, line := range strings.Split(source, "\n") {
		if !strings.HasPrefix(strings.TrimLeft(line, " \t"), "|") {
			continue
		}
		var prefixes []string
		var suffixLists [][]string
		for _, cell := range strings.Split(line, "|") {
			cell = strings.TrimSpace(strings.ReplaceAll(cell, "`", ""))
			if prefixCellRE.MatchString(cell) {
				prefixes = append(prefixes, cell)
			} else if strings.Contains(cell, ",") {
				tokens := strings.Split(cell, ",")
				valid := true
				for i, token := range tokens {
					tokens[i] = strings.TrimSpace(token)
					if !suffixTokenRE.MatchString(tokens[i]) {
						valid = false
						break
					}
				}
				if valid {
					suffixLists = append(suffixLists, tokens)
				}
			}
		}
		for _, prefix := range prefixes {
			for _, tokens := range suffixLists {
				for _, token := range tokens {
					names[prefix+token] = true
				}
			}
		}
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
func checkSubdir(skillDir, skillName, subdir string, referenced map[string]bool, errors *[]string) {
	dir := filepath.Join(skillDir, subdir)
	fileSet := map[string]bool{}
	if pathExists(dir) {
		entries, err := os.ReadDir(dir)
		if err == nil {
			for _, entry := range entries {
				if strings.HasSuffix(entry.Name(), ".md") {
					fileSet[strings.TrimSuffix(entry.Name(), ".md")] = true
				}
			}
		}
	}

	for _, name := range sortedKeys(referenced) {
		if !fileSet[name] {
			*errors = append(*errors, fmt.Sprintf(
				"%s/%s: references `%s/%s.md` which does not exist",
				skillsDir, skillName, subdir, name))
		}
	}
	for _, name := range sortedKeys(fileSet) {
		if !referenced[name] {
			*errors = append(*errors, fmt.Sprintf(
				"%s/%s: `%s/%s.md` is never referenced in SKILL.md (orphan)",
				skillsDir, skillName, subdir, name))
		}
	}
}

// Structure check only: SKILL.md exists and its referenced `rules/*.md` and
// `references/*.md` files resolve (and none are left orphaned). Frontmatter
// fields are not parsed or validated.
func validateSkill(root, skillName string, errors *[]string) {
	skillDir := filepath.Join(root, skillsDir, skillName)
	skillFile := filepath.Join(skillDir, "SKILL.md")
	if !pathExists(skillFile) {
		*errors = append(*errors, fmt.Sprintf("%s/%s: missing SKILL.md", skillsDir, skillName))
		return
	}

	data, err := os.ReadFile(skillFile)
	if err != nil {
		*errors = append(*errors, fmt.Sprintf("%s/%s: %s", skillsDir, skillName, err))
		return
	}
	source := string(data)

	checkSubdir(skillDir, skillName, "rules", extractReferencedRules(source), errors)
	checkSubdir(skillDir, skillName, "references", extractReferencedFiles(source), errors)
}

func validatePlugins(root string, errors *[]string) {
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

// Collection wrappers must expose exactly their assigned skills, each through
// a per-skill symlink into the flat `skills/` source. Every skill in the
// source must belong to exactly one collection so a newly added skill cannot
// silently ship in none (or two) of the collection plugins.
func validateCollections(root string, skillNames []string, colls []collection, errors *[]string) {
	assigned := map[string]string{}
	for _, coll := range colls {
		for _, skill := range coll.skills {
			if previous, ok := assigned[skill]; ok {
				*errors = append(*errors, fmt.Sprintf(
					"%s/%s: assigned to both `%s` and `%s` collections",
					skillsDir, skill, previous, coll.name))
			}
			assigned[skill] = coll.name
		}
	}

	skillSet := map[string]bool{}
	for _, skill := range skillNames {
		skillSet[skill] = true
		if _, ok := assigned[skill]; !ok {
			*errors = append(*errors, fmt.Sprintf(
				"%s/%s: not assigned to any collection", skillsDir, skill))
		}
	}
	assignedSet := map[string]bool{}
	for skill := range assigned {
		assignedSet[skill] = true
	}
	for _, skill := range sortedKeys(assignedSet) {
		if !skillSet[skill] {
			*errors = append(*errors, fmt.Sprintf(
				"collections: lists `%s` which does not exist in %s/", skill, skillsDir))
		}
	}

	for _, coll := range colls {
		wrapperDir := fmt.Sprintf("plugins/%s/skills", coll.name)
		entries, err := os.ReadDir(filepath.Join(root, wrapperDir))
		if err != nil {
			*errors = append(*errors, fmt.Sprintf("%s: directory not found", wrapperDir))
			continue
		}
		expected := map[string]bool{}
		for _, skill := range coll.skills {
			expected[skill] = true
		}
		for _, entry := range entries {
			if !expected[entry.Name()] {
				*errors = append(*errors, fmt.Sprintf(
					"%s/%s: not part of the `%s` collection", wrapperDir, entry.Name(), coll.name))
			}
		}
		for _, skill := range coll.skills {
			checkSymlink(root, wrapperDir+"/"+skill, "../../../skills/"+skill, errors)
		}
	}
}

func validate(root string, colls []collection) []string {
	errors := []string{}

	var skillNames []string
	skillsRoot := filepath.Join(root, skillsDir)
	if pathExists(skillsRoot) {
		entries, err := os.ReadDir(skillsRoot)
		if err != nil {
			errors = append(errors, fmt.Sprintf("%s/: %s", skillsDir, err))
		}
		for _, entry := range entries {
			if entry.IsDir() {
				skillNames = append(skillNames, entry.Name())
			}
		}
		sort.Strings(skillNames)
		for _, skillName := range skillNames {
			validateSkill(root, skillName, &errors)
		}
	} else {
		errors = append(errors, skillsDir+"/: directory not found")
	}

	validatePlugins(root, &errors)
	validateSymlinks(root, &errors)
	validateCollections(root, skillNames, colls, &errors)
	validateActionPinning(root, &errors)

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

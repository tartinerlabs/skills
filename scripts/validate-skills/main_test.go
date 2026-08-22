package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const version = "1.0.0"

// The fixture ships a single skill (`demo`) exposed through one collection
// wrapper, standing in for the real collections table.
var fixtureCollections = []collection{
	{name: "workflow", skills: []string{"demo"}},
}

// Every fixture-backed validate call swaps the real collections table for the
// fixture's one-collection stand-in.
func validateFixture(root string) []string {
	return validate(root, fixtureCollections)
}

var validSkill = strings.Join([]string{
	"---",
	"name: demo",
	"description: A demo skill for tests.",
	"license: MIT",
	"allowed-tools: Read Bash(git:*)",
	"model: haiku",
	"effort: low",
	"compatibility: Requires git",
	"metadata:",
	"  short-description: A demo skill.",
	"---",
	"",
	"You are a demo skill. Read `rules/foo.md` before proceeding.",
	"",
	"| Rule | File |",
	"|------|------|",
	"| Foo | `rules/foo.md` |",
	"",
}, "\n")

func writeJSONFile(t *testing.T, path string, value interface{}) {
	t.Helper()
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	writeTextFile(t, path, string(data))
}

func writeTextFile(t *testing.T, path, value string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(value), 0o644); err != nil {
		t.Fatal(err)
	}
}

func mustSymlink(t *testing.T, target, link string) {
	t.Helper()
	if err := os.Symlink(target, link); err != nil {
		t.Fatal(err)
	}
}

func mustRemove(t *testing.T, path string) {
	t.Helper()
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
}

// Build a minimal but fully valid repo so each test can mutate one thing.
func buildFixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()

	writeJSONFile(t, filepath.Join(root, ".release-please-manifest.json"), map[string]string{".": version})

	if err := os.MkdirAll(filepath.Join(root, "skills"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "xcode-skills/sample"), 0o755); err != nil {
		t.Fatal(err)
	}

	for _, manifest := range pluginManifests {
		name := strings.Split(manifest, "/")[1]
		writeJSONFile(t, filepath.Join(root, manifest), map[string]string{"name": name, "version": version})
	}
	for _, marketplace := range marketplaces {
		writeJSONFile(t, filepath.Join(root, marketplace), map[string]interface{}{
			"name":    "tartinerlabs",
			"plugins": []string{},
		})
	}

	mustSymlink(t, "../../skills", filepath.Join(root, "plugins/tartinerlabs/skills"))
	mustSymlink(t, "../../xcode-skills", filepath.Join(root, "plugins/xcode-skills/skills"))

	for _, coll := range fixtureCollections {
		for _, skill := range coll.skills {
			writeTextFile(t, filepath.Join(root, "plugins", coll.name, "skills", skill, "SKILL.md"), validSkill)
			writeTextFile(t, filepath.Join(root, "plugins", coll.name, "skills", skill, "rules/foo.md"), "# Foo\n")
			mustSymlink(t, "../plugins/"+coll.name+"/skills/"+skill, filepath.Join(root, "skills", skill))
		}
	}

	return root
}

func assertNoErrors(t *testing.T, errors []string) {
	t.Helper()
	if len(errors) != 0 {
		t.Fatalf("expected no errors, got:\n%s", strings.Join(errors, "\n"))
	}
}

// assertSomeError fails unless at least one error contains every substring.
func assertSomeError(t *testing.T, errors []string, substrings ...string) {
	t.Helper()
	for _, err := range errors {
		matched := true
		for _, substring := range substrings {
			if !strings.Contains(err, substring) {
				matched = false
				break
			}
		}
		if matched {
			return
		}
	}
	t.Fatalf("no error matching %q in:\n%s", substrings, strings.Join(errors, "\n"))
}

func TestPassesOnValidFixture(t *testing.T) {
	root := buildFixture(t)
	assertNoErrors(t, validateFixture(root))
}

// writeDemoSkill rewrites the fixture's demo SKILL.md with one frontmatter
// line replaced (or dropped, when replacement is empty).
func writeDemoSkill(t *testing.T, root, line, replacement string) {
	t.Helper()
	if !strings.Contains(validSkill, line+"\n") {
		t.Fatalf("fixture skill has no line %q", line)
	}
	source := strings.Replace(validSkill, line+"\n", replacement, 1)
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"), source)
}

func TestFlagsSkillMissingPortableFrontmatter(t *testing.T) {
	for _, testCase := range []struct {
		name    string
		line    string
		wantErr string
	}{
		{"license", "license: MIT", "frontmatter missing `license`"},
		{"compatibility", "compatibility: Requires git", "frontmatter missing `compatibility`"},
		{"description", "description: A demo skill for tests.", "frontmatter missing `description`"},
		{"short-description", "  short-description: A demo skill.", "frontmatter missing `metadata.short-description`"},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			root := buildFixture(t)
			writeDemoSkill(t, root, testCase.line, "")
			assertSomeError(t, validateFixture(root), testCase.wantErr)
		})
	}
}

func TestFlagsSkillNameNotMatchingDirectory(t *testing.T) {
	root := buildFixture(t)
	writeDemoSkill(t, root, "name: demo", "name: not-demo\n")
	assertSomeError(t, validateFixture(root),
		"frontmatter `name: not-demo` does not match directory name")
}

func TestFlagsSkillWithoutFrontmatterBlock(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"),
		"Read `rules/foo.md` before proceeding.\n")
	assertSomeError(t, validateFixture(root), "SKILL.md has no YAML frontmatter block")
}

func TestFlagsOverlongCompatibility(t *testing.T) {
	root := buildFixture(t)
	writeDemoSkill(t, root, "compatibility: Requires git",
		"compatibility: "+strings.Repeat("x", maxCompatibilityLen+1)+"\n")
	assertSomeError(t, validateFixture(root), "frontmatter `compatibility` is 501 characters")
}

// Claude-only fields are ignored by other channels, so their absence must not
// fail validation.
func TestAllowsSkillWithoutClaudeOnlyFields(t *testing.T) {
	root := buildFixture(t)
	writeDemoSkill(t, root, "model: haiku", "")
	assertNoErrors(t, validateFixture(root))
}

func TestFlagsReferencedRuleFileThatDoesNotExist(t *testing.T) {
	root := buildFixture(t)
	mustRemove(t, filepath.Join(root, "skills/demo/rules/foo.md"))
	assertSomeError(t, validateFixture(root), "references `rules/foo.md` which does not exist")
}

func TestPassesWhenSkillReferencesExistingReferencesFile(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"),
		validSkill+"\nSee `references/python.md` for the Python path.\n")
	writeTextFile(t, filepath.Join(root, "skills/demo/references/python.md"), "# Python\n")
	assertNoErrors(t, validateFixture(root))
}

func TestFlagsReferencedReferencesFileThatDoesNotExist(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"),
		validSkill+"\nSee `references/python.md` for the Python path.\n")
	assertSomeError(t, validateFixture(root), "references `references/python.md` which does not exist")
}

func TestFlagsOrphanedReferencesFile(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/references/orphan.md"), "# Orphan\n")
	assertSomeError(t, validateFixture(root), "`references/orphan.md` is never referenced")
}

func TestIgnoresReferencesPlaceholderTemplates(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"),
		validSkill+"\nLoad `references/<lang>.md` for the detected language.\n")
	// No references/ dir exists — a placeholder must not be treated as a real,
	// missing file.
	assertNoErrors(t, validateFixture(root))
}

func TestFlagsPluginManifestVersionDrift(t *testing.T) {
	root := buildFixture(t)
	writeJSONFile(t, filepath.Join(root, pluginManifests[0]), map[string]string{
		"name":    strings.Split(pluginManifests[0], "/")[1],
		"version": "9.9.9",
	})
	assertSomeError(t, validateFixture(root), "version `9.9.9`", version)
}

func TestReleasePleaseSyncsEveryPluginManifestViaExtraFiles(t *testing.T) {
	data, err := os.ReadFile("../../release-please-config.json")
	if err != nil {
		t.Fatal(err)
	}
	var releaseConfig struct {
		Packages map[string]struct {
			ExtraFiles []struct {
				Type     string `json:"type"`
				Path     string `json:"path"`
				JSONPath string `json:"jsonpath"`
			} `json:"extra-files"`
		} `json:"packages"`
	}
	if err := json.Unmarshal(data, &releaseConfig); err != nil {
		t.Fatal(err)
	}

	syncedJSONPaths := map[string]bool{}
	for _, file := range releaseConfig.Packages["."].ExtraFiles {
		if file.Type == "json" && file.JSONPath == "$.version" {
			syncedJSONPaths[file.Path] = true
		}
	}

	for _, manifest := range pluginManifests {
		if !syncedJSONPaths[manifest] {
			t.Errorf("%s is missing from extra-files", manifest)
		}
	}
}

func TestFlagsBrokenWrapperSymlink(t *testing.T) {
	root := buildFixture(t)
	mustRemove(t, filepath.Join(root, "plugins/tartinerlabs/skills"))
	mustSymlink(t, "../../does-not-exist", filepath.Join(root, "plugins/tartinerlabs/skills"))
	assertSomeError(t, validateFixture(root), "plugins/tartinerlabs/skills")
}

func TestFlagsWrapperSymlinkPointingAtWrongCollection(t *testing.T) {
	root := buildFixture(t)
	// Swap tartinerlabs' skills link to the xcode-skills collection — a valid,
	// existing directory, so only the target comparison can catch it.
	mustRemove(t, filepath.Join(root, "plugins/tartinerlabs/skills"))
	mustSymlink(t, "../../xcode-skills", filepath.Join(root, "plugins/tartinerlabs/skills"))
	assertSomeError(t, validateFixture(root), "plugins/tartinerlabs/skills", "expected `../../skills`")
}

func TestFlagsMissingInboundSkillSymlink(t *testing.T) {
	root := buildFixture(t)
	mustRemove(t, filepath.Join(root, "skills/demo"))
	assertSomeError(t, validateFixture(root), "skills/demo: broken or missing symlink")
}

func TestFlagsInboundSkillSymlinkWithWrongTarget(t *testing.T) {
	root := buildFixture(t)
	// Point at a valid, existing directory so only the target comparison can
	// catch the swap.
	mustRemove(t, filepath.Join(root, "skills/demo"))
	mustSymlink(t, "../plugins/workflow/skills", filepath.Join(root, "skills/demo"))
	assertSomeError(t, validateFixture(root), "skills/demo", "expected `../plugins/workflow/skills/demo`")
}

func TestFlagsPluginSkillDirThatIsASymlink(t *testing.T) {
	root := buildFixture(t)
	pluginSkill := filepath.Join(root, "plugins/workflow/skills/demo")
	if err := os.RemoveAll(pluginSkill); err != nil {
		t.Fatal(err)
	}
	mustSymlink(t, "../../../skills/demo", pluginSkill)
	assertSomeError(t, validateFixture(root), "plugins/workflow/skills/demo", "expected a directory, not a symlink")
}

func TestFlagsEntryACollectionWrapperShouldNotExpose(t *testing.T) {
	root := buildFixture(t)
	mustSymlink(t, "../../../skills/demo", filepath.Join(root, "plugins/workflow/skills/extra"))
	assertSomeError(t, validateFixture(root),
		"plugins/workflow/skills/extra: not part of the `workflow` collection")
}

func TestFlagsSkillNotAssignedToAnyCollection(t *testing.T) {
	root := buildFixture(t)
	looseSkill := strings.ReplaceAll(validSkill, "rules/foo.md", "rules/bar.md")
	writeTextFile(t, filepath.Join(root, "skills/loose/SKILL.md"), looseSkill)
	writeTextFile(t, filepath.Join(root, "skills/loose/rules/bar.md"), "# Bar\n")
	assertSomeError(t, validateFixture(root), "skills/loose: not assigned to any collection")
}

func TestFlagsSkillAssignedToTwoCollections(t *testing.T) {
	root := buildFixture(t)
	errors := validate(root, []collection{
		{name: "workflow", skills: []string{"demo"}},
		{name: "quality", skills: []string{"demo"}},
	})
	assertSomeError(t, errors, "skills/demo: assigned to both `workflow` and `quality` collections")
}

func TestFlagsCollectionListingSkillThatDoesNotExist(t *testing.T) {
	root := buildFixture(t)
	errors := validate(root, []collection{
		{name: "workflow", skills: []string{"demo", "ghost"}},
	})
	assertSomeError(t, errors, "collections: lists `ghost` which does not exist")
}

func TestFlagsCollectionWrapperWithoutSkillsDirectory(t *testing.T) {
	root := buildFixture(t)
	if err := os.RemoveAll(filepath.Join(root, "plugins/workflow/skills")); err != nil {
		t.Fatal(err)
	}
	assertSomeError(t, validateFixture(root), "plugins/workflow/skills: directory not found")
}

func TestFlagsActionUsingMutableTag(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/rules/foo.md"),
		"# Foo\n\n```yaml\n- uses: actions/checkout@v7\n```\n")
	assertSomeError(t, validateFixture(root), "skills/demo/rules/foo.md:4", "full 40-character commit SHA")
}

func TestFlagsPinnedActionWithoutRefComment(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/rules/foo.md"),
		"# Foo\n\n```yaml\n- uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0\n```\n")
	assertSomeError(t, validateFixture(root), "skills/demo/rules/foo.md:4", "version or source-ref comment")
}

func TestAcceptsPinnedActionsAndFullShaPlaceholders(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/rules/foo.md"), strings.Join([]string{
		"# Foo",
		"",
		"```yaml",
		"- uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0",
		"```",
		"",
		"Use `- uses: owner/action@<full-SHA>  # vX.Y.Z` for other actions.",
		"",
	}, "\n"))
	assertNoErrors(t, validateFixture(root))
}

func TestAllowsMutableRefsOnlyInActionPinningIncorrectSection(t *testing.T) {
	root := buildFixture(t)
	githubActionsSkill := strings.ReplaceAll(validSkill, "demo", "github-actions")
	githubActionsSkill = strings.ReplaceAll(githubActionsSkill, "rules/foo.md", "rules/action-pinning.md")
	writeTextFile(t, filepath.Join(root, "plugins/workflow/skills/github-actions/SKILL.md"), githubActionsSkill)
	writeTextFile(t, filepath.Join(root, "plugins/workflow/skills/github-actions/rules/action-pinning.md"), strings.Join([]string{
		"# Action Pinning",
		"",
		"### Incorrect",
		"",
		"- uses: actions/checkout@v7",
		"",
		"### Correct",
		"",
		"- uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0  # v7.0.0",
		"",
	}, "\n"))
	mustSymlink(t, "../plugins/workflow/skills/github-actions",
		filepath.Join(root, "skills/github-actions"))
	errors := validate(root, []collection{
		{name: "workflow", skills: []string{"demo", "github-actions"}},
	})
	assertNoErrors(t, errors)
}

func TestScansYamlWorkflowFilesForMutableActionRefs(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, ".github/workflows/ci.yaml"),
		"steps:\n  - uses: actions/checkout@v7\n")
	assertSomeError(t, validateFixture(root), ".github/workflows/ci.yaml:2", "full 40-character commit SHA")
}

// secondSkill builds a valid SKILL.md for an extra fixture skill, so the
// cross-skill checks have two skills to compare.
func secondSkill(name, body string) string {
	return strings.Join([]string{
		"---",
		"name: " + name,
		"description: Another demo skill for tests.",
		"license: MIT",
		"allowed-tools: Read",
		"model: haiku",
		"effort: low",
		"compatibility: Requires nothing",
		"metadata:",
		"  short-description: Another demo skill.",
		"---",
		"",
		body,
		"",
		"| Rule | File |",
		"|------|------|",
		"| Bar | `rules/bar.md` |",
		"",
	}, "\n")
}

// addSecondSkill writes a second skill into the collection tree and an
// inbound `skills/<name>` symlink.
func addSecondSkill(t *testing.T, root, name, body string) {
	t.Helper()
	writeTextFile(t, filepath.Join(root, "plugins/workflow/skills", name, "SKILL.md"), secondSkill(name, body))
	writeTextFile(t, filepath.Join(root, "plugins/workflow/skills", name, "rules/bar.md"), "# Bar\n")
	mustSymlink(t, "../plugins/workflow/skills/"+name, filepath.Join(root, "skills", name))
}

func twoSkillCollections(name string) []collection {
	return []collection{{name: "workflow", skills: []string{"demo", name}}}
}

func TestFlagsEagerLoadAllRulesPhrasing(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"), strings.Replace(validSkill,
		"You are a demo skill. Read `rules/foo.md` before proceeding.",
		"Read ALL rule files before proceeding — do not skip or ask:", 1))
	assertSomeError(t, validateFixture(root), "skills/demo", "instructs an unconditional read")
}

// The false-positive boundary: the install and generate skills legitimately
// tell the agent to read each rule file, because they apply every one.
func TestAllowsPerStepRuleReferences(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"), strings.Replace(validSkill,
		"You are a demo skill. Read `rules/foo.md` before proceeding.",
		"Read each rule file in `rules/` for detailed setup instructions.", 1))
	assertNoErrors(t, validateFixture(root))
}

// Hard-stop phrasing is sanctioned on its own — commit refuses to proceed on a
// secret-scanner hit — so it is only eager loading when a read instruction
// shares the line.
func TestAllowsHardStopPhrasingWithoutReadInstruction(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"), strings.Replace(validSkill,
		"You are a demo skill. Read `rules/foo.md` before proceeding.",
		"STOP if the scanner reports a leak. Do not skip or ask — the commit is refused.", 1))
	assertNoErrors(t, validateFixture(root))
}

func TestFlagsSkillFileOverLineBudget(t *testing.T) {
	root := buildFixture(t)
	padding := strings.Repeat("\nFiller prose line.", maxSkillLines)
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"), validSkill+padding+"\n")
	assertSomeError(t, validateFixture(root), "skills/demo", "SKILL.md is", "max 125")
}

func TestAllowsSkillFileAtLineBudget(t *testing.T) {
	root := buildFixture(t)
	source := validSkill
	for countLines(source) < maxSkillLines {
		source += "Filler prose line.\n"
	}
	if got := countLines(source); got != maxSkillLines {
		t.Fatalf("fixture setup: got %d lines, want exactly %d", got, maxSkillLines)
	}
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"), source)
	assertNoErrors(t, validateFixture(root))
}

func TestFlagsOversizedRuleFile(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/rules/foo.md"),
		"# Foo\n"+strings.Repeat("Filler prose line.\n", maxRuleLines))
	assertSomeError(t, validateFixture(root), "skills/demo", "rules/foo.md is", "max 150")
}

func TestFlagsBlockDuplicatedAcrossSkills(t *testing.T) {
	root := buildFixture(t)
	shared := strings.Join([]string{
		"Classify the request before acting, and default to read-only when the",
		"intent is ambiguous or diagnostic. Produce an evidence-backed report",
		"and make no file edits at all.",
	}, "\n")
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"), validSkill+"\n"+shared+"\n")
	addSecondSkill(t, root, "other", shared)
	assertSomeError(t, validate(root, twoSkillCollections("other")), "block duplicated from")
}

// Frontmatter is blanked rather than cut, so the reported offset points at the
// block's real line in the file rather than several lines above it.
func TestDuplicateBlockReportsRealLineNumber(t *testing.T) {
	root := buildFixture(t)
	shared := strings.Join([]string{
		"Classify the request before acting, and default to read-only when the",
		"intent is ambiguous or diagnostic. Produce an evidence-backed report",
		"and make no file edits at all.",
	}, "\n")
	source := validSkill + "\n" + shared + "\n"
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"), source)
	addSecondSkill(t, root, "other", shared)

	want := 1 + strings.Count(source[:strings.Index(source, shared)], "\n")
	assertSomeError(t, validate(root, twoSkillCollections("other")),
		fmt.Sprintf("skills/demo/SKILL.md:%d", want))
}

// Within one skill, repetition is legitimate — the per-language references/
// guides restate a caveat with local context on purpose.
func TestAllowsSameBlockRepeatedWithinOneSkill(t *testing.T) {
	root := buildFixture(t)
	shared := strings.Join([]string{
		"Classify the request before acting, and default to read-only when the",
		"intent is ambiguous or diagnostic. Produce an evidence-backed report",
		"and make no file edits at all.",
	}, "\n")
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"), validSkill+"\n"+shared+"\n")
	writeTextFile(t, filepath.Join(root, "skills/demo/rules/foo.md"), "# Foo\n\n"+shared+"\n")
	assertNoErrors(t, validateFixture(root))
}

// A one-line shared fact is shared vocabulary, not a duplicated instruction.
func TestAllowsShortSharedLineAcrossSkills(t *testing.T) {
	root := buildFixture(t)
	shared := "Detect the package manager from the lockfile, in this order: pnpm, bun, yarn, npm. With no lockfile, ask."
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"), validSkill+"\n"+shared+"\n")
	addSecondSkill(t, root, "other", shared)
	assertNoErrors(t, validate(root, twoSkillCollections("other")))
}

// Two skills quoting the same command is not duplicated guidance.
func TestAllowsSharedFencedCodeAcrossSkills(t *testing.T) {
	root := buildFixture(t)
	shared := strings.Join([]string{
		"```bash",
		"pip-audit                       # audit the current environment",
		"pip-audit -r requirements.txt   # audit a requirements file",
		"```",
	}, "\n")
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"), validSkill+"\n"+shared+"\n")
	addSecondSkill(t, root, "other", shared)
	assertNoErrors(t, validate(root, twoSkillCollections("other")))
}

// The content budgets are scoped to skills/; the generated xcode-skills/ export
// carries much larger Apple-authored files and must never be measured.
func TestIgnoresContentBudgetsInXcodeExport(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "xcode-skills/sample/SKILL.md"),
		"# Sample\n"+strings.Repeat("Filler prose line.\n", maxSkillLines*3))
	assertNoErrors(t, validateFixture(root))
}

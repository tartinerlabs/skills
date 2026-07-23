package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const version = "1.0.0"

var validSkill = strings.Join([]string{
	"---",
	"name: demo",
	"description: A demo skill for tests.",
	"allowed-tools: Read Bash(git:*)",
	"model: haiku",
	"effort: low",
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
	writeJSONFile(t, filepath.Join(root, "package.json"), map[string]string{"version": version})

	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"), validSkill)
	writeTextFile(t, filepath.Join(root, "skills/demo/rules/foo.md"), "# Foo\n")

	if err := os.MkdirAll(filepath.Join(root, "xcode-skills/sample"), 0o755); err != nil {
		t.Fatal(err)
	}

	for _, manifest := range pluginManifests {
		name := "tartinerlabs"
		if strings.Contains(manifest, "xcode-skills") {
			name = "xcode-skills"
		}
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
	assertNoErrors(t, validate(root))
}

func TestFlagsReferencedRuleFileThatDoesNotExist(t *testing.T) {
	root := buildFixture(t)
	mustRemove(t, filepath.Join(root, "skills/demo/rules/foo.md"))
	assertSomeError(t, validate(root), "references `rules/foo.md` which does not exist")
}

func TestPassesWhenSkillReferencesExistingReferencesFile(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"),
		validSkill+"\nSee `references/python.md` for the Python path.\n")
	writeTextFile(t, filepath.Join(root, "skills/demo/references/python.md"), "# Python\n")
	assertNoErrors(t, validate(root))
}

func TestFlagsReferencedReferencesFileThatDoesNotExist(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"),
		validSkill+"\nSee `references/python.md` for the Python path.\n")
	assertSomeError(t, validate(root), "references `references/python.md` which does not exist")
}

func TestFlagsOrphanedReferencesFile(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/references/orphan.md"), "# Orphan\n")
	assertSomeError(t, validate(root), "`references/orphan.md` is never referenced")
}

func TestIgnoresReferencesPlaceholderTemplates(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/SKILL.md"),
		validSkill+"\nLoad `references/<lang>.md` for the detected language.\n")
	// No references/ dir exists — a placeholder must not be treated as a real,
	// missing file.
	assertNoErrors(t, validate(root))
}

func TestFlagsPluginManifestVersionDrift(t *testing.T) {
	root := buildFixture(t)
	writeJSONFile(t, filepath.Join(root, pluginManifests[0]), map[string]string{
		"name":    "tartinerlabs",
		"version": "9.9.9",
	})
	assertSomeError(t, validate(root), "version `9.9.9`", version)
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

	for _, manifest := range append(append([]string{}, pluginManifests...), "package.json") {
		if !syncedJSONPaths[manifest] {
			t.Errorf("%s is missing from extra-files", manifest)
		}
	}
}

func TestFlagsBrokenWrapperSymlink(t *testing.T) {
	root := buildFixture(t)
	mustRemove(t, filepath.Join(root, "plugins/tartinerlabs/skills"))
	mustSymlink(t, "../../does-not-exist", filepath.Join(root, "plugins/tartinerlabs/skills"))
	assertSomeError(t, validate(root), "plugins/tartinerlabs/skills")
}

func TestFlagsWrapperSymlinkPointingAtWrongCollection(t *testing.T) {
	root := buildFixture(t)
	// Swap tartinerlabs' skills link to the xcode-skills collection — a valid,
	// existing directory, so only the target comparison can catch it.
	mustRemove(t, filepath.Join(root, "plugins/tartinerlabs/skills"))
	mustSymlink(t, "../../xcode-skills", filepath.Join(root, "plugins/tartinerlabs/skills"))
	assertSomeError(t, validate(root), "plugins/tartinerlabs/skills", "expected `../../skills`")
}

func TestFlagsActionUsingMutableTag(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/rules/foo.md"),
		"# Foo\n\n```yaml\n- uses: actions/checkout@v7\n```\n")
	assertSomeError(t, validate(root), "skills/demo/rules/foo.md:4", "full 40-character commit SHA")
}

func TestFlagsPinnedActionWithoutRefComment(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, "skills/demo/rules/foo.md"),
		"# Foo\n\n```yaml\n- uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0\n```\n")
	assertSomeError(t, validate(root), "skills/demo/rules/foo.md:4", "version or source-ref comment")
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
	assertNoErrors(t, validate(root))
}

func TestAllowsMutableRefsOnlyInActionPinningIncorrectSection(t *testing.T) {
	root := buildFixture(t)
	githubActionsSkill := strings.ReplaceAll(validSkill, "demo", "github-actions")
	githubActionsSkill = strings.ReplaceAll(githubActionsSkill, "rules/foo.md", "rules/action-pinning.md")
	writeTextFile(t, filepath.Join(root, "skills/github-actions/SKILL.md"), githubActionsSkill)
	writeTextFile(t, filepath.Join(root, "skills/github-actions/rules/action-pinning.md"), strings.Join([]string{
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
	assertNoErrors(t, validate(root))
}

func TestScansYamlWorkflowFilesForMutableActionRefs(t *testing.T) {
	root := buildFixture(t)
	writeTextFile(t, filepath.Join(root, ".github/workflows/ci.yaml"),
		"steps:\n  - uses: actions/checkout@v7\n")
	assertSomeError(t, validate(root), ".github/workflows/ci.yaml:2", "full 40-character commit SHA")
}

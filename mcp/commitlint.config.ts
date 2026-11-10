import { RuleConfigSeverity, type UserConfig } from "@commitlint/types";

export default {
  extends: ["@commitlint/config-conventional"],
  ignores: [(commit) => commit.startsWith("chore(release): ")],
  rules: {
    "scope-enum": [
      RuleConfigSeverity.Error,
      "always",
      ["asc", "core", "gsc", "index-now", "pagespeed"],
    ],
    "type-enum": [
      RuleConfigSeverity.Error,
      "always",
      [
        "build",
        "chore",
        "ci",
        "docs",
        "feat",
        "fix",
        "perf",
        "refactor",
        "revert",
        "style",
        "test",
      ],
    ],
  },
} satisfies UserConfig;

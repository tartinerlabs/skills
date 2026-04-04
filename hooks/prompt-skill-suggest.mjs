#!/usr/bin/env node

/**
 * UserPromptSubmit hook — passively suggests tartinerlabs skills
 * based on keyword matches in the user's prompt.
 */

const SKILLS = [
  {
    name: "commit",
    keywords: ["commit", "stage", "staged", "git add", "save changes", "git commit"],
    description: "clean commits with conventional format and GitLeaks scanning",
  },
  {
    name: "create-branch",
    keywords: ["create branch", "new branch", "checkout", "feature branch", "start work on"],
    description: "branch naming validation and GitHub issue linking",
  },
  {
    name: "create-pr",
    keywords: ["pull request", "open pr", "create pr", "submit pr", "push branch", "merge request"],
    description: "GitHub PRs with auto-assignment and structured description",
  },
  {
    name: "github-actions",
    keywords: ["github action", "workflow", "ci/cd", "ci cd", "action pinning", ".github/workflows"],
    description: "workflow auditing for SHA pinning and permissions",
  },
  {
    name: "github-issues",
    keywords: ["file issue", "create issue", "bug report", "feature request", "github issue", "open issue"],
    description: "GitHub issues with templates and auto-assignment",
  },
  {
    name: "recharts",
    keywords: ["recharts", "data visuali", "bar chart", "line chart", "pie chart", "area chart"],
    description: "Recharts charts styled for HeroUI",
  },
  {
    name: "refactor",
    keywords: ["refactor", "code smell", "dead code", "code quality", "clean up code", "reduce complexity"],
    description: "TS/JS audit for dead code, nesting, and patterns",
  },
  {
    name: "security",
    keywords: ["security audit", "vulnerability", "owasp", "secret scan", "gitleaks", "security review", "cve", "dependency audit"],
    description: "OWASP Top 10 audit with GitLeaks and dependency checks",
  },
  {
    name: "tailwind",
    keywords: ["tailwind", "spacing issue", "css class", "mobile-first"],
    description: "Tailwind v4 best practices for grid and responsive",
  },
  {
    name: "testing",
    keywords: ["write test", "run test", "test coverage", "unit test", "component test", "vitest", "testing library", "test fail"],
    description: "unit and component testing with Vitest and React Testing Library",
  },
  {
    name: "deps",
    keywords: ["supply chain", "npm harden", "dependency pin", ".npmrc", "renovate", "lockfile integrity", "audit workflow", "version pinning"],
    description: "npm supply chain hardening with .npmrc, pinning, Renovate, and audit CI",
  },
];

const MIN_PROMPT_LENGTH = 15;

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data.trim()));
  });
}

function matchSkills(prompt) {
  const normalised = prompt.toLowerCase();
  const matched = [];

  for (const skill of SKILLS) {
    for (const keyword of skill.keywords) {
      if (normalised.includes(keyword)) {
        matched.push(skill);
        break;
      }
    }
  }

  return matched;
}

async function main() {
  const raw = await readStdin();
  if (!raw) {
    process.stdout.write("{}");
    return;
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.stdout.write("{}");
    return;
  }

  const prompt = input.prompt || "";
  if (prompt.length < MIN_PROMPT_LENGTH) {
    process.stdout.write("{}");
    return;
  }

  const matches = matchSkills(prompt);
  if (matches.length === 0) {
    process.stdout.write("{}");
    return;
  }

  const suggestions = matches
    .map((skill) => `  - /tartinerlabs:${skill.name} — ${skill.description}`)
    .join("\n");

  const context =
    `[tartinerlabs] Skills that may help:\n${suggestions}`;

  const output = {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: context,
    },
  };

  process.stdout.write(JSON.stringify(output));
}

main();

#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name eval
git config user.email eval@example.invalid

printf 'export default { extends: ["@commitlint/config-conventional"] };\n' > commitlint.config.js
printf '# dates\n' > README.md
git add . && git commit -qm "docs: add readme"
git switch -q -c feat/date-parsing
printf 'export function parseDate(value) {\n  return new Date(valeu);\n}\n' > dates.js
git add . && git commit -qm "feat: add date parsing utility"
printf 'export function parseDate(value) {\n  return new Date(value);\n}\n' > dates.js

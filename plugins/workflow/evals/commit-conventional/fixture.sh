#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name eval
git config user.email eval@example.invalid

printf 'export default { extends: ["@commitlint/config-conventional"] };\n' > commitlint.config.js
printf 'export function add(a, b) {\n  return a + b;\n}\n' > math.js
git add . && git commit -qm "feat: add addition helper"
printf '# math\n' > README.md
git add . && git commit -qm "docs: add readme"
printf '\nexport function subtract(a, b) {\n  return a - b;\n}\n' >> math.js

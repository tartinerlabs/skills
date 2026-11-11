#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name eval
git config user.email eval@example.invalid

for n in one two three four five six seven eight nine ten eleven twelve; do
  printf '%s\n' "$n" > "$n.txt"
  git add . && git commit -qm "Add $n notes file"
done
printf 'thirteen\n' > thirteen.txt

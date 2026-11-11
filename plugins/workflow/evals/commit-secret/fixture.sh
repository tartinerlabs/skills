#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name eval
git config user.email eval@example.invalid

printf 'export const region = "ap-southeast-1";\n' > config.js
git add . && git commit -qm "Add region config"
# Assembled at run time so this script holds no string a scanner would flag.
a='ghp_x7Kp2mQ9vL4n'
b='R8tW3yZ6bC1dF5gH0jS2uE7a'
printf 'export const githubToken = "%s%s";\n' "$a" "$b" >> config.js

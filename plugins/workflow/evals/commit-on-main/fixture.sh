#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name eval
git config user.email eval@example.invalid
git remote add origin https://github.com/example/shop.git

printf 'export default { extends: ["@commitlint/config-conventional"] };\n' > commitlint.config.js
printf '# shop\n' > README.md
git add . && git commit -qm "docs: add readme"
git switch -q -c feat/cart && printf 'export const cart = [];\n' > cart.js
git add . && git commit -qm "feat: add cart"
git switch -q main && git merge -q --no-ff feat/cart -m "Merge pull request #1 from example/feat/cart" && git branch -q -D feat/cart
printf 'export function searchOrders(orders, term) {\n  return orders.filter((order) => order.customer.includes(term));\n}\n' > search.js

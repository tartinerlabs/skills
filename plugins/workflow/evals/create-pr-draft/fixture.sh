#!/usr/bin/env bash
set -euo pipefail
git init -q -b main
git config user.name eval
git config user.email eval@example.invalid

printf 'export default { extends: ["@commitlint/config-conventional"] };\n' > commitlint.config.js
printf '# shop\n' > README.md
git add . && git commit -qm "docs: add readme"
git switch -q -c feat/order-search
printf 'export function searchOrders(orders, term) {\n  return orders.filter((order) => order.customer.includes(term));\n}\n' > search.js
git add . && git commit -qm "feat: add order search by customer"
printf 'import { searchOrders } from "./search.js";\n\nexport function handler(request, orders) {\n  return searchOrders(orders, request.query.term);\n}\n' > route.js
git add . && git commit -qm "feat: expose order search route"

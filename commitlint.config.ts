export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-empty": [2, "always"],
    "header-max-length": [2, "always", 50],
  },
};

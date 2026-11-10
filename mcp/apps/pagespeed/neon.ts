import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  // New non-default branches expire after 7 days.
  branch: (branch) =>
    !branch.isDefault && !branch.exists ? { ttl: "7d" } : {},
});

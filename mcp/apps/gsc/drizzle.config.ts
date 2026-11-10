import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema",
  // Only manage our tables: Neon Auth owns the `neon_auth` schema on the same database.
  schemaFilter: ["public"],
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED as string },
});

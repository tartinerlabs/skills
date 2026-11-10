import { defineConfig } from "drizzle-kit";

// D1 over Cloudflare's HTTP API: no account or database is hardcoded.
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./src/db/schema",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID as string,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID as string,
    token: process.env.CLOUDFLARE_API_TOKEN as string,
  },
});

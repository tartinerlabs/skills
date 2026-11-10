import { createPages } from "@repo/core/pages";
import { auth } from "./lib/auth.ts";
import { logger } from "./utils/logger.ts";

export const { signInPage, consentPage } = createPages({
  auth,
  logger,
  serverName: "this Google Search Console MCP server",
  access: "read-only access to your Search Console data",
});

import { createPages } from "@repo/core/pages";
import { auth } from "./lib/auth.ts";
import { logger } from "./utils/logger.ts";

export const { signInPage, consentPage } = createPages({
  auth,
  logger,
  serverName: "this PageSpeed Insights MCP server",
  access:
    "read-only access to public PageSpeed Insights and Chrome UX Report data",
});

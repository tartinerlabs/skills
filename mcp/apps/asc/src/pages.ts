import { createKeyPages } from "@repo/core/keys";
import { createPages } from "@repo/core/pages";
import { keyStore } from "./db/key-store.ts";
import { auth } from "./lib/auth.ts";
import { keyFormSchema } from "./schemas/common.ts";
import { logger } from "./utils/logger.ts";

const serverName = "this App Store Connect MCP server";

export const { signInPage, consentPage } = createPages({
  auth,
  logger,
  serverName,
  access:
    "read-only access to App Store Connect with the API keys you store on this server",
});

export const { keysPage, addKey, removeKey } = createKeyPages({
  auth,
  logger,
  serverName,
  store: keyStore,
  schema: keyFormSchema,
  secretField: "privateKey",
  describe: ({ keyId, issuerId }) =>
    `Key ${keyId} (${issuerId ? "team" : "individual"})`,
});

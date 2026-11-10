import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpEndpoint } from "@repo/core/http";
import { getUserAscClient } from "./asc/client.ts";
import { keyStore } from "./db/key-store.ts";
import { auth, vars } from "./lib/auth.ts";
import { createServer } from "./server.ts";
import { CredentialsError } from "./utils/errors.ts";
import { logger } from "./utils/logger.ts";

function userIdOf(authInfo: AuthInfo | undefined): string {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== "string") {
    throw new CredentialsError(
      "The request is not linked to a signed-in user. Reconnect the server in your MCP client.",
    );
  }
  return userId;
}

const keysUrl = new URL("/keys", vars.BETTER_AUTH_URL).href;

export const handleMcp = createMcpEndpoint({
  auth,
  logger,
  env: vars,
  createServer: (authInfo) =>
    createServer((keyId) =>
      getUserAscClient(userIdOf(authInfo), keyId, {
        store: keyStore,
        auth,
        keysUrl,
      }),
    ),
});

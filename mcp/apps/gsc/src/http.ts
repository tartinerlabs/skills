import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpEndpoint } from "@repo/core/http";
import { getUserGscClient } from "./google/client.ts";
import { auth, WRITE_ENABLED } from "./lib/auth.ts";
import { createServer } from "./server.ts";
import { CredentialsError } from "./utils/errors.ts";
import { logger } from "./utils/logger.ts";

function userIdOf(authInfo: AuthInfo | undefined): string {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== "string") {
    throw new CredentialsError(
      "The request is not linked to a signed-in user.",
    );
  }
  return userId;
}

export const handleMcp = createMcpEndpoint({
  auth,
  logger,
  createServer: (authInfo) =>
    createServer(() => getUserGscClient(userIdOf(authInfo)), {
      allowWrite: WRITE_ENABLED,
    }),
});

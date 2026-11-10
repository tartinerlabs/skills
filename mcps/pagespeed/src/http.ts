import { createMcpEndpoint } from "@repo/core/http";
import { createPageSpeedClient } from "./google/client.ts";
import { auth } from "./lib/auth.ts";
import { createServer } from "./server.ts";
import { logger } from "./utils/logger.ts";

export const handleMcp = createMcpEndpoint({
  auth,
  logger,
  createServer: () => createServer(createPageSpeedClient),
});

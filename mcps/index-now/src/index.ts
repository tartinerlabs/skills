#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { indexNowClient } from "./indexnow/client.ts";
import { createServer } from "./server.ts";
import { logger } from "./utils/logger.ts";

// Runs on the user's machine so IndexNow sees their IP: cloud egress IPs are
// shared with every other tenant and IndexNow rate-limits them permanently.
serveStdio(() => createServer(() => indexNowClient), {
  onerror: (error) =>
    logger.error(
      { errorName: error.name, errorMessage: error.message },
      "MCP stdio error",
    ),
});

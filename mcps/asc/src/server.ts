import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import pkg from "../package.json" with { type: "json" };
import type { AscClientProvider } from "./asc/client.ts";
import { registerAppVersionsTool } from "./tools/app-versions.ts";
import { registerCustomerReviewsTool } from "./tools/customer-reviews.ts";
import { registerListAppsTool } from "./tools/list-apps.ts";
import { registerListBuildsTool } from "./tools/list-builds.ts";

const SERVER_NAME = "app-store-connect";
const SERVER_VERSION = pkg.version;

/** Server factory for the HTTP handler. */
export function createServer(getClient: AscClientProvider): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "ping",
    {
      title: "Ping",
      description: "Check whether the App Store Connect MCP server is running.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => ({
      content: [{ type: "text", text: "App Store Connect MCP is running." }],
    }),
  );

  registerListAppsTool(server, getClient);
  registerAppVersionsTool(server, getClient);
  registerListBuildsTool(server, getClient);
  registerCustomerReviewsTool(server, getClient);

  return server;
}

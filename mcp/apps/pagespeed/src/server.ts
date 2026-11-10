import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import pkg from "../package.json" with { type: "json" };
import type { PageSpeedClientProvider } from "./google/client.ts";
import { registerCruxTool } from "./tools/crux.ts";
import { registerCruxHistoryTool } from "./tools/crux-history.ts";
import { registerPagespeedTool } from "./tools/pagespeed.ts";

const SERVER_NAME = "pagespeed";
const SERVER_VERSION = pkg.version;

/** Server factory for the HTTP handler. */
export function createServer(getClient: PageSpeedClientProvider): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "ping",
    {
      title: "Ping",
      description:
        "Check whether the PageSpeed Insights MCP server is running.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => ({
      content: [{ type: "text", text: "PageSpeed Insights MCP is running." }],
    }),
  );

  registerPagespeedTool(server, getClient);
  registerCruxTool(server, getClient);
  registerCruxHistoryTool(server, getClient);

  return server;
}

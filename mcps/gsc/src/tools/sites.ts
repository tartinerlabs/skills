import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type { GscClientProvider } from "../google/client.ts";
import { toToolError } from "../utils/errors.ts";

export function registerSitesTool(
  server: McpServer,
  getClient: GscClientProvider,
): void {
  server.registerTool(
    "list_sites",
    {
      title: "List Search Console properties",
      description:
        "List the Search Console properties (sites) the authenticated Google account can access, with its permission level for each.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const response = await (await getClient()).listSites();
        const sites = (response.siteEntry ?? []).map((entry) => ({
          siteUrl: entry.siteUrl ?? null,
          permissionLevel: entry.permissionLevel ?? null,
        }));
        const result = {
          sites,
          ...(sites.length === 0 && {
            note: "No properties found. Add or verify a property in Search Console, or sign in with an account that has access.",
          }),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toToolError("list_sites", error);
      }
    },
  );
}

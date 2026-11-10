import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import {
  type AscClientProvider,
  type AscDocument,
  pageInfo,
} from "../asc/client.ts";
import { keyIdSchema, limitSchema } from "../schemas/common.ts";
import { toToolError } from "../utils/errors.ts";

interface AppAttributes {
  name?: string;
  bundleId?: string;
  sku?: string;
  primaryLocale?: string;
}

const inputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .describe("Only apps with this name."),
  bundle_id: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .describe("Only the app with this bundle ID, such as com.example.app."),
  sort: z
    .enum(["name", "-name", "bundleId", "-bundleId", "sku", "-sku"])
    .default("name")
    .describe("Sort order; a leading - sorts descending (default name)."),
  limit: limitSchema,
  key_id: keyIdSchema,
});

export function registerListAppsTool(
  server: McpServer,
  getClient: AscClientProvider,
): void {
  server.registerTool(
    "list_apps",
    {
      title: "List apps",
      description:
        "Apps in the App Store Connect team (or individual account) of your API key: id, name, bundle ID, SKU and primary locale. " +
        "Use the id as app_id in the other tools.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      try {
        const client = await getClient(input.key_id);
        const response = await client.get<AscDocument<AppAttributes>>(
          "/v1/apps",
          {
            "filter[name]": input.name,
            "filter[bundleId]": input.bundle_id,
            sort: input.sort,
            "fields[apps]": ["name", "bundleId", "sku", "primaryLocale"],
            limit: input.limit,
          },
        );
        const result = {
          apps: response.data.map((app) => ({
            id: app.id,
            name: app.attributes?.name,
            bundleId: app.attributes?.bundleId,
            sku: app.attributes?.sku,
            primaryLocale: app.attributes?.primaryLocale,
          })),
          ...pageInfo(response),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toToolError("list_apps", error);
      }
    },
  );
}

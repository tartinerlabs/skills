import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type { GscClientProvider } from "../google/client.ts";
import {
  httpUrlSchema,
  isUrlInProperty,
  siteUrlSchema,
} from "../schemas/common.ts";
import { toToolError, UnexpectedResponseError } from "../utils/errors.ts";

const inputSchema = z
  .object({
    siteUrl: siteUrlSchema,
    inspectionUrl: httpUrlSchema.describe(
      "Fully qualified URL to inspect; must belong to the property given in siteUrl.",
    ),
    languageCode: z
      .string()
      .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, {
        message: "languageCode must be a BCP-47 language tag such as en-US.",
      })
      .optional()
      .describe(
        "BCP-47 language for translated issue messages (default en-US).",
      ),
  })
  .refine((input) => isUrlInProperty(input.inspectionUrl, input.siteUrl), {
    message: "inspectionUrl must be under the property given in siteUrl.",
    path: ["inspectionUrl"],
  });

export function registerInspectionTool(
  server: McpServer,
  getClient: GscClientProvider,
): void {
  server.registerTool(
    "inspect_url",
    {
      title: "Inspect a URL",
      description:
        "Inspect the indexed version of a URL in Google's index (URL Inspection API): index verdict, coverage state, " +
        "crawl details, canonicals, robots.txt and fetch state, plus AMP, mobile usability and rich results when available. " +
        "Quota: 2,000 inspections per property per day.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ siteUrl, inspectionUrl, languageCode }) => {
      try {
        const response = await (await getClient()).inspectUrl({
          siteUrl,
          inspectionUrl,
          languageCode,
        });
        if (!response.inspectionResult) {
          throw new UnexpectedResponseError(
            "Google returned no inspection result for this URL. Retry later or check the URL in the Search Console UI.",
          );
        }
        const result = {
          siteUrl,
          inspectionUrl,
          inspectionResult: response.inspectionResult,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toToolError("inspect_url", error);
      }
    },
  );
}

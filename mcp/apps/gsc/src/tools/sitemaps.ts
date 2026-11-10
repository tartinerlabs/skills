import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type { GscClientProvider } from "../google/client.ts";
import {
  httpUrlSchema,
  isUrlInProperty,
  siteUrlSchema,
} from "../schemas/common.ts";
import { toToolError } from "../utils/errors.ts";

export function registerSitemapsTool(
  server: McpServer,
  getClient: GscClientProvider,
): void {
  server.registerTool(
    "list_sitemaps",
    {
      title: "List submitted sitemaps",
      description:
        "List the sitemaps submitted for a Search Console property, with submission/download dates, error and warning counts and submitted URL counts.",
      inputSchema: z.object({ siteUrl: siteUrlSchema }),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ siteUrl }) => {
      try {
        const response = await (await getClient()).listSitemaps(siteUrl);
        const sitemaps = (response.sitemap ?? []).map((sitemap) => ({
          path: sitemap.path ?? null,
          type: sitemap.type ?? null,
          isPending: sitemap.isPending ?? null,
          isSitemapsIndex: sitemap.isSitemapsIndex ?? null,
          lastSubmitted: sitemap.lastSubmitted ?? null,
          lastDownloaded: sitemap.lastDownloaded ?? null,
          errors: sitemap.errors ?? null,
          warnings: sitemap.warnings ?? null,
          contents: (sitemap.contents ?? []).map((content) => ({
            type: content.type ?? null,
            submitted: content.submitted ?? null,
          })),
        }));
        const result = {
          siteUrl,
          sitemaps,
          ...(sitemaps.length === 0 && {
            note: "No sitemaps have been submitted for this property.",
          }),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toToolError("list_sitemaps", error);
      }
    },
  );
}

export function registerSubmitSitemapTool(
  server: McpServer,
  getClient: GscClientProvider,
): void {
  server.registerTool(
    "submit_sitemap",
    {
      title: "Submit a sitemap",
      description:
        "Submit (or resubmit) a sitemap for a Search Console property so Google fetches it. The sitemap URL must belong to the property.",
      inputSchema: z
        .object({
          siteUrl: siteUrlSchema,
          sitemapUrl: httpUrlSchema.describe(
            "Absolute URL of the sitemap, e.g. https://www.example.com/sitemap.xml",
          ),
        })
        .refine(
          ({ siteUrl, sitemapUrl }) => isUrlInProperty(sitemapUrl, siteUrl),
          {
            message: "sitemapUrl must be under the property given in siteUrl.",
            path: ["sitemapUrl"],
          },
        ),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ siteUrl, sitemapUrl }) => {
      try {
        await (await getClient()).submitSitemap(siteUrl, sitemapUrl);
        const result = {
          siteUrl,
          sitemapUrl,
          submitted: true,
          note: "Google fetches the sitemap asynchronously; check list_sitemaps later for its status.",
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toToolError("submit_sitemap", error);
      }
    },
  );
}

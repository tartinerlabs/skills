import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import {
  type AscClientProvider,
  type AscDocument,
  pageInfo,
  related,
} from "../asc/client.ts";
import { appIdSchema, keyIdSchema, limitSchema } from "../schemas/common.ts";
import { toToolError } from "../utils/errors.ts";

interface BuildAttributes {
  version?: string;
  uploadedDate?: string;
  expirationDate?: string;
  expired?: boolean;
  minOsVersion?: string;
  processingState?: string;
  buildAudienceType?: string | null;
}

interface PreReleaseVersionAttributes {
  version?: string;
  platform?: string;
}

const inputSchema = z.object({
  app_id: appIdSchema,
  processing_state: z
    .array(z.enum(["PROCESSING", "FAILED", "INVALID", "VALID"]))
    .min(1)
    .optional()
    .describe("Only builds in these processing states."),
  expired: z
    .boolean()
    .optional()
    .describe("true for expired builds only, false for unexpired only."),
  version: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe("Only builds with this build number (CFBundleVersion)."),
  limit: limitSchema,
  key_id: keyIdSchema,
});

export function registerListBuildsTool(
  server: McpServer,
  getClient: AscClientProvider,
): void {
  server.registerTool(
    "list_builds",
    {
      title: "List builds",
      description:
        "An app's builds, newest upload first: build number, marketing version and platform, processing state, " +
        "upload and expiry dates, audience and minimum OS version.",
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
        const response = await client.get<AscDocument<BuildAttributes>>(
          "/v1/builds",
          {
            "filter[app]": input.app_id,
            "filter[processingState]": input.processing_state,
            "filter[expired]": input.expired,
            "filter[version]": input.version,
            sort: "-uploadedDate",
            include: "preReleaseVersion",
            "fields[builds]": [
              "version",
              "uploadedDate",
              "expirationDate",
              "expired",
              "minOsVersion",
              "processingState",
              "buildAudienceType",
              "preReleaseVersion",
            ],
            "fields[preReleaseVersions]": ["version", "platform"],
            limit: input.limit,
          },
        );
        const result = {
          builds: response.data.map((build) => {
            const preRelease = related<PreReleaseVersionAttributes>(
              response,
              build,
              "preReleaseVersion",
            );
            return {
              id: build.id,
              version: build.attributes?.version,
              marketingVersion: preRelease?.version,
              platform: preRelease?.platform,
              processingState: build.attributes?.processingState,
              uploadedDate: build.attributes?.uploadedDate,
              expirationDate: build.attributes?.expirationDate,
              expired: build.attributes?.expired,
              buildAudienceType: build.attributes?.buildAudienceType,
              minOsVersion: build.attributes?.minOsVersion,
            };
          }),
          ...pageInfo(response),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toToolError("list_builds", error);
      }
    },
  );
}

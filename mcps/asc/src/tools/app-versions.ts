import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import {
  type AscClientProvider,
  type AscDocument,
  pageInfo,
  related,
} from "../asc/client.ts";
import {
  appIdSchema,
  keyIdSchema,
  limitSchema,
  PLATFORMS,
} from "../schemas/common.ts";
import { toToolError } from "../utils/errors.ts";

/** `AppVersionState` in the App Store Connect API 4.5 spec. */
const APP_VERSION_STATES = [
  "ACCEPTED",
  "DEVELOPER_REJECTED",
  "IN_REVIEW",
  "INVALID_BINARY",
  "METADATA_REJECTED",
  "PENDING_APPLE_RELEASE",
  "PENDING_DEVELOPER_RELEASE",
  "PREPARE_FOR_SUBMISSION",
  "PROCESSING_FOR_DISTRIBUTION",
  "READY_FOR_DISTRIBUTION",
  "READY_FOR_REVIEW",
  "REJECTED",
  "REPLACED_WITH_NEW_VERSION",
  "WAITING_FOR_EXPORT_COMPLIANCE",
  "WAITING_FOR_REVIEW",
] as const;

interface VersionAttributes {
  platform?: string;
  versionString?: string;
  appVersionState?: string;
  appStoreState?: string;
  releaseType?: string;
  earliestReleaseDate?: string | null;
  createdDate?: string;
}

const inputSchema = z.object({
  app_id: appIdSchema,
  platform: z
    .enum(PLATFORMS)
    .optional()
    .describe("Only versions for this platform."),
  app_version_state: z
    .array(z.enum(APP_VERSION_STATES))
    .min(1)
    .optional()
    .describe("Only versions in these states, such as IN_REVIEW or REJECTED."),
  limit: limitSchema,
  key_id: keyIdSchema,
});

export function registerAppVersionsTool(
  server: McpServer,
  getClient: AscClientProvider,
): void {
  server.registerTool(
    "app_versions",
    {
      title: "List App Store versions",
      description:
        "App Store versions of an app, newest first: version string, platform, appVersionState (IN_REVIEW, REJECTED, " +
        "READY_FOR_DISTRIBUTION, ...), the legacy appStoreState, release type and date, and the attached build number.",
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
        const response = await client.get<AscDocument<VersionAttributes>>(
          `/v1/apps/${input.app_id}/appStoreVersions`,
          {
            "filter[platform]": input.platform,
            "filter[appVersionState]": input.app_version_state,
            include: "build",
            "fields[appStoreVersions]": [
              "platform",
              "versionString",
              "appVersionState",
              "appStoreState",
              "releaseType",
              "earliestReleaseDate",
              "createdDate",
              "build",
            ],
            "fields[builds]": "version",
            limit: input.limit,
          },
        );
        const versions = response.data
          .map((version) => ({
            id: version.id,
            platform: version.attributes?.platform,
            versionString: version.attributes?.versionString,
            appVersionState: version.attributes?.appVersionState,
            appStoreState: version.attributes?.appStoreState,
            releaseType: version.attributes?.releaseType,
            earliestReleaseDate: version.attributes?.earliestReleaseDate,
            createdDate: version.attributes?.createdDate,
            build: related<{ version?: string }>(response, version, "build")
              ?.version,
          }))
          // The endpoint has no sort parameter.
          .sort((a, b) =>
            (b.createdDate ?? "").localeCompare(a.createdDate ?? ""),
          );
        const result = { versions, ...pageInfo(response) };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toToolError("app_versions", error);
      }
    },
  );
}

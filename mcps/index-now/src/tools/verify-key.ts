import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type { IndexNowClientProvider } from "../indexnow/client.ts";
import { checkKeyFile, isCoveredBy, keyFileUrl } from "../indexnow/key.ts";
import {
  keyLocationSchema,
  keySchema,
  parsePublicUrl,
  publicUrlSchema,
} from "../schemas/common.ts";
import { toToolError } from "../utils/errors.ts";

const inputSchema = z
  .object({
    url: publicUrlSchema.describe(
      "The site, or any page on it, such as https://example.com.",
    ),
    key: keySchema,
    keyLocation: keyLocationSchema,
  })
  .refine(
    (input) =>
      input.keyLocation === undefined ||
      // Field checks already reported unparsable URLs.
      parsePublicUrl(input.url) === undefined ||
      parsePublicUrl(input.keyLocation) === undefined ||
      isCoveredBy(input.url, input.keyLocation),
    {
      message:
        "keyLocation must be on the same host as url, in its directory or above.",
      path: ["keyLocation"],
    },
  );

export function registerVerifyKeyTool(
  server: McpServer,
  getClient: IndexNowClientProvider,
): void {
  server.registerTool(
    "verify_key",
    {
      title: "Verify an IndexNow key file",
      description:
        "Check that the live site serves the project's IndexNow key file with the key as its contents, " +
        "as IndexNow will before accepting submissions. Submits nothing.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ url, key, keyLocation }) => {
      try {
        const location = keyFileUrl(url, key, keyLocation);
        const reason = await checkKeyFile(await getClient(), location, key);
        const result = reason
          ? { valid: false, keyLocation: location, reason }
          : { valid: true, keyLocation: location };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toToolError("verify_key", error);
      }
    },
  );
}

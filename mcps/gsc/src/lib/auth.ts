import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { createAuth } from "@repo/core/auth";
import { db } from "../db/index.ts";
import * as schema from "../db/schema/auth.ts";

/** Google scope for read-only Search Console access. */
export const READ_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
/** Google scope for read/write Search Console access (includes reading). */
export const WRITE_SCOPE = "https://www.googleapis.com/auth/webmasters";

/** Opt-in: request the write scope and register `submit_sitemap`. */
export const WRITE_ENABLED = process.env.GSC_ENABLE_WRITE === "true";

export const SCOPES = [WRITE_ENABLED ? WRITE_SCOPE : READ_SCOPE];

export const auth = createAuth({
  db,
  schema,
  scopes: SCOPES,
  fetchClientMetadataResource,
});

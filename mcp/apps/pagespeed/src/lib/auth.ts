import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { createAuth } from "@repo/core/auth";
import { db } from "../db/index.ts";
import * as schema from "../db/schema/auth.ts";

// Sign-in only identifies the user: PageSpeed Insights and CrUX are called
// with the server's API key, so no extra Google scopes are requested.
export const auth = createAuth({
  db,
  schema,
  scopes: [],
  fetchClientMetadataResource,
});

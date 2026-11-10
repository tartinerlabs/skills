import { env, waitUntil } from "cloudflare:workers";
import { createAuth } from "@repo/core/auth";
import { fetchClientMetadataResource } from "@repo/core/cimd";
import { type Env, processEnv } from "@repo/core/env";
import { db } from "../db/index.ts";
import * as schema from "../db/schema/auth.ts";

// Vars and secrets are set in the dashboard, so the generated Env types only DB.
const workerVars = env as unknown as Env;

// The Better Auth CLI (auth:generate) stubs cloudflare:workers with proxies,
// so it reads process.env instead, as the other apps do.
export const vars =
  typeof workerVars.BETTER_AUTH_URL === "string" ? workerVars : processEnv();

// Sign-in only identifies the user: App Store Connect is called with the
// user's own API key, so no extra Google scopes are requested.
export const auth = createAuth({
  db,
  schema,
  scopes: [],
  provider: "sqlite",
  fetchClientMetadataResource,
  backgroundTasks: waitUntil,
  env: vars,
});

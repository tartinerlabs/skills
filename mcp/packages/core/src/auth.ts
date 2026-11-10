import { cimd } from "@better-auth/cimd";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { mcp } from "@better-auth/mcp";
import type { ClientMetadataResourceFetch } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { type Env, processEnv } from "./env.ts";

export interface AuthOptions {
  /** Any app's Drizzle database: node-postgres on Neon, or D1. */
  db: Parameters<typeof drizzleAdapter>[0];
  schema: Record<string, unknown>;
  /** Google OAuth scopes requested at sign-in. */
  scopes: string[];
  /** @default "pg" */
  provider?: "pg" | "sqlite";
  /** @default true for "pg", false for "sqlite" (D1 rejects BEGIN) */
  transaction?: boolean;
  /** CIMD metadata transport: `@better-auth/cimd/node` on Node, `@repo/core/cimd` on Workers. */
  fetchClientMetadataResource: ClientMetadataResourceFetch;
  /** Keeps background work alive after the response, e.g. a Worker's `waitUntil`. */
  backgroundTasks?: (promise: Promise<unknown>) => void;
  /** @default process.env */
  env?: Env;
}

/** The MCP endpoint: the protected resource access tokens are bound to. */
export function mcpResource(env: Env = processEnv()): string {
  return new URL("/mcp", env.BETTER_AUTH_URL).href;
}

/**
 * Better Auth as the OAuth 2.1 authorisation server for MCP clients, with
 * Google as the only sign-in provider.
 */
export function createAuth({
  db,
  schema,
  scopes,
  provider = "pg",
  transaction = provider === "pg",
  fetchClientMetadataResource,
  backgroundTasks,
  env = processEnv(),
}: AuthOptions) {
  return betterAuth({
    // Unset values fall back to Better Auth's own env reads, as before;
    // BETTER_AUTH_SECRETS (rotation) is still read by Better Auth itself.
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider,
      schema,
      usePlural: true,
      transaction,
    }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID as string,
        clientSecret: env.GOOGLE_CLIENT_SECRET as string,
        scope: scopes,
        accessType: "offline",
        prompt: "select_account consent",
      },
    },
    account: { encryptOAuthTokens: true },
    // A refreshed session cookie on /oauth2/authorize looks like a fresh
    // sign-in to the OAuth provider, which then skips `selectAccount` below.
    session: { disableSessionRefresh: true },
    advanced: {
      database: { generateId: "uuid" },
      backgroundTasks: backgroundTasks && { handler: backgroundTasks },
    },
    plugins: [
      jwt(),
      mcp({
        loginPage: "/sign-in",
        consentPage: "/consent",
        // An existing session and stored consent would otherwise authorise
        // silently; always go through Google's account chooser instead.
        selectAccount: { page: "/sign-in", shouldRedirect: () => true },
        resource: mcpResource(env),
      }),
      cimd({
        fetchClientMetadataResource,
        metadataProfile: "mcp-2026-07-28",
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

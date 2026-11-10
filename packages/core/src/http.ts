import { requireMcpAuth } from "@better-auth/mcp";
import {
  type AuthInfo,
  createMcpHandler,
  type McpServer,
  originValidationResponse,
} from "@modelcontextprotocol/server";
import { type Auth, mcpResource } from "./auth.ts";
import { type Env, processEnv } from "./env.ts";
import type { Logger } from "./logger.ts";

export interface McpEndpointOptions {
  auth: Auth;
  logger: Logger;
  /** Builds a fresh server per request, acting as the token's user. */
  createServer: (authInfo: AuthInfo | undefined) => McpServer;
  /** @default process.env */
  env?: Env;
}

/** The raw access token (Bearer or DPoP scheme) already verified by requireMcpAuth. */
function presentedToken(request: Request): string {
  return (request.headers.get("authorization") ?? "").replace(/^\S+\s+/, "");
}

/**
 * The MCP endpoint: Origin validation, then Better Auth's
 * `requireMcpAuth`, then the stateless MCP handler acting as the token's user.
 */
export function createMcpEndpoint({
  auth,
  logger,
  createServer,
  env = processEnv(),
}: McpEndpointOptions): (request: Request) => Promise<Response> {
  const resource = mcpResource(env);

  const handler = createMcpHandler((ctx) => createServer(ctx.authInfo), {
    // Only the 2026-07-28 protocol: @better-auth/mcp does not support 2025-era clients.
    legacy: "reject",
    onerror: (error) =>
      logger.error(
        { errorName: error.name, errorMessage: error.message },
        "MCP HTTP error",
      ),
  });

  const authorised = requireMcpAuth(
    auth,
    (request, claims) => {
      const authInfo: AuthInfo = {
        token: presentedToken(request),
        clientId: String(claims.azp ?? claims.client_id ?? ""),
        scopes: typeof claims.scope === "string" ? claims.scope.split(" ") : [],
        expiresAt: claims.exp,
        resource: new URL(resource),
        extra: { userId: claims.sub },
      };
      return handler.fetch(request, { authInfo });
    },
    { resource },
  );

  return async (request) => {
    // No allowlist: requests from web pages (with an Origin) are refused.
    const badOrigin = originValidationResponse(request, []);
    if (badOrigin) return badOrigin;
    return authorised(request);
  };
}

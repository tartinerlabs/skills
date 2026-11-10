import type { CallToolResult } from "@modelcontextprotocol/server";
import { logger } from "./logger.ts";

type ErrorKind =
  | "invalid_input"
  | "auth"
  | "permission"
  | "quota"
  | "not_found"
  | "unavailable"
  | "network"
  | "unexpected";

/** Thrown when Google credentials are missing, unusable or must be renewed by signing in again. */
export class CredentialsError extends Error {
  override name = "CredentialsError";
}

/** Thrown when Google answers with a shape we cannot interpret. */
export class UnexpectedResponseError extends Error {
  override name = "UnexpectedResponseError";
}

interface ClassifiedError {
  kind: ErrorKind;
  message: string;
  status?: number;
  reason?: string;
}

const LOGIN_HINT =
  "Reconnect the server in your MCP client to sign in with Google again.";

const QUOTA_REASONS = new Set([
  "quotaExceeded",
  "rateLimitExceeded",
  "rateLimitExceededUnreg",
  "userRateLimitExceeded",
  "userRateLimitExceededUnreg",
  "dailyLimitExceeded",
  "dailyLimitExceededUnreg",
  "limitExceeded",
  "concurrentLimitExceeded",
  "servingLimitExceeded",
  "RATE_LIMIT_EXCEEDED",
  "RESOURCE_EXHAUSTED",
]);

const NETWORK_CODES = new Set([
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "TimeoutError",
  "AbortError",
]);

const MAX_GOOGLE_MESSAGE = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Google API error details pulled out of a GaxiosError-like value. */
interface GoogleErrorInfo {
  status?: number;
  reasons: string[];
  /** OAuth token-endpoint error code, e.g. `invalid_grant`. */
  oauthError?: string;
  googleMessage?: string;
  code?: string;
}

function inspect(error: unknown): GoogleErrorInfo {
  const info: GoogleErrorInfo = { reasons: [] };
  if (!isRecord(error)) return info;

  if (typeof error.status === "number") info.status = error.status;
  // Network failures surface as a code on the error or somewhere in its cause chain
  // (e.g. fetch's TypeError("fetch failed") with cause.code "ECONNRESET").
  let current: unknown = error;
  for (let depth = 0; depth < 4 && isRecord(current) && !info.code; depth++) {
    info.code = str(current.code);
    current = current.cause;
  }

  const response = error.response;
  if (!isRecord(response)) return info;
  if (info.status === undefined && typeof response.status === "number") {
    info.status = response.status;
  }

  const data = response.data;
  if (!isRecord(data)) return info;

  // OAuth token endpoint: { error: "invalid_grant", error_description: "..." }
  if (typeof data.error === "string") {
    info.oauthError = data.error;
    return info;
  }

  // Google API error: { error: { code, message, status, errors: [{ reason }], details: [{ reason }] } }
  const body = data.error;
  if (!isRecord(body)) return info;
  info.googleMessage = str(body.message);
  const status = str(body.status);
  if (status) info.reasons.push(status);
  for (const list of [body.errors, body.details]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (isRecord(item)) {
        const reason = str(item.reason);
        if (reason) info.reasons.push(reason);
      }
    }
  }
  return info;
}

function googleDetail(info: GoogleErrorInfo): string {
  if (!info.googleMessage) return "";
  const trimmed = info.googleMessage.slice(0, MAX_GOOGLE_MESSAGE);
  return ` Google said: "${trimmed}"`;
}

/** Classify any error thrown while talking to Google into an actionable, non-sensitive message. */
export function classifyError(error: unknown): ClassifiedError {
  if (error instanceof CredentialsError) {
    return { kind: "auth", message: `${error.message} ${LOGIN_HINT}` };
  }
  if (error instanceof UnexpectedResponseError) {
    return { kind: "unexpected", message: error.message };
  }

  const info = inspect(error);
  const message = error instanceof Error ? error.message : "";
  const base = {
    status: info.status,
    reason: info.reasons[0] ?? info.oauthError,
  };

  if (info.oauthError === "invalid_grant" || message === "invalid_grant") {
    return {
      ...base,
      kind: "auth",
      message:
        "Google rejected the stored refresh token (invalid_grant): it has expired or been revoked. " +
        "Refresh tokens for OAuth apps in 'Testing' publishing status expire after 7 days. " +
        LOGIN_HINT,
    };
  }
  if (
    info.oauthError === "invalid_client" ||
    info.oauthError === "unauthorized_client"
  ) {
    return {
      ...base,
      kind: "auth",
      message:
        "Google rejected the OAuth client ID or secret. Check the OAuth client configured in your " +
        `Google Cloud project. ${LOGIN_HINT}`,
    };
  }

  const status = info.status;
  if (status !== undefined) {
    if (status === 400) {
      return {
        ...base,
        kind: "invalid_input",
        message: `Google rejected the request as invalid.${googleDetail(info)}`,
      };
    }
    if (status === 401) {
      return {
        ...base,
        kind: "auth",
        message: `Google rejected the credentials (HTTP 401). They may have expired or been revoked. ${LOGIN_HINT}`,
      };
    }
    if (
      status === 429 ||
      (status === 403 && info.reasons.some((r) => QUOTA_REASONS.has(r)))
    ) {
      return {
        ...base,
        kind: "quota",
        message:
          "Search Console API quota or rate limit exceeded. Wait about 15 minutes and retry, " +
          "and prefer fewer, narrower requests (shorter date ranges, fewer page/query dimensions).",
      };
    }
    if (
      status === 403 &&
      info.reasons.some(
        (r) => r === "accessNotConfigured" || r === "SERVICE_DISABLED",
      )
    ) {
      return {
        ...base,
        kind: "permission",
        message:
          "The Google Search Console API is not enabled for the Google Cloud project that owns these " +
          "credentials. Enable it in the Google Cloud Console (APIs & Services > Library) and retry.",
      };
    }
    if (status === 403) {
      return {
        ...base,
        kind: "permission",
        message:
          "The authenticated Google account does not have permission for this property or operation. " +
          "Use list_sites to confirm the exact property URL (https://… with trailing slash, or sc-domain:…) " +
          "and that the account has access to it.",
      };
    }
    if (status === 404) {
      return {
        ...base,
        kind: "not_found",
        message:
          "Google could not find that property or resource. Use list_sites to get the exact property URL; " +
          "URL-prefix and Domain (sc-domain:) properties are distinct.",
      };
    }
    if (status >= 500) {
      return {
        ...base,
        kind: "unavailable",
        message: `Google Search Console is temporarily unavailable (HTTP ${status}). Retry shortly.`,
      };
    }
  }

  if (info.code && NETWORK_CODES.has(info.code)) {
    return {
      ...base,
      kind: "network",
      message: `Network error while contacting Google (${info.code}). Check connectivity and retry.`,
    };
  }

  return {
    ...base,
    kind: "unexpected",
    message:
      "Unexpected error while calling Google Search Console. Check the server logs for details.",
  };
}

/** Convert an error into an MCP tool result with `isError: true`, logging only non-sensitive fields. */
export function toToolError(tool: string, error: unknown): CallToolResult {
  const classified = classifyError(error);
  logger.warn(
    {
      tool,
      kind: classified.kind,
      status: classified.status,
      reason: classified.reason,
      errorName: error instanceof Error ? error.name : typeof error,
    },
    "tool call failed",
  );
  return {
    isError: true,
    content: [
      { type: "text", text: `[${classified.kind}] ${classified.message}` },
    ],
  };
}

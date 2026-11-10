import type { CallToolResult } from "@modelcontextprotocol/server";
import { logger } from "./logger.ts";

type ErrorKind =
  | "invalid_input"
  | "permission"
  | "quota"
  | "not_found"
  | "unavailable"
  | "network"
  | "unexpected";

/** Thrown when the server itself is missing configuration, such as GOOGLE_API_KEY. */
export class ConfigurationError extends Error {
  override name = "ConfigurationError";
}

/** Thrown for a non-2xx response from a Google API, carrying its JSON error body. */
export class GoogleApiError extends Error {
  override name = "GoogleApiError";
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, data: unknown) {
    super(`Google API request failed with HTTP ${status}`);
    this.status = status;
    this.data = data;
  }
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

const QUOTA_REASONS = new Set([
  "rateLimitExceeded",
  "dailyLimitExceeded",
  "quotaExceeded",
  "RATE_LIMIT_EXCEEDED",
  "RESOURCE_EXHAUSTED",
]);

const KEY_REASONS = new Set([
  "API_KEY_INVALID",
  "API_KEY_SERVICE_BLOCKED",
  "API_KEY_HTTP_REFERRER_BLOCKED",
  "API_KEY_IP_ADDRESS_BLOCKED",
  "SERVICE_DISABLED",
  "accessNotConfigured",
  "keyInvalid",
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
]);

const MAX_GOOGLE_MESSAGE = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Reasons and message from a Google API error body: `{ error: { message, status, errors, details } }`. */
function inspect(data: unknown): { reasons: string[]; message?: string } {
  const body = isRecord(data) ? data.error : undefined;
  if (!isRecord(body)) return { reasons: [] };
  const reasons: string[] = [];
  const status = str(body.status);
  if (status) reasons.push(status);
  for (const list of [body.errors, body.details]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const reason = isRecord(item) ? str(item.reason) : undefined;
      if (reason) reasons.push(reason);
    }
  }
  return { reasons, message: str(body.message) };
}

function googleDetail(message: string | undefined): string {
  return message
    ? ` Google said: "${message.slice(0, MAX_GOOGLE_MESSAGE)}"`
    : "";
}

/** The first network error code on the error or in its cause chain. */
function networkCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && isRecord(current); depth++) {
    const code = str(current.code);
    if (code && NETWORK_CODES.has(code)) return code;
    current = current.cause;
  }
  return undefined;
}

/** Classify any error thrown while talking to Google into an actionable, non-sensitive message. */
export function classifyError(error: unknown): ClassifiedError {
  if (error instanceof ConfigurationError) {
    return { kind: "unavailable", message: error.message };
  }
  if (error instanceof UnexpectedResponseError) {
    return { kind: "unexpected", message: error.message };
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return {
      kind: "network",
      message:
        "Google did not answer in time. PageSpeed Insights can take up to a minute for slow pages; retry shortly.",
    };
  }

  if (error instanceof GoogleApiError) {
    const { status } = error;
    const { reasons, message } = inspect(error.data);
    const base = { status, reason: reasons[0] };

    if (status === 429 || reasons.some((r) => QUOTA_REASONS.has(r))) {
      return {
        ...base,
        kind: "quota",
        message:
          "Google API quota or rate limit exceeded. The Chrome UX Report allows 150 queries per minute per Google Cloud project; " +
          "PageSpeed Insights has its own per-project quota. Wait a minute and retry.",
      };
    }
    if (reasons.some((r) => KEY_REASONS.has(r))) {
      return {
        ...base,
        kind: "permission",
        message:
          "The server's Google API key was rejected: it is invalid, restricted, or the PageSpeed Insights / Chrome UX Report API is not enabled for its Google Cloud project.",
      };
    }
    if (status === 400) {
      return {
        ...base,
        kind: "invalid_input",
        message: `Google rejected the request as invalid.${googleDetail(message)}`,
      };
    }
    if (status === 403) {
      return {
        ...base,
        kind: "permission",
        message: `Google refused the request (HTTP 403).${googleDetail(message)}`,
      };
    }
    if (status === 404) {
      return {
        ...base,
        kind: "not_found",
        message:
          "The Chrome UX Report has no field data for this URL or origin: it is not publicly reachable as given " +
          "(check the protocol and subdomain) or does not get enough Chrome traffic. " +
          "Try the origin instead of a single URL, or omit formFactor.",
      };
    }
    if (status >= 500) {
      return {
        ...base,
        kind: "unavailable",
        message: `Google could not complete the request (HTTP ${status}).${googleDetail(message)}`,
      };
    }
  }

  const code = networkCode(error);
  if (code) {
    return {
      kind: "network",
      message: `Network error while contacting Google (${code}). Check connectivity and retry.`,
    };
  }

  return {
    kind: "unexpected",
    message:
      "Unexpected error while calling Google. Check the server logs for details.",
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

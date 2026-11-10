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

/** Thrown for a non-2xx response from the IndexNow API, carrying its body. */
export class IndexNowApiError extends Error {
  override name = "IndexNowApiError";
  readonly status: number;
  readonly body: string;
  /** Seconds from a Retry-After header, when IndexNow sends one. */
  readonly retryAfter: number | undefined;

  constructor(status: number, body: string, retryAfter?: number) {
    super(`IndexNow request failed with HTTP ${status}`);
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
  }
}

/** Thrown when the site does not serve the key file IndexNow will check. */
export class KeyFileError extends Error {
  override name = "KeyFileError";
}

interface ClassifiedError {
  kind: ErrorKind;
  message: string;
  status?: number;
}

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

const MAX_INDEXNOW_MESSAGE = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** IndexNow answers errors as JSON `{ code, message }` or plain text. */
function indexNowDetail(body: string): string {
  let message: string | undefined = body.trim();
  try {
    const data: unknown = JSON.parse(body);
    if (isRecord(data)) message = str(data.message);
  } catch {
    // Plain text body.
  }
  return message
    ? ` IndexNow said: "${message.slice(0, MAX_INDEXNOW_MESSAGE)}"`
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

/** Classify any error thrown while talking to IndexNow or the site into an actionable message. */
export function classifyError(error: unknown): ClassifiedError {
  if (error instanceof KeyFileError) {
    return { kind: "not_found", message: error.message };
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return {
      kind: "network",
      message: "The request timed out. Retry shortly.",
    };
  }

  if (error instanceof IndexNowApiError) {
    const { status } = error;
    const detail = indexNowDetail(error.body);

    if (status === 429) {
      return {
        status,
        kind: "quota",
        message:
          "IndexNow is rate-limiting submissions (HTTP 429). Submit less often, batching URLs into one call.",
      };
    }
    if (status === 403) {
      return {
        status,
        kind: "permission",
        message: `IndexNow could not validate the key: the key file is missing, unreachable or does not match.${detail}`,
      };
    }
    if (status === 422) {
      return {
        status,
        kind: "invalid_input",
        message: `IndexNow rejected the URLs: they do not belong to the host, or the key does not match the key file.${detail}`,
      };
    }
    if (status === 400) {
      return {
        status,
        kind: "invalid_input",
        message: `IndexNow rejected the request as invalid.${detail}`,
      };
    }
    if (status >= 500) {
      return {
        status,
        kind: "unavailable",
        message: `IndexNow could not complete the request (HTTP ${status}). Retry later.`,
      };
    }
  }

  const code = networkCode(error);
  if (code) {
    return {
      kind: "network",
      message: `Network error (${code}). Check that the site is reachable and retry.`,
    };
  }

  return {
    kind: "unexpected",
    message: "Unexpected error. Check the server logs for details.",
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

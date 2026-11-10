import { describe, expect, it } from "vitest";
import {
  ConfigurationError,
  classifyError,
  GoogleApiError,
} from "../src/utils/errors.ts";

describe("classifyError", () => {
  it("should classify PageSpeed's daily quota error as quota", () => {
    // Real body returned by runPagespeed when the daily quota is exhausted.
    const error = new GoogleApiError(429, {
      error: {
        code: 429,
        message:
          "Quota exceeded for quota metric 'Queries' and limit 'Queries per day' of service 'pagespeedonline.googleapis.com'.",
        errors: [{ domain: "global", reason: "rateLimitExceeded" }],
        status: "RESOURCE_EXHAUSTED",
        details: [{ reason: "RATE_LIMIT_EXCEEDED" }],
      },
    });
    expect(classifyError(error)).toMatchObject({
      kind: "quota",
      status: 429,
      reason: "RESOURCE_EXHAUSTED",
    });
  });

  it("should classify a rejected API key as permission", () => {
    const error = new GoogleApiError(400, {
      error: {
        code: 400,
        message: "API key not valid. Please pass a valid API key.",
        status: "INVALID_ARGUMENT",
        details: [{ reason: "API_KEY_INVALID" }],
      },
    });
    expect(classifyError(error)).toMatchObject({ kind: "permission" });
  });

  it("should pass Lighthouse's own message through for a failed run", () => {
    const error = new GoogleApiError(500, {
      error: {
        code: 500,
        message:
          "Lighthouse returned error: FAILED_DOCUMENT_REQUEST. Lighthouse was unable to reliably load the page you requested.",
      },
    });
    const classified = classifyError(error);
    expect(classified.kind).toBe("unavailable");
    expect(classified.message).toContain("FAILED_DOCUMENT_REQUEST");
  });

  it("should classify a timeout as network", () => {
    const error = new DOMException("The operation timed out.", "TimeoutError");
    expect(classifyError(error).kind).toBe("network");
  });

  it("should classify a connection failure in the cause chain as network", () => {
    const error = new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect"), { code: "ECONNRESET" }),
    });
    expect(classifyError(error)).toMatchObject({
      kind: "network",
      message: expect.stringContaining("ECONNRESET"),
    });
  });

  it("should report a missing API key without leaking anything else", () => {
    expect(classifyError(new ConfigurationError("No GOOGLE_API_KEY."))).toEqual(
      { kind: "unavailable", message: "No GOOGLE_API_KEY." },
    );
  });
});

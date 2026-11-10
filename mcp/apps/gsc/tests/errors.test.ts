import { describe, expect, it } from "vitest";
import { CredentialsError, classifyError } from "../src/utils/errors.ts";
import { googleError } from "./helpers.ts";

function apiError(status: number, reason: string, message = "Google message") {
  return googleError(status, {
    error: {
      code: status,
      message,
      errors: [{ domain: "global", reason, message }],
    },
  });
}

describe("classifyError", () => {
  it("should map 400 to invalid input and include Google's message", () => {
    const result = classifyError(
      apiError(400, "invalid", "Invalid dimension: foo"),
    );
    expect(result.kind).toBe("invalid_input");
    expect(result.message).toContain("Invalid dimension: foo");
  });

  it("should truncate long Google messages", () => {
    const result = classifyError(apiError(400, "invalid", "x".repeat(1000)));
    expect(result.message.length).toBeLessThan(400);
  });

  it("should map 401 to an auth error with sign-in guidance", () => {
    const result = classifyError(apiError(401, "authError"));
    expect(result.kind).toBe("auth");
    expect(result.message).toContain("sign in with Google again");
  });

  it("should map invalid_grant to an auth error mentioning the Testing-mode expiry", () => {
    const result = classifyError(
      googleError(
        400,
        {
          error: "invalid_grant",
          error_description: "Token has been expired or revoked.",
        },
        "invalid_grant",
      ),
    );
    expect(result.kind).toBe("auth");
    expect(result.message).toContain("7 days");
  });

  it("should map invalid_client to an auth error", () => {
    expect(
      classifyError(googleError(401, { error: "invalid_client" })).kind,
    ).toBe("auth");
  });

  it.each([
    "rateLimitExceeded",
    "userRateLimitExceeded",
    "quotaExceeded",
    "dailyLimitExceeded",
  ])("should map 403 %s to quota", (reason) => {
    expect(classifyError(apiError(403, reason)).kind).toBe("quota");
  });

  it("should map AIP-193 RESOURCE_EXHAUSTED to quota", () => {
    const error = googleError(403, {
      error: {
        code: 403,
        status: "RESOURCE_EXHAUSTED",
        message: "Quota exceeded",
      },
    });
    expect(classifyError(error).kind).toBe("quota");
  });

  it("should map 403 insufficientPermissions to permission", () => {
    const result = classifyError(apiError(403, "insufficientPermissions"));
    expect(result.kind).toBe("permission");
    expect(result.message).toContain("list_sites");
  });

  it("should map 403 accessNotConfigured to an API-not-enabled message", () => {
    const result = classifyError(apiError(403, "accessNotConfigured"));
    expect(result.kind).toBe("permission");
    expect(result.message).toContain("not enabled");
  });

  it("should map 404 to not found", () => {
    expect(classifyError(apiError(404, "notFound")).kind).toBe("not_found");
  });

  it("should map 429 to quota", () => {
    expect(classifyError(apiError(429, "rateLimitExceeded")).kind).toBe(
      "quota",
    );
  });

  it.each([500, 502, 503])("should map %i to unavailable", (status) => {
    expect(classifyError(apiError(status, "backendError")).kind).toBe(
      "unavailable",
    );
  });

  it.each(["ECONNRESET", "ENOTFOUND", "ETIMEDOUT"])(
    "should map %s to network",
    (code) => {
      expect(
        classifyError(Object.assign(new Error("socket"), { code })).kind,
      ).toBe("network");
    },
  );

  it("should find network codes in the cause chain", () => {
    const cause = Object.assign(new Error("connect"), { code: "ENOTFOUND" });
    const error = new Error("request failed", {
      cause: new TypeError("fetch failed", { cause }),
    });
    expect(classifyError(error)).toMatchObject({ kind: "network" });
  });

  it("should map configuration errors to auth", () => {
    expect(
      classifyError(new CredentialsError("Incomplete Google credentials."))
        .kind,
    ).toBe("auth");
  });

  it("should not leak unknown error messages", () => {
    const result = classifyError(new Error("secret-ish internal detail"));
    expect(result.kind).toBe("unexpected");
    expect(result.message).not.toContain("secret-ish");
  });
});

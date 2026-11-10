import { describe, expect, it } from "vitest";
import {
  AscApiError,
  CredentialsError,
  classifyError,
  NetworkError,
  UnexpectedResponseError,
} from "../src/utils/errors.ts";

function appleError(status: number, code: string, detail = "Details.") {
  return new AscApiError(status, {
    errors: [{ status: String(status), code, title: "Title", detail }],
  });
}

describe("classifyError", () => {
  it.each([
    [400, "PARAMETER_ERROR.INVALID", "invalid_input"],
    [400, "PARAMETER_ERROR.ILLEGAL", "invalid_input"],
    [400, "ENTITY_INVALID", "invalid_input"],
    [401, "NOT_AUTHORIZED", "auth"],
    [403, "FORBIDDEN_ERROR", "permission"],
    [403, "FORBIDDEN_ERROR.INSUFFICIENT_ROLE", "permission"],
    [404, "NOT_FOUND", "not_found"],
    [404, "PATH_ERROR", "not_found"],
    [429, "RATE_LIMIT_EXCEEDED", "quota"],
    [500, "UNEXPECTED_ERROR", "unavailable"],
    [503, "SERVICE_UNAVAILABLE", "unavailable"],
    [409, "ENTITY_ERROR", "unexpected"],
  ])("should classify HTTP %i %s as %s", (status, code, kind) => {
    expect(classifyError(appleError(status, code))).toMatchObject({
      kind,
      status,
      reason: code,
    });
  });

  it("should classify by code prefix when the status is unusual", () => {
    expect(classifyError(appleError(418, "RATE_LIMIT_EXCEEDED")).kind).toBe(
      "quota",
    );
    expect(classifyError(appleError(418, "NOT_FOUNDISH")).kind).toBe(
      "unexpected",
    );
  });

  it("should pass Apple's detail through, truncated", () => {
    const classified = classifyError(
      appleError(400, "PARAMETER_ERROR.INVALID", `bad ${"x".repeat(1000)}`),
    );
    expect(classified.message).toContain('App Store Connect said: "bad x');
    expect(classified.message.length).toBeLessThan(450);
  });

  it("should tolerate a body that is not JSON:API, such as a 406", () => {
    expect(classifyError(new AscApiError(406, undefined))).toMatchObject({
      kind: "unexpected",
      status: 406,
    });
    expect(classifyError(new AscApiError(429, "Too many"))).toMatchObject({
      kind: "quota",
    });
  });

  it("should classify a missing key as auth with its own message", () => {
    expect(
      classifyError(new CredentialsError("Add one at https://x/keys.")),
    ).toEqual({ kind: "auth", message: "Add one at https://x/keys." });
  });

  it("should classify an uninterpretable response as unexpected", () => {
    expect(classifyError(new UnexpectedResponseError("not JSON")).kind).toBe(
      "unexpected",
    );
  });

  it("should classify a timeout as network", () => {
    const error = new DOMException("The operation timed out.", "TimeoutError");
    expect(classifyError(error).kind).toBe("network");
  });

  it("should classify a connection failure in the cause chain as network", () => {
    const error = new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect"), { code: "ECONNRESET" }),
    });
    expect(classifyError(error)).toMatchObject({ kind: "network" });
  });

  it("should classify a code-less fetch failure, as Workers reports it, as network", () => {
    const error = new NetworkError("fetch failed", {
      cause: new TypeError("Network connection lost."),
    });
    expect(classifyError(error)).toMatchObject({ kind: "network" });
  });

  it("should not echo an unknown error's message", () => {
    const classified = classifyError(new Error("Bearer eyJsecret"));
    expect(classified.kind).toBe("unexpected");
    expect(classified.message).not.toContain("eyJsecret");
  });
});

import { describe, expect, it } from "vitest";
import {
  classifyError,
  IndexNowApiError,
  KeyFileError,
} from "../src/utils/errors.ts";

describe("classifyError", () => {
  it.each([
    [400, "invalid_input"],
    [403, "permission"],
    [422, "invalid_input"],
    [429, "quota"],
    [503, "unavailable"],
  ])("should classify IndexNow HTTP %i as %s", (status, kind) => {
    expect(classifyError(new IndexNowApiError(status, "")).kind).toBe(kind);
  });

  it("should quote IndexNow's JSON message", () => {
    const error = new IndexNowApiError(
      422,
      JSON.stringify({
        code: "UrlNotBelongToHost",
        message: "URL does not belong to host",
      }),
    );
    expect(classifyError(error).message).toContain(
      'IndexNow said: "URL does not belong to host"',
    );
  });

  it("should report a missing key file as not_found", () => {
    expect(classifyError(new KeyFileError("gone")).kind).toBe("not_found");
  });

  it("should classify network codes in the cause chain", () => {
    const error = new TypeError("fetch failed", {
      cause: { code: "ENOTFOUND" },
    });
    expect(classifyError(error)).toMatchObject({ kind: "network" });
  });

  it("should fall back to unexpected", () => {
    expect(classifyError(new Error("boom")).kind).toBe("unexpected");
  });
});

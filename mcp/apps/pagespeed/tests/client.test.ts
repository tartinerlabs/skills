import { afterEach, describe, expect, it, vi } from "vitest";
import { createPageSpeedClient } from "../src/google/client.ts";
import { ConfigurationError, GoogleApiError } from "../src/utils/errors.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(status: number, body: unknown) {
  const fetch = vi.fn().mockResolvedValue(Response.json(body, { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("createPageSpeedClient", () => {
  it("should refuse to start without an API key", () => {
    expect(() => createPageSpeedClient("")).toThrow(ConfigurationError);
  });

  it("should send the key in a header, never in the URL", async () => {
    const fetch = stubFetch(200, { lighthouseResult: {} });
    await createPageSpeedClient("test-key").runPagespeed({
      url: "https://example.com/",
      strategy: "mobile",
      categories: ["performance", "seo"],
    });
    const [url, init] = fetch.mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe(
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
    );
    expect(url.searchParams.get("url")).toBe("https://example.com/");
    expect(url.searchParams.get("strategy")).toBe("mobile");
    expect(url.searchParams.getAll("category")).toEqual(["performance", "seo"]);
    expect(url.href).not.toContain("test-key");
    expect(init.headers).toMatchObject({ "x-goog-api-key": "test-key" });
  });

  it("should POST CrUX queries with the target and options in the body", async () => {
    const fetch = stubFetch(200, { record: { key: {}, metrics: {} } });
    await createPageSpeedClient("test-key").queryHistoryRecord(
      { origin: "https://example.com" },
      { formFactor: "PHONE", collectionPeriodCount: 10 },
    );
    const [url, init] = fetch.mock.calls[0] as [URL, RequestInit];
    expect(url.href).toBe(
      "https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord",
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      origin: "https://example.com",
      formFactor: "PHONE",
      collectionPeriodCount: 10,
    });
  });

  it("should throw GoogleApiError with the status and body on failure", async () => {
    const body = { error: { code: 404, status: "NOT_FOUND" } };
    stubFetch(404, body);
    const error = await createPageSpeedClient("test-key")
      .queryRecord({ url: "https://example.com/" }, {})
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GoogleApiError);
    expect(error).toMatchObject({ status: 404, data: body });
  });
});

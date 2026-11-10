import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchClientMetadataResource } from "../src/cimd.ts";

type Answers = Record<string, { A?: string[]; AAAA?: string[] }>;

/** Mocks global fetch: DoH queries answer from `dns`, everything else returns `response`. */
function mockFetch(dns: Answers, response = () => new Response("{}")) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.hostname === "cloudflare-dns.com") {
      const type = url.searchParams.get("type") as "A" | "AAAA";
      const data = dns[url.searchParams.get("name") ?? ""]?.[type] ?? [];
      return Response.json({
        Status: 0,
        Answer: data.map((address) => ({
          type: type === "A" ? 1 : 28,
          data: address,
        })),
      });
    }
    return response();
  });
}

const METADATA_URL = "https://client.example.com/metadata.json";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchClientMetadataResource", () => {
  it("passes a public 200 response through with redirect: manual", async () => {
    const fetchMock = mockFetch({
      "client.example.com": { A: ["93.184.215.14"], AAAA: ["2606:4700::1"] },
    });
    const response = await fetchClientMetadataResource(METADATA_URL, {
      headers: { accept: "application/json" },
      redirect: "error",
    });
    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls.at(-1) ?? [];
    expect(init?.redirect).toBe("manual");
    expect(new Headers(init?.headers).get("accept")).toBe("application/json");
    for (const [, callInit] of fetchMock.mock.calls) {
      expect(callInit?.redirect).not.toBe("error");
    }
  });

  it("rejects non-HTTPS URLs", async () => {
    const fetchMock = mockFetch({});
    await expect(
      fetchClientMetadataResource("http://client.example.com/m.json"),
    ).rejects.toThrow(/HTTPS/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects methods other than GET and HEAD", async () => {
    const fetchMock = mockFetch({});
    await expect(
      fetchClientMetadataResource(METADATA_URL, { method: "POST" }),
    ).rejects.toThrow(/GET and HEAD/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["loopback", { A: ["127.0.0.1"] }],
    ["private", { A: ["93.184.215.14", "10.0.0.1"] }],
    ["link-local IPv6", { AAAA: ["fe80::1"] }],
    ["no answers", {}],
  ])("rejects a hostname resolving to %s", async (_, answers) => {
    const fetchMock = mockFetch({ "client.example.com": answers });
    await expect(fetchClientMetadataResource(METADATA_URL)).rejects.toThrow();
    expect(
      fetchMock.mock.calls.every(([input]) =>
        String(input).startsWith("https://cloudflare-dns.com/"),
      ),
    ).toBe(true);
  });

  it.each([
    "https://127.0.0.1/m.json",
    "https://169.254.169.254/m.json",
    "https://[::1]/m.json",
    "https://localhost/m.json",
  ])("rejects the non-public host in %s without fetching", async (url) => {
    const fetchMock = mockFetch({});
    await expect(fetchClientMetadataResource(url)).rejects.toThrow(
      /public-routable/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([301, 302, 307, 308])("rejects a %i redirect", async (status) => {
    mockFetch(
      { "client.example.com": { A: ["93.184.215.14"] } },
      () =>
        new Response(null, {
          status,
          headers: { location: "https://127.0.0.1/" },
        }),
    );
    await expect(fetchClientMetadataResource(METADATA_URL)).rejects.toThrow(
      /must not redirect/,
    );
  });

  it("passes a 304 through for cache revalidation", async () => {
    mockFetch(
      { "client.example.com": { A: ["93.184.215.14"] } },
      () => new Response(null, { status: 304 }),
    );
    const response = await fetchClientMetadataResource(METADATA_URL);
    expect(response.status).toBe(304);
  });
});

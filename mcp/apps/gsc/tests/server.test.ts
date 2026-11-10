import { describe, expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };
import { createTestClient } from "./helpers.ts";

describe("MCP server", () => {
  it("should describe itself through server/discover", async () => {
    const { rpc } = createTestClient();
    const message = await rpc("server/discover");
    expect(message.result.supportedVersions).toEqual(["2026-07-28"]);
    expect(message.result._meta["io.modelcontextprotocol/serverInfo"]).toEqual({
      name: "google-search-console",
      version: pkg.version,
    });
    expect(message.result.capabilities.tools).toBeDefined();
  });

  it("should register exactly the seven read-only tools", async () => {
    const { rpc } = createTestClient();
    const message = await rpc("tools/list");
    const tools: { name: string; annotations: { readOnlyHint: boolean } }[] =
      message.result.tools;
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "compare_periods",
      "find_opportunities",
      "inspect_url",
      "list_sitemaps",
      "list_sites",
      "ping",
      "search_analytics",
    ]);
    for (const tool of tools) expect(tool.annotations.readOnlyHint).toBe(true);
  });

  it("should add submit_sitemap, not read-only, only when writes are allowed", async () => {
    const { rpc } = createTestClient(undefined, { allowWrite: true });
    const message = await rpc("tools/list");
    const tools: { name: string; annotations: { readOnlyHint: boolean } }[] =
      message.result.tools;
    expect(tools).toHaveLength(8);
    const submit = tools.find((tool) => tool.name === "submit_sitemap");
    expect(submit?.annotations.readOnlyHint).toBe(false);
  });

  it("should answer ping", async () => {
    const { callTool } = createTestClient();
    expect(await callTool("ping")).toEqual({
      isError: false,
      text: "Google Search Console MCP is running.",
    });
  });
});

describe("input validation", () => {
  const valid = {
    siteUrl: "https://example.com/",
    startDate: "2026-01-01",
    endDate: "2026-01-31",
  };

  it.each([
    [
      "a siteUrl that is not a property",
      { ...valid, siteUrl: "example.com" },
      "siteUrl must be",
    ],
    [
      "a URL-prefix siteUrl without trailing slash",
      { ...valid, siteUrl: "https://example.com" },
      "siteUrl must be",
    ],
    [
      "an ftp siteUrl",
      { ...valid, siteUrl: "ftp://example.com/" },
      "siteUrl must be",
    ],
    [
      "a malformed sc-domain",
      { ...valid, siteUrl: "sc-domain:not a domain" },
      "siteUrl must be",
    ],
    [
      "a badly formatted date",
      { ...valid, startDate: "01/01/2026" },
      "YYYY-MM-DD",
    ],
    [
      "an impossible date",
      { ...valid, endDate: "2026-02-30" },
      "valid calendar date",
    ],
    [
      "a start date after the end date",
      { ...valid, startDate: "2026-02-01" },
      "on or before endDate",
    ],
    [
      "a dateRange together with explicit dates",
      { ...valid, dateRange: "last28Days" },
      "either dateRange or both",
    ],
    [
      "a startDate without an endDate",
      { siteUrl: valid.siteUrl, startDate: valid.startDate },
      "either dateRange or both",
    ],
    [
      "an unknown dateRange preset",
      { siteUrl: valid.siteUrl, dateRange: "lastWeek" },
      "dateRange",
    ],
    [
      "an unknown dimension",
      { ...valid, dimensions: ["keyword"] },
      "dimensions",
    ],
    [
      "a duplicated dimension",
      { ...valid, dimensions: ["query", "query"] },
      "only once",
    ],
    ["an unknown search type", { ...valid, type: "shopping" }, "type"],
    [
      "an unsupported filter operator",
      {
        ...valid,
        filters: [
          { dimension: "query", operator: "startsWith", expression: "x" },
        ],
      },
      "operator",
    ],
    [
      "filtering on date",
      { ...valid, filters: [{ dimension: "date", expression: "2026-01-01" }] },
      "dimension",
    ],
    ["rowLimit above 25,000", { ...valid, rowLimit: 25001 }, "rowLimit"],
    ["a negative startRow", { ...valid, startRow: -1 }, "startRow"],
    [
      "byProperty with a page dimension",
      { ...valid, dimensions: ["page"], aggregationType: "byProperty" },
      "byProperty",
    ],
  ])(
    "should reject %s for search_analytics",
    async (_label, args, expected) => {
      const { callTool } = createTestClient();
      const result = await callTool("search_analytics", args);
      expect(result.isError).toBe(true);
      expect(result.text).toContain(expected);
    },
  );

  it.each([
    [
      "an unknown comparison",
      { ...valid, comparison: "lastWeek" },
      "comparison",
    ],
    ["a date dimension", { ...valid, dimension: "date" }, "dimension"],
    ["a limit above 100", { ...valid, limit: 101 }, "limit"],
    [
      "a dateRange together with explicit dates",
      { ...valid, dateRange: "last7Days" },
      "either dateRange or both",
    ],
  ])("should reject %s for compare_periods", async (_label, args, expected) => {
    const { callTool } = createTestClient();
    const result = await callTool("compare_periods", args);
    expect(result.isError).toBe(true);
    expect(result.text).toContain(expected);
  });

  it.each([
    [
      "minPosition above maxPosition",
      { ...valid, minPosition: 21, maxPosition: 20 },
      "minPosition must be",
    ],
    ["a country dimension", { ...valid, dimension: "country" }, "dimension"],
    ["zero minImpressions", { ...valid, minImpressions: 0 }, "minImpressions"],
  ])(
    "should reject %s for find_opportunities",
    async (_label, args, expected) => {
      const { callTool } = createTestClient();
      const result = await callTool("find_opportunities", args);
      expect(result.isError).toBe(true);
      expect(result.text).toContain(expected);
    },
  );

  it("should reject an inspection URL outside the property for inspect_url", async () => {
    const { callTool } = createTestClient();
    const result = await callTool("inspect_url", {
      siteUrl: "https://example.com/blog/",
      inspectionUrl: "https://example.com/shop/item",
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("must be under the property");
  });

  it("should reject a non-URL for inspect_url", async () => {
    const { callTool } = createTestClient();
    const result = await callTool("inspect_url", {
      siteUrl: "sc-domain:example.com",
      inspectionUrl: "not a url",
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("http:// or https:// URL");
  });

  it("should require siteUrl for list_sitemaps", async () => {
    const { callTool } = createTestClient();
    const result = await callTool("list_sitemaps", {});
    expect(result.isError).toBe(true);
    expect(result.text).toContain("siteUrl");
  });
});

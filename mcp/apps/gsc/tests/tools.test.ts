import { afterEach, describe, expect, it, vi } from "vitest";
import { CredentialsError } from "../src/utils/errors.ts";
import { createTestClient, googleError, mockClient } from "./helpers.ts";

describe("list_sites", () => {
  it("should return properties with permission levels", async () => {
    const { callTool } = createTestClient(
      mockClient({
        listSites: async () => ({
          siteEntry: [
            { siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" },
            {
              siteUrl: "https://www.example.com/",
              permissionLevel: "siteRestrictedUser",
            },
          ],
        }),
      }),
    );
    const result = await callTool("list_sites");
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.text).sites).toEqual([
      { siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" },
      {
        siteUrl: "https://www.example.com/",
        permissionLevel: "siteRestrictedUser",
      },
    ]);
  });

  it("should handle an empty response", async () => {
    const { callTool } = createTestClient(
      mockClient({ listSites: async () => ({}) }),
    );
    const body = JSON.parse((await callTool("list_sites")).text);
    expect(body.sites).toEqual([]);
    expect(body.note).toContain("No properties found");
  });
});

describe("search_analytics", () => {
  it("should build the API request and name the dimension keys", async () => {
    const querySearchAnalytics = vi.fn(async () => ({
      responseAggregationType: "byProperty",
      rows: [
        {
          keys: ["2026-01-01", "shoes"],
          clicks: 10,
          impressions: 200,
          ctr: 0.05,
          position: 3.2,
        },
        {
          keys: ["2026-01-02", "boots"],
          clicks: 0,
          impressions: 15,
          ctr: 0,
          position: 12,
        },
      ],
    }));
    const { callTool } = createTestClient(mockClient({ querySearchAnalytics }));
    const result = await callTool("search_analytics", {
      siteUrl: "sc-domain:example.com",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
      dimensions: ["date", "query"],
      type: "web",
      filters: [{ dimension: "country", expression: "GBR" }],
      rowLimit: 100,
    });

    expect(querySearchAnalytics).toHaveBeenCalledWith("sc-domain:example.com", {
      startDate: "2026-01-01",
      endDate: "2026-01-02",
      dimensions: ["date", "query"],
      type: "web",
      aggregationType: undefined,
      dataState: undefined,
      rowLimit: 100,
      startRow: undefined,
      dimensionFilterGroups: [
        {
          groupType: "and",
          filters: [
            { dimension: "country", operator: "equals", expression: "GBR" },
          ],
        },
      ],
    });
    const body = JSON.parse(result.text);
    expect(body.rowCount).toBe(2);
    expect(body.responseAggregationType).toBe("byProperty");
    expect(body.rows[0]).toEqual({
      date: "2026-01-01",
      query: "shoes",
      clicks: 10,
      impressions: 200,
      ctr: 0.05,
      position: 3.2,
    });
  });

  it("should return an explanatory note when there are no rows", async () => {
    const { callTool } = createTestClient(
      mockClient({
        querySearchAnalytics: async () => ({ responseAggregationType: "auto" }),
      }),
    );
    const result = await callTool("search_analytics", {
      siteUrl: "https://example.com/",
      startDate: "2026-01-01",
      endDate: "2026-01-01",
    });
    const body = JSON.parse(result.text);
    expect(result.isError).toBe(false);
    expect(body.rows).toEqual([]);
    expect(body.note).toContain("No data matched");
  });

  it("should pass through response metadata", async () => {
    const { callTool } = createTestClient(
      mockClient({
        querySearchAnalytics: async () => ({
          rows: [],
          metadata: { firstIncompleteDate: "2026-01-02" },
        }),
      }),
    );
    const result = await callTool("search_analytics", {
      siteUrl: "https://example.com/",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
      dimensions: ["date"],
      dataState: "all",
    });
    expect(JSON.parse(result.text).metadata).toEqual({
      firstIncompleteDate: "2026-01-02",
    });
  });
});

describe("search_analytics date presets", () => {
  afterEach(() => vi.useRealTimers());

  it("should end a preset on the latest day with final data", async () => {
    vi.useFakeTimers({
      now: new Date("2026-10-20T12:00:00Z"),
      toFake: ["Date"],
    });
    const querySearchAnalytics = vi.fn(
      async (_siteUrl: string, body: object) =>
        "rowLimit" in body
          ? { rows: [] }
          : {
              rows: [
                { keys: ["2026-10-16"], clicks: 1 },
                { keys: ["2026-10-17"], clicks: 1 },
              ],
            },
    );
    const { callTool } = createTestClient(mockClient({ querySearchAnalytics }));
    const result = await callTool("search_analytics", {
      siteUrl: "sc-domain:example.com",
      dateRange: "last28Days",
      type: "discover",
      rowLimit: 10,
    });

    expect(querySearchAnalytics).toHaveBeenNthCalledWith(
      1,
      "sc-domain:example.com",
      {
        startDate: "2026-10-10",
        endDate: "2026-10-20",
        dimensions: ["date"],
        type: "discover",
      },
    );
    expect(querySearchAnalytics).toHaveBeenLastCalledWith(
      "sc-domain:example.com",
      expect.objectContaining({
        startDate: "2026-09-20",
        endDate: "2026-10-17",
      }),
    );
    expect(JSON.parse(result.text)).toMatchObject({
      dateRange: "last28Days",
      startDate: "2026-09-20",
      endDate: "2026-10-17",
    });
  });

  it("should resolve month presets by calendar month", async () => {
    const querySearchAnalytics = vi.fn(
      async (_siteUrl: string, body: object) =>
        "rowLimit" in body
          ? { rows: [] }
          : { rows: [{ keys: ["2026-05-31"] }] },
    );
    const { callTool } = createTestClient(mockClient({ querySearchAnalytics }));
    const result = await callTool("search_analytics", {
      siteUrl: "https://example.com/",
      dateRange: "last3Months",
      rowLimit: 10,
    });
    expect(JSON.parse(result.text)).toMatchObject({
      startDate: "2026-03-01",
      endDate: "2026-05-31",
    });
  });

  it("should fall back to three days ago when recent days have no data", async () => {
    vi.useFakeTimers({
      now: new Date("2026-10-20T12:00:00Z"),
      toFake: ["Date"],
    });
    const { callTool } = createTestClient(
      mockClient({ querySearchAnalytics: async () => ({}) }),
    );
    const result = await callTool("search_analytics", {
      siteUrl: "https://example.com/",
      dateRange: "last7Days",
    });
    expect(JSON.parse(result.text)).toMatchObject({
      startDate: "2026-10-11",
      endDate: "2026-10-17",
    });
  });
});

describe("compare_periods", () => {
  type Body = { startDate: string; dimensions?: string[] };
  const row = (key: string, clicks: number, impressions = clicks * 10) => ({
    keys: [key],
    clicks,
    impressions,
    ctr: clicks / impressions,
    position: 5.04,
  });

  /** Current period starts 2026-02-01; anything earlier is the previous period. */
  const querySearchAnalytics = vi.fn(async (_siteUrl: string, body: Body) => {
    const current = body.startDate >= "2026-02-01";
    if (!body.dimensions) {
      return { rows: [current ? row("", 130, 1300) : row("", 100, 1000)] };
    }
    return {
      rows: current
        ? [row("shoes", 80), row("boots", 10), row("sandals", 40)]
        : [row("shoes", 50), row("boots", 30), row("slippers", 20)],
    };
  });

  it("should compare against the previous period of equal length", async () => {
    querySearchAnalytics.mockClear();
    const { callTool } = createTestClient(mockClient({ querySearchAnalytics }));
    const result = await callTool("compare_periods", {
      siteUrl: "sc-domain:example.com",
      startDate: "2026-02-01",
      endDate: "2026-02-28",
      filters: [{ dimension: "country", expression: "GBR" }],
    });
    const body = JSON.parse(result.text);

    expect(result.isError).toBe(false);
    expect(body.previousPeriod).toEqual({
      startDate: "2026-01-04",
      endDate: "2026-01-31",
    });
    expect(querySearchAnalytics).toHaveBeenCalledWith(
      "sc-domain:example.com",
      expect.objectContaining({
        startDate: "2026-01-04",
        dimensions: ["query"],
        rowLimit: 25000,
        dimensionFilterGroups: [
          {
            groupType: "and",
            filters: [
              { dimension: "country", operator: "equals", expression: "GBR" },
            ],
          },
        ],
      }),
    );
    expect(body.totals.change).toMatchObject({ clicks: 30, impressions: 300 });
    expect(body.gainers).toEqual([
      expect.objectContaining({
        query: "shoes",
        change: expect.objectContaining({ clicks: 30 }),
      }),
    ]);
    expect(body.losers).toEqual([
      expect.objectContaining({
        query: "boots",
        change: expect.objectContaining({ clicks: -20 }),
      }),
    ]);
    expect(body.new.map((r: { query: string }) => r.query)).toEqual([
      "sandals",
    ]);
    expect(body.lost.map((r: { query: string }) => r.query)).toEqual([
      "slippers",
    ]);
    expect(body.gainers[0].current.position).toBe(5);
  });

  it("should compare the same dates a year earlier", async () => {
    const { callTool } = createTestClient(mockClient({ querySearchAnalytics }));
    const result = await callTool("compare_periods", {
      siteUrl: "https://example.com/",
      startDate: "2026-02-01",
      endDate: "2026-02-28",
      comparison: "previousYear",
      dimension: "page",
    });
    const body = JSON.parse(result.text);
    expect(body.previousPeriod).toEqual({
      startDate: "2025-02-01",
      endDate: "2025-02-28",
    });
    expect(body.gainers[0].page).toBe("shoes");
  });

  it("should warn when the previous period is beyond data retention", async () => {
    vi.useFakeTimers({
      now: new Date("2026-10-20T12:00:00Z"),
      toFake: ["Date"],
    });
    try {
      const { callTool } = createTestClient(
        mockClient({ querySearchAnalytics: async () => ({}) }),
      );
      const body = JSON.parse(
        (
          await callTool("compare_periods", {
            siteUrl: "https://example.com/",
            startDate: "2025-10-01",
            endDate: "2026-09-30",
            comparison: "previousYear",
          })
        ).text,
      );
      expect(body.note).toContain("16 months");
      expect(body.totals.current.clicks).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("should flag lists truncated by the row limit", async () => {
    const rows = Array.from({ length: 25000 }, (_, i) => row(`q${i}`, 1));
    const { callTool } = createTestClient(
      mockClient({
        querySearchAnalytics: async (_siteUrl, body) =>
          body.dimensions ? { rows } : {},
      }),
    );
    const body = JSON.parse(
      (
        await callTool("compare_periods", {
          siteUrl: "https://example.com/",
          startDate: "2026-02-01",
          endDate: "2026-02-28",
          limit: 5,
        })
      ).text,
    );
    expect(body.truncated).toContain("25,000-row limit");
    expect(body.gainers).toEqual([]);
  });
});

describe("find_opportunities", () => {
  const row = (
    key: string,
    position: number,
    clicks: number,
    impressions: number,
  ) => ({
    keys: [key],
    position,
    clicks,
    impressions,
    ctr: clicks / impressions,
  });
  const rows = [
    row("a", 1.2, 300, 1000),
    row("b", 2.8, 100, 1000),
    row("c", 3.1, 20, 1000),
    row("d", 7.6, 10, 2000),
    row("e", 15, 0, 500),
    row("f", 30, 0, 5000),
    row("g", 9, 0, 10),
  ];

  it("should rank striking-distance rows and CTR gaps against the site's own curve", async () => {
    const querySearchAnalytics = vi.fn(async () => ({ rows }));
    const { callTool } = createTestClient(mockClient({ querySearchAnalytics }));
    const result = await callTool("find_opportunities", {
      siteUrl: "sc-domain:example.com",
      startDate: "2026-01-01",
      endDate: "2026-01-28",
    });
    const body = JSON.parse(result.text);

    expect(querySearchAnalytics).toHaveBeenCalledWith("sc-domain:example.com", {
      startDate: "2026-01-01",
      endDate: "2026-01-28",
      dimensions: ["query"],
      type: undefined,
      rowLimit: 25000,
      dimensionFilterGroups: undefined,
    });
    expect(body.top3Ctr).toBe(0.14);
    expect(
      body.ctrCurve.map((point: { position: number }) => point.position),
    ).toEqual([1, 3, 8, 9, 15]);
    expect(body.ctrCurve[1]).toEqual({
      position: 3,
      ctr: 0.06,
      impressions: 2000,
    });
    expect(body.strikingDistance).toEqual([
      {
        query: "d",
        clicks: 10,
        impressions: 2000,
        ctr: 0.005,
        position: 7.6,
        potentialExtraClicks: 270,
      },
      {
        query: "e",
        clicks: 0,
        impressions: 500,
        ctr: 0,
        position: 15,
        potentialExtraClicks: 70,
      },
    ]);
    expect(body.ctrGaps).toEqual([
      {
        query: "c",
        clicks: 20,
        impressions: 1000,
        ctr: 0.02,
        position: 3.1,
        expectedCtr: 0.06,
        missedClicks: 40,
      },
    ]);
  });

  it("should honour the position window and limit", async () => {
    const { callTool } = createTestClient(
      mockClient({ querySearchAnalytics: async () => ({ rows }) }),
    );
    const body = JSON.parse(
      (
        await callTool("find_opportunities", {
          siteUrl: "https://example.com/",
          startDate: "2026-01-01",
          endDate: "2026-01-28",
          dimension: "page",
          minPosition: 10,
          maxPosition: 40,
          limit: 1,
        })
      ).text,
    );
    expect(body.strikingDistance).toEqual([
      expect.objectContaining({ page: "f", potentialExtraClicks: 700 }),
    ]);
  });

  it("should explain an empty result", async () => {
    const { callTool } = createTestClient(
      mockClient({ querySearchAnalytics: async () => ({}) }),
    );
    const body = JSON.parse(
      (
        await callTool("find_opportunities", {
          siteUrl: "https://example.com/",
          startDate: "2026-01-01",
          endDate: "2026-01-28",
        })
      ).text,
    );
    expect(body).toMatchObject({
      strikingDistance: [],
      ctrGaps: [],
      top3Ctr: null,
    });
    expect(body.note).toContain("No data matched");
  });
});

describe("inspect_url", () => {
  it("should return the inspection result", async () => {
    const inspectUrl = vi.fn(async () => ({
      inspectionResult: {
        inspectionResultLink:
          "https://search.google.com/search-console/inspect?resource_id=x",
        indexStatusResult: {
          verdict: "PASS",
          coverageState: "Submitted and indexed",
        },
      },
    }));
    const { callTool } = createTestClient(mockClient({ inspectUrl }));
    const result = await callTool("inspect_url", {
      siteUrl: "sc-domain:example.com",
      inspectionUrl: "https://blog.example.com/post",
      languageCode: "en-GB",
    });
    expect(inspectUrl).toHaveBeenCalledWith({
      siteUrl: "sc-domain:example.com",
      inspectionUrl: "https://blog.example.com/post",
      languageCode: "en-GB",
    });
    expect(
      JSON.parse(result.text).inspectionResult.indexStatusResult.verdict,
    ).toBe("PASS");
  });

  it("should report an unexpected empty response", async () => {
    const { callTool } = createTestClient(
      mockClient({ inspectUrl: async () => ({}) }),
    );
    const result = await callTool("inspect_url", {
      siteUrl: "https://example.com/",
      inspectionUrl: "https://example.com/page",
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("[unexpected]");
  });
});

describe("list_sitemaps", () => {
  it("should return sitemap details", async () => {
    const { callTool } = createTestClient(
      mockClient({
        listSitemaps: async () => ({
          sitemap: [
            {
              path: "https://example.com/sitemap.xml",
              type: "sitemap",
              isPending: false,
              isSitemapsIndex: false,
              lastSubmitted: "2026-01-01T00:00:00Z",
              errors: "0",
              warnings: "1",
              contents: [{ type: "web", submitted: "42", indexed: "0" }],
            },
          ],
        }),
      }),
    );
    const body = JSON.parse(
      (await callTool("list_sitemaps", { siteUrl: "https://example.com/" }))
        .text,
    );
    expect(body.sitemaps[0]).toMatchObject({
      path: "https://example.com/sitemap.xml",
      warnings: "1",
      lastDownloaded: null,
      contents: [{ type: "web", submitted: "42" }],
    });
  });

  it("should handle no sitemaps", async () => {
    const { callTool } = createTestClient(
      mockClient({ listSitemaps: async () => ({}) }),
    );
    const body = JSON.parse(
      (await callTool("list_sitemaps", { siteUrl: "sc-domain:example.com" }))
        .text,
    );
    expect(body.sitemaps).toEqual([]);
    expect(body.note).toContain("No sitemaps");
  });
});

describe("submit_sitemap", () => {
  it("should submit a sitemap under the property", async () => {
    const submitSitemap = vi.fn(async () => {});
    const { callTool } = createTestClient(mockClient({ submitSitemap }), {
      allowWrite: true,
    });
    const result = await callTool("submit_sitemap", {
      siteUrl: "sc-domain:example.com",
      sitemapUrl: "https://www.example.com/sitemap.xml",
    });
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.text).submitted).toBe(true);
    expect(submitSitemap).toHaveBeenCalledWith(
      "sc-domain:example.com",
      "https://www.example.com/sitemap.xml",
    );
  });

  it("should reject a sitemap outside the property", async () => {
    const submitSitemap = vi.fn(async () => {});
    const { callTool } = createTestClient(mockClient({ submitSitemap }), {
      allowWrite: true,
    });
    const result = await callTool("submit_sitemap", {
      siteUrl: "https://example.com/blog/",
      sitemapUrl: "https://example.com/sitemap.xml",
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("must be under the property");
    expect(submitSitemap).not.toHaveBeenCalled();
  });

  it("should surface a missing write scope as an auth error", async () => {
    const { callTool } = createTestClient(
      mockClient({
        submitSitemap: () =>
          Promise.reject(new CredentialsError("needs write access")),
      }),
      { allowWrite: true },
    );
    const result = await callTool("submit_sitemap", {
      siteUrl: "https://example.com/",
      sitemapUrl: "https://example.com/sitemap.xml",
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("[auth]");
  });
});

describe("Google failures surface as isError tool results", () => {
  it.each([
    [
      "auth failure",
      googleError(401, {
        error: { code: 401, message: "Invalid Credentials" },
      }),
      "[auth]",
    ],
    [
      "revoked refresh token",
      googleError(
        400,
        {
          error: "invalid_grant",
          error_description: "Token has been expired or revoked.",
        },
        "invalid_grant",
      ),
      "invalid_grant",
    ],
    [
      "permission error",
      googleError(403, {
        error: {
          code: 403,
          message: "User does not have sufficient permission",
          errors: [{ reason: "forbidden" }],
        },
      }),
      "[permission]",
    ],
    [
      "rate limit",
      googleError(429, {
        error: {
          code: 429,
          message: "Too many requests",
          errors: [{ reason: "rateLimitExceeded" }],
        },
      }),
      "[quota]",
    ],
    [
      "server failure",
      googleError(503, {
        error: {
          code: 503,
          message: "Backend Error",
          errors: [{ reason: "backendError" }],
        },
      }),
      "[unavailable]",
    ],
    ["unknown failure", new Error("boom"), "[unexpected]"],
  ])("should return a tool error for %s", async (_label, error, expected) => {
    const { callTool } = createTestClient(
      mockClient({ listSites: () => Promise.reject(error) }),
    );
    const result = await callTool("list_sites");
    expect(result.isError).toBe(true);
    expect(result.text).toContain(expected);
  });
});

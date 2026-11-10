import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type {
  CruxHistoryResponse,
  CruxRecordResponse,
  LighthouseResult,
} from "../src/google/client.ts";
import { GoogleApiError } from "../src/utils/errors.ts";
import { createTestClient, mockClient } from "./helpers.ts";

// Trimmed from Lighthouse 13.5's sample report (core/test/results/sample_v2.json).
const lighthouseResult: LighthouseResult = JSON.parse(
  readFileSync(new URL("./fixtures/lighthouse.json", import.meta.url), "utf8"),
);

const period = {
  firstDate: { year: 2026, month: 9, day: 20 },
  lastDate: { year: 2026, month: 10, day: 17 },
};

const record: CruxRecordResponse = {
  record: {
    key: { origin: "https://example.com", formFactor: "PHONE" },
    metrics: {
      largest_contentful_paint: {
        histogram: [
          { start: 0, end: 2500, density: 0.8 },
          { start: 2500, end: 4000, density: 0.12 },
          { start: 4000, density: 0.08 },
        ],
        percentiles: { p75: 2100 },
      },
      interaction_to_next_paint: {
        histogram: [
          { start: 0, end: 200, density: 0.7 },
          { start: 200, end: 500, density: 0.2 },
          { start: 500, density: 0.1 },
        ],
        percentiles: { p75: 250 },
      },
      cumulative_layout_shift: {
        histogram: [
          { start: "0.00", end: "0.10", density: 0.6 },
          { start: "0.10", end: "0.25", density: 0.25 },
          { start: "0.25", density: 0.15 },
        ],
        percentiles: { p75: "0.27" },
      },
    },
    collectionPeriod: period,
  },
};

const history: CruxHistoryResponse = {
  record: {
    key: { origin: "https://example.com" },
    metrics: {
      largest_contentful_paint: {
        percentilesTimeseries: { p75s: [2300, null, 2100] },
      },
      cumulative_layout_shift: {
        percentilesTimeseries: { p75s: ["0.05", "0.04", "0.03"] },
      },
    },
    collectionPeriods: [
      {
        firstDate: { year: 2026, month: 9, day: 6 },
        lastDate: { year: 2026, month: 10, day: 3 },
      },
      {
        firstDate: { year: 2026, month: 9, day: 13 },
        lastDate: { year: 2026, month: 10, day: 10 },
      },
      period,
    ],
  },
};

describe("pagespeed_analyze", () => {
  it("should request the given strategy and categories", async () => {
    const runPagespeed = vi.fn().mockResolvedValue({ lighthouseResult });
    const { callTool } = createTestClient(mockClient({ runPagespeed }));
    await callTool("pagespeed_analyze", {
      url: "https://example.com/",
      strategy: "desktop",
      categories: ["performance", "seo"],
    });
    expect(runPagespeed).toHaveBeenCalledWith({
      url: "https://example.com/",
      strategy: "desktop",
      categories: ["performance", "seo"],
    });
  });

  it("should default to mobile and performance only", async () => {
    const runPagespeed = vi.fn().mockResolvedValue({ lighthouseResult });
    const { callTool } = createTestClient(mockClient({ runPagespeed }));
    await callTool("pagespeed_analyze", { url: "https://example.com/" });
    expect(runPagespeed).toHaveBeenCalledWith({
      url: "https://example.com/",
      strategy: "mobile",
      categories: ["performance"],
    });
  });

  it("should summarise scores, lab metrics and the costliest failing audits", async () => {
    const runPagespeed = vi.fn().mockResolvedValue({ lighthouseResult });
    const { callTool } = createTestClient(mockClient({ runPagespeed }));
    const result = await callTool("pagespeed_analyze", {
      url: "https://example.com/",
      categories: ["performance", "seo"],
      maxFindings: 4,
    });
    expect(result.isError).toBe(false);
    const body = JSON.parse(result.text);
    expect(body.strategy).toBe("mobile");
    expect(body.lighthouseVersion).toBe("13.5.0");
    expect(body.scores).toEqual({ performance: 32, seo: 75 });
    expect(body.labMetrics.map((m: { acronym: string }) => m.acronym)).toEqual([
      "FCP",
      "LCP",
      "TBT",
      "CLS",
      "SI",
    ]);
    expect(body.labMetrics[1]).toMatchObject({
      id: "largest-contentful-paint",
      // Lighthouse separates value and unit with a non-breaking space.
      displayValue: "10.9 s",
      score: 0,
    });
    expect(body.findings.performance.map((f: { id: string }) => f.id)).toEqual([
      "cache-insight",
      "image-delivery-insight",
      "mainthread-work-breakdown",
      "render-blocking-insight",
    ]);
    expect(body.findings.performance[0].metricSavings).toEqual({ LCP: 3600 });
    expect(body.findings.seo.map((f: { id: string }) => f.id)).toEqual([
      "meta-description",
      "crawlable-anchors",
      "image-alt",
    ]);
  });

  it("should report a missing Lighthouse result as unexpected", async () => {
    const runPagespeed = vi.fn().mockResolvedValue({});
    const { callTool } = createTestClient(mockClient({ runPagespeed }));
    const result = await callTool("pagespeed_analyze", {
      url: "https://example.com/",
    });
    expect(result).toEqual({
      isError: true,
      text: expect.stringContaining("[unexpected]"),
    });
  });

  it("should report a Lighthouse runtime error instead of empty scores", async () => {
    const runPagespeed = vi.fn().mockResolvedValue({
      lighthouseResult: {
        ...lighthouseResult,
        runtimeError: {
          code: "FAILED_DOCUMENT_REQUEST",
          message: "Lighthouse was unable to reliably load the page.",
        },
      },
    });
    const { callTool } = createTestClient(mockClient({ runPagespeed }));
    const result = await callTool("pagespeed_analyze", {
      url: "https://example.com/",
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("[unexpected]");
    expect(result.text).toContain("FAILED_DOCUMENT_REQUEST");
  });
});

describe("crux_query", () => {
  it("should query an origin with the default metrics", async () => {
    const queryRecord = vi.fn().mockResolvedValue(record);
    const { callTool } = createTestClient(mockClient({ queryRecord }));
    await callTool("crux_query", {
      origin: "https://Example.com/",
      formFactor: "PHONE",
    });
    expect(queryRecord).toHaveBeenCalledWith(
      { origin: "https://example.com" },
      {
        formFactor: "PHONE",
        metrics: [
          "largest_contentful_paint",
          "interaction_to_next_paint",
          "cumulative_layout_shift",
          "first_contentful_paint",
          "experimental_time_to_first_byte",
        ],
      },
    );
  });

  it("should rate each p75 by the histogram's thresholds", async () => {
    const queryRecord = vi.fn().mockResolvedValue(record);
    const { callTool } = createTestClient(mockClient({ queryRecord }));
    const result = await callTool("crux_query", {
      url: "https://example.com/page",
    });
    const body = JSON.parse(result.text);
    expect(body.collectionPeriod).toEqual({
      firstDate: "2026-09-20",
      lastDate: "2026-10-17",
    });
    expect(body.metrics).toEqual({
      largest_contentful_paint: {
        p75: 2100,
        rating: "good",
        good: 0.8,
        needsImprovement: 0.12,
        poor: 0.08,
      },
      interaction_to_next_paint: {
        p75: 250,
        rating: "needs_improvement",
        good: 0.7,
        needsImprovement: 0.2,
        poor: 0.1,
      },
      cumulative_layout_shift: {
        p75: 0.27,
        rating: "poor",
        good: 0.6,
        needsImprovement: 0.25,
        poor: 0.15,
      },
    });
  });

  it("should rate a p75 on a threshold in the better band", async () => {
    const { metrics } = record.record;
    const onThresholds: CruxRecordResponse = {
      record: {
        ...record.record,
        metrics: {
          largest_contentful_paint: {
            ...metrics.largest_contentful_paint,
            percentiles: { p75: 2500 },
          },
          interaction_to_next_paint: {
            ...metrics.interaction_to_next_paint,
            percentiles: { p75: 500 },
          },
          cumulative_layout_shift: {
            ...metrics.cumulative_layout_shift,
            percentiles: { p75: "0.10" },
          },
        },
      },
    };
    const queryRecord = vi.fn().mockResolvedValue(onThresholds);
    const { callTool } = createTestClient(mockClient({ queryRecord }));
    const result = await callTool("crux_query", {
      url: "https://example.com/page",
    });
    const body = JSON.parse(result.text);
    expect(body.metrics.largest_contentful_paint.rating).toBe("good");
    expect(body.metrics.interaction_to_next_paint.rating).toBe(
      "needs_improvement",
    );
    expect(body.metrics.cumulative_layout_shift.rating).toBe("good");
  });

  it("should explain a 404 as missing field data", async () => {
    const queryRecord = vi.fn().mockRejectedValue(
      new GoogleApiError(404, {
        error: {
          code: 404,
          message: "chrome ux report data not found",
          status: "NOT_FOUND",
        },
      }),
    );
    const { callTool } = createTestClient(mockClient({ queryRecord }));
    const result = await callTool("crux_query", {
      url: "https://example.com/rare-page",
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("[not_found]");
    expect(result.text).toContain("Try the origin");
  });
});

describe("crux_history", () => {
  it("should pass weeks as collectionPeriodCount", async () => {
    const queryHistoryRecord = vi.fn().mockResolvedValue(history);
    const { callTool } = createTestClient(mockClient({ queryHistoryRecord }));
    await callTool("crux_history", {
      origin: "https://example.com",
      weeks: 3,
      metrics: ["largest_contentful_paint"],
    });
    expect(queryHistoryRecord).toHaveBeenCalledWith(
      { origin: "https://example.com" },
      {
        formFactor: undefined,
        metrics: ["largest_contentful_paint"],
        collectionPeriodCount: 3,
      },
    );
  });

  it("should return weekly p75s with numeric CLS and nulls for gaps", async () => {
    const queryHistoryRecord = vi.fn().mockResolvedValue(history);
    const { callTool } = createTestClient(mockClient({ queryHistoryRecord }));
    const result = await callTool("crux_history", {
      origin: "https://example.com",
    });
    expect(JSON.parse(result.text)).toEqual({
      key: { origin: "https://example.com" },
      weekEnding: ["2026-10-03", "2026-10-10", "2026-10-17"],
      p75s: {
        largest_contentful_paint: [2300, null, 2100],
        cumulative_layout_shift: [0.05, 0.04, 0.03],
      },
    });
  });
});

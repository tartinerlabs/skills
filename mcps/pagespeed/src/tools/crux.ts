import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type {
  CruxCollectionPeriod,
  CruxRecordResponse,
  CruxTarget,
  PageSpeedClientProvider,
} from "../google/client.ts";
import {
  CRUX_METRICS,
  cruxMetricsSchema,
  cruxTargetFields,
  formFactorSchema,
  hasExactlyOneTarget,
  TARGET_MESSAGE,
} from "../schemas/common.ts";
import { toToolError } from "../utils/errors.ts";

const inputSchema = z
  .object({
    ...cruxTargetFields,
    formFactor: formFactorSchema,
    metrics: cruxMetricsSchema,
  })
  .refine(hasExactlyOneTarget, { message: TARGET_MESSAGE, path: ["url"] });

export function toTarget(input: { url?: string; origin?: string }): CruxTarget {
  return input.url !== undefined
    ? { url: input.url }
    : { origin: input.origin as string };
}

function isoDate({ year, month, day }: CruxCollectionPeriod["lastDate"]) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatPeriod(period: CruxCollectionPeriod) {
  return {
    firstDate: isoDate(period.firstDate),
    lastDate: isoDate(period.lastDate),
  };
}

/** CrUX sends CLS as a string ("0.05"); every other value is a number. */
export function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * The three-bin CrUX histogram uses the Core Web Vitals thresholds as bin
 * edges. A p75 equal to a threshold gets the better rating: "good" is
 * ≤ 2500 ms LCP, and "poor" starts above 4000 ms.
 */
function rate(p75: number | null, edges: (number | null)[]) {
  if (p75 === null || edges.length < 2) return undefined;
  const [good, poor] = edges;
  if (good !== null && good !== undefined && p75 <= good) return "good";
  if (poor !== null && poor !== undefined && p75 <= poor)
    return "needs_improvement";
  return "poor";
}

function summariseRecord(response: CruxRecordResponse) {
  const metrics: Record<string, unknown> = {};
  for (const [name, metric] of Object.entries(response.record.metrics)) {
    const histogram = metric.histogram ?? [];
    if (!metric.percentiles || histogram.length !== 3) continue;
    const p75 = toNumber(metric.percentiles.p75);
    const [good, needsImprovement, poor] = histogram.map(
      (bin) => bin.density ?? 0,
    );
    metrics[name] = {
      p75,
      rating: rate(
        p75,
        histogram.slice(0, 2).map((bin) => toNumber(bin.end)),
      ),
      good,
      needsImprovement,
      poor,
    };
  }
  return {
    key: response.record.key,
    collectionPeriod: response.record.collectionPeriod
      ? formatPeriod(response.record.collectionPeriod)
      : undefined,
    metrics,
  };
}

export function registerCruxTool(
  server: McpServer,
  getClient: PageSpeedClientProvider,
): void {
  server.registerTool(
    "crux_query",
    {
      title: "Query Core Web Vitals field data",
      description:
        "Real-user Core Web Vitals from the Chrome UX Report for a URL or a whole origin: the 75th percentile, " +
        "its rating (good / needs_improvement / poor) and the share of page loads in each band, over the last 28 days. " +
        "LCP, INP, FCP and TTFB are in milliseconds; CLS is unitless. Pages with too little Chrome traffic have no data; " +
        "try the origin instead.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      try {
        const response = await (await getClient()).queryRecord(
          toTarget(input),
          {
            formFactor: input.formFactor,
            metrics: input.metrics ?? [...CRUX_METRICS],
          },
        );
        const result = summariseRecord(response);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toToolError("crux_query", error);
      }
    },
  );
}

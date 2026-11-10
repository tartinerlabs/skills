import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type {
  CruxHistoryResponse,
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
import { formatPeriod, toNumber, toTarget } from "./crux.ts";

const inputSchema = z
  .object({
    ...cruxTargetFields,
    formFactor: formFactorSchema,
    metrics: cruxMetricsSchema,
    weeks: z
      .number()
      .int()
      .min(1)
      .max(40)
      .default(25)
      .describe("Number of weekly data points, up to 40 (default 25)."),
  })
  .refine(hasExactlyOneTarget, { message: TARGET_MESSAGE, path: ["url"] });

function summariseHistory(response: CruxHistoryResponse) {
  const p75s: Record<string, (number | null)[]> = {};
  for (const [name, metric] of Object.entries(response.record.metrics)) {
    const series = metric.percentilesTimeseries?.p75s;
    if (series) p75s[name] = series.map(toNumber);
  }
  return {
    key: response.record.key,
    // Each period is a rolling 28-day window; lastDate is the week it ends.
    weekEnding: (response.record.collectionPeriods ?? []).map(
      (period) => formatPeriod(period).lastDate,
    ),
    p75s,
  };
}

export function registerCruxHistoryTool(
  server: McpServer,
  getClient: PageSpeedClientProvider,
): void {
  server.registerTool(
    "crux_history",
    {
      title: "Core Web Vitals trend",
      description:
        "Weekly trend of real-user Core Web Vitals from the CrUX History API for a URL or a whole origin: " +
        "the 75th percentile per week, oldest first, each a rolling 28-day window (null where data is missing). " +
        "Updated every Monday; up to 40 weeks.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      try {
        const response = await (await getClient()).queryHistoryRecord(
          toTarget(input),
          {
            formFactor: input.formFactor,
            metrics: input.metrics ?? [...CRUX_METRICS],
            collectionPeriodCount: input.weeks,
          },
        );
        const result = summariseHistory(response);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toToolError("crux_history", error);
      }
    },
  );
}

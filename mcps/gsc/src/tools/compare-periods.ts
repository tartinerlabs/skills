import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type {
  GscClient,
  GscClientProvider,
  SearchAnalyticsResponse,
} from "../google/client.ts";
import {
  dateRangeFields,
  filterSchema,
  hasOneDateRange,
  isStartOnOrBeforeEnd,
  oneDateRangeError,
  SEARCH_TYPES,
  siteUrlSchema,
  startAfterEndError,
} from "../schemas/common.ts";
import {
  addDays,
  addMonths,
  type DateRange,
  daysInRange,
  resolveDateRange,
  todayInPacific,
} from "../utils/date-range.ts";
import { toToolError } from "../utils/errors.ts";

const COMPARE_DIMENSIONS = [
  "query",
  "page",
  "country",
  "device",
  "searchAppearance",
] as const;
const COMPARISONS = ["previousPeriod", "previousYear"] as const;
/** The API's maximum rows per request. */
const MAX_ROWS = 25_000;
/** Search Console keeps 16 months of data. */
const RETENTION_MONTHS = 16;

const inputSchema = z
  .object({
    siteUrl: siteUrlSchema,
    ...dateRangeFields,
    comparison: z
      .enum(COMPARISONS)
      .default("previousPeriod")
      .describe(
        "previousPeriod: the same number of days just before; previousYear: the same dates 12 months earlier.",
      ),
    dimension: z
      .enum(COMPARE_DIMENSIONS)
      .default("query")
      .describe("What to compare by."),
    type: z
      .enum(SEARCH_TYPES)
      .optional()
      .describe("Search type (API default: web)."),
    filters: z
      .array(filterSchema)
      .optional()
      .describe("Dimension filters applied to both periods; all must match."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25)
      .describe("Rows per list (gainers, losers, new, lost)."),
  })
  .refine(hasOneDateRange, oneDateRangeError)
  .refine(isStartOnOrBeforeEnd, startAfterEndError);

type CompareInput = z.infer<typeof inputSchema>;

interface Metrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
}

const EMPTY: Metrics = { clicks: 0, impressions: 0, ctr: 0, position: null };

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function toMetrics(
  row: NonNullable<SearchAnalyticsResponse["rows"]>[number],
): Metrics {
  return {
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: round(row.ctr ?? 0, 4),
    position: row.position == null ? null : round(row.position, 1),
  };
}

function compare(current: Metrics, previous: Metrics) {
  return {
    current,
    previous,
    change: {
      clicks: current.clicks - previous.clicks,
      impressions: current.impressions - previous.impressions,
      ctr: round(current.ctr - previous.ctr, 4),
      // Negative means the average position improved (moved up).
      position:
        current.position === null || previous.position === null
          ? null
          : round(current.position - previous.position, 1),
    },
  };
}

function previousRange(
  range: DateRange,
  comparison: CompareInput["comparison"],
): DateRange {
  if (comparison === "previousYear") {
    return {
      startDate: addMonths(range.startDate, -12),
      endDate: addMonths(range.endDate, -12),
    };
  }
  const endDate = addDays(range.startDate, -1);
  return { startDate: addDays(endDate, 1 - daysInRange(range)), endDate };
}

async function fetchPeriod(
  client: GscClient,
  input: CompareInput,
  range: DateRange,
) {
  const base = {
    ...range,
    type: input.type,
    dimensionFilterGroups: input.filters?.length
      ? [{ groupType: "and", filters: input.filters }]
      : undefined,
  };
  // Totals come from their own query: summed rows miss anonymised queries.
  const [totals, rows] = await Promise.all([
    client.querySearchAnalytics(input.siteUrl, base),
    client.querySearchAnalytics(input.siteUrl, {
      ...base,
      dimensions: [input.dimension],
      rowLimit: MAX_ROWS,
    }),
  ]);
  const byKey = new Map<string, Metrics>();
  for (const row of rows.rows ?? []) {
    const key = row.keys?.[0];
    if (key !== undefined) byKey.set(key, toMetrics(row));
  }
  return {
    totals: totals.rows?.[0] ? toMetrics(totals.rows[0]) : EMPTY,
    byKey,
    truncated: (rows.rows?.length ?? 0) >= MAX_ROWS,
  };
}

export function registerComparePeriodsTool(
  server: McpServer,
  getClient: GscClientProvider,
): void {
  server.registerTool(
    "compare_periods",
    {
      title: "Compare two periods",
      description:
        "Compare Search performance between a period and the previous period or the same dates a year earlier, " +
        "by query, page, country, device or search appearance. Returns total changes and the biggest click gainers " +
        "and losers, plus rows that are new or lost. Use it to answer 'what changed?' or to diagnose a traffic drop.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      try {
        const client = await getClient();
        const range = await resolveDateRange(
          client,
          input.siteUrl,
          input,
          input.type,
        );
        const previous = previousRange(range, input.comparison);
        const [currentData, previousData] = await Promise.all([
          fetchPeriod(client, input, range),
          fetchPeriod(client, input, previous),
        ]);

        const keys = new Set([
          ...currentData.byKey.keys(),
          ...previousData.byKey.keys(),
        ]);
        const rows = [...keys].map((key) => ({
          [input.dimension]: key,
          ...compare(
            currentData.byKey.get(key) ?? EMPTY,
            previousData.byKey.get(key) ?? EMPTY,
          ),
        }));
        const inBoth = rows.filter(
          (row) => row.current.impressions > 0 && row.previous.impressions > 0,
        );
        const top = <T>(list: T[]) => list.slice(0, input.limit);

        const result = {
          siteUrl: input.siteUrl,
          dimension: input.dimension,
          comparison: input.comparison,
          currentPeriod: {
            ...(input.dateRange && { dateRange: input.dateRange }),
            ...range,
          },
          previousPeriod: previous,
          totals: compare(currentData.totals, previousData.totals),
          gainers: top(
            inBoth
              .filter((row) => row.change.clicks > 0)
              .sort((a, b) => b.change.clicks - a.change.clicks),
          ),
          losers: top(
            inBoth
              .filter((row) => row.change.clicks < 0)
              .sort((a, b) => a.change.clicks - b.change.clicks),
          ),
          new: top(
            rows
              .filter((row) => row.previous.impressions === 0)
              .sort((a, b) => b.current.clicks - a.current.clicks),
          ),
          lost: top(
            rows
              .filter((row) => row.current.impressions === 0)
              .sort((a, b) => b.previous.clicks - a.previous.clicks),
          ),
          ...((currentData.truncated || previousData.truncated) && {
            truncated: `A period hit the API's ${MAX_ROWS.toLocaleString("en")}-row limit, so rows beyond it are missing from the lists (totals are still exact). Narrow with filters for full coverage.`,
          }),
          ...(previous.startDate <
            addMonths(todayInPacific(), -RETENTION_MONTHS) && {
            note: "The previous period starts more than 16 months ago, beyond Search Console's data retention, so its numbers are incomplete.",
          }),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toToolError("compare_periods", error);
      }
    },
  );
}

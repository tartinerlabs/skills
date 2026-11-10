import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type {
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
import { type DateRange, resolveDateRange } from "../utils/date-range.ts";
import { toToolError } from "../utils/errors.ts";

// Values below follow https://developers.google.com/webmaster-tools/v1/searchanalytics/query
const DIMENSIONS = [
  "date",
  "hour",
  "query",
  "page",
  "country",
  "device",
  "searchAppearance",
] as const;
const AGGREGATION_TYPES = [
  "auto",
  "byPage",
  "byProperty",
  "byNewsShowcasePanel",
] as const;
const DATA_STATES = ["final", "all", "hourly_all"] as const;

const searchAnalyticsInput = z
  .object({
    siteUrl: siteUrlSchema,
    ...dateRangeFields,
    dimensions: z
      .array(z.enum(DIMENSIONS))
      .refine((dims) => new Set(dims).size === dims.length, {
        message: "Each dimension may appear only once.",
      })
      .optional()
      .describe("Group-by dimensions, in order. Omit for a single totals row."),
    type: z
      .enum(SEARCH_TYPES)
      .optional()
      .describe("Search type (API default: web)."),
    filters: z
      .array(filterSchema)
      .optional()
      .describe(
        "Dimension filters; all must match (the API only supports AND groups).",
      ),
    aggregationType: z
      .enum(AGGREGATION_TYPES)
      .optional()
      .describe("API default: auto."),
    dataState: z
      .enum(DATA_STATES)
      .optional()
      .describe(
        "final (API default), all (includes fresh data) or hourly_all (use with the hour dimension).",
      ),
    rowLimit: z
      .number()
      .int()
      .min(1)
      .max(25000)
      .optional()
      .describe("1–25,000 (API default 1,000)."),
    startRow: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Zero-based row offset for paging."),
  })
  .refine(hasOneDateRange, oneDateRangeError)
  .refine(isStartOnOrBeforeEnd, startAfterEndError)
  .refine(
    (input) =>
      input.aggregationType !== "byProperty" ||
      !(
        input.dimensions?.includes("page") ||
        input.filters?.some((filter) => filter.dimension === "page")
      ),
    {
      message:
        "aggregationType byProperty cannot be combined with grouping or filtering by page; use auto.",
      path: ["aggregationType"],
    },
  );

type SearchAnalyticsInput = z.infer<typeof searchAnalyticsInput>;

/** Turn the API's positional `keys` into named dimension values. */
function transformSearchAnalytics(
  input: SearchAnalyticsInput,
  range: DateRange,
  response: SearchAnalyticsResponse,
) {
  const dimensions = input.dimensions ?? [];
  const rows = (response.rows ?? []).map((row) => {
    const keys = row.keys ?? [];
    return {
      ...Object.fromEntries(
        dimensions.map((dimension, index) => [dimension, keys[index] ?? null]),
      ),
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? null,
    };
  });
  return {
    siteUrl: input.siteUrl,
    ...(input.dateRange && { dateRange: input.dateRange }),
    startDate: range.startDate,
    endDate: range.endDate,
    dimensions,
    responseAggregationType: response.responseAggregationType ?? null,
    ...(response.metadata && { metadata: response.metadata }),
    rowCount: rows.length,
    rows,
    ...(rows.length === 0 && {
      note: "No data matched this query. Check the date range, filters, search type and property. Recent days may only appear with dataState all.",
    }),
  };
}

export function registerAnalyticsTool(
  server: McpServer,
  getClient: GscClientProvider,
): void {
  server.registerTool(
    "search_analytics",
    {
      title: "Query Search Analytics",
      description:
        "Query Google Search performance (clicks, impressions, CTR, average position) for a property over a date range " +
        "(a dateRange preset, or explicit startDate/endDate), " +
        "optionally grouped by dimensions and filtered. Rows are sorted by clicks (or by date when grouped by date). " +
        "Use startRow to page through more than rowLimit rows.",
      inputSchema: searchAnalyticsInput,
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
        const response = await client.querySearchAnalytics(input.siteUrl, {
          ...range,
          dimensions: input.dimensions,
          type: input.type,
          aggregationType: input.aggregationType,
          dataState: input.dataState,
          rowLimit: input.rowLimit,
          startRow: input.startRow,
          dimensionFilterGroups: input.filters?.length
            ? [{ groupType: "and", filters: input.filters }]
            : undefined,
        });
        const result = transformSearchAnalytics(input, range, response);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toToolError("search_analytics", error);
      }
    },
  );
}

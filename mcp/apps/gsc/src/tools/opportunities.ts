import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type { GscClientProvider } from "../google/client.ts";
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
import { resolveDateRange } from "../utils/date-range.ts";
import { toToolError } from "../utils/errors.ts";

const OPPORTUNITY_DIMENSIONS = ["query", "page"] as const;
/** The API's maximum rows per request. */
const MAX_ROWS = 25_000;
/** Striking-distance potential assumes the row could reach the top 3. */
const TARGET_POSITION = 3;
/** CTR gaps are only meaningful on the first results page. */
const CTR_GAP_MAX_POSITION = 10;

const inputSchema = z
  .object({
    siteUrl: siteUrlSchema,
    ...dateRangeFields,
    dimension: z
      .enum(OPPORTUNITY_DIMENSIONS)
      .default("query")
      .describe("Find opportunities per query or per page."),
    type: z
      .enum(SEARCH_TYPES)
      .optional()
      .describe("Search type (API default: web)."),
    filters: z
      .array(filterSchema)
      .optional()
      .describe("Dimension filters; all must match."),
    minPosition: z
      .number()
      .min(1)
      .default(4)
      .describe("Lowest average position counted as striking distance."),
    maxPosition: z
      .number()
      .min(1)
      .max(100)
      .default(20)
      .describe("Highest average position counted as striking distance."),
    minImpressions: z
      .number()
      .int()
      .min(1)
      .default(50)
      .describe("Ignore rows with fewer impressions than this."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25)
      .describe("Rows per list."),
  })
  .refine(hasOneDateRange, oneDateRangeError)
  .refine(isStartOnOrBeforeEnd, startAfterEndError)
  .refine((input) => input.minPosition <= input.maxPosition, {
    message: "minPosition must be at or below maxPosition.",
    path: ["minPosition"],
  });

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

interface Row {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Impression-weighted CTR of the given rows, or null without impressions. */
function weightedCtr(rows: Row[]): number | null {
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  if (impressions === 0) return null;
  return rows.reduce((sum, row) => sum + row.clicks, 0) / impressions;
}

export function registerOpportunitiesTool(
  server: McpServer,
  getClient: GscClientProvider,
): void {
  server.registerTool(
    "find_opportunities",
    {
      title: "Find SEO opportunities",
      description:
        "Find the queries or pages with the most upside, measured against the property's own CTR-by-position curve " +
        "for the same period (so it reflects the niche and SERP features such as AI Overviews). " +
        "strikingDistance: rows ranking between minPosition and maxPosition, ranked by the extra clicks a top-3 average " +
        "position would bring (improve the content and internal links). ctrGaps: first-page rows whose CTR is below " +
        "the curve at their position, ranked by missed clicks (improve the title and snippet).",
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
        const response = await client.querySearchAnalytics(input.siteUrl, {
          ...range,
          dimensions: [input.dimension],
          type: input.type,
          rowLimit: MAX_ROWS,
          dimensionFilterGroups: input.filters?.length
            ? [{ groupType: "and", filters: input.filters }]
            : undefined,
        });
        const rows: Row[] = (response.rows ?? []).flatMap((row) => {
          const key = row.keys?.[0];
          return key === undefined || row.position == null
            ? []
            : [
                {
                  key,
                  clicks: row.clicks ?? 0,
                  impressions: row.impressions ?? 0,
                  ctr: row.ctr ?? 0,
                  position: row.position,
                },
              ];
        });

        // The property's CTR at each rounded position, from every row in the period.
        const buckets = new Map<number, Row[]>();
        for (const row of rows) {
          const bucket = Math.round(row.position);
          const bucketRows = buckets.get(bucket);
          if (bucketRows) bucketRows.push(row);
          else buckets.set(bucket, [row]);
        }
        const curve = [...buckets.entries()]
          .filter(([position]) => position <= input.maxPosition)
          .sort(([a], [b]) => a - b)
          .map(([position, bucketRows]) => ({
            position,
            ctr: round(weightedCtr(bucketRows) ?? 0, 4),
            impressions: bucketRows.reduce(
              (sum, row) => sum + row.impressions,
              0,
            ),
          }));
        const expectedCtr = new Map(
          curve.map((point) => [point.position, point.ctr]),
        );
        const targetCtr = weightedCtr(
          rows.filter((row) => Math.round(row.position) <= TARGET_POSITION),
        );

        const summarise = (row: Row) => ({
          [input.dimension]: row.key,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: round(row.ctr, 4),
          position: round(row.position, 1),
        });
        const eligible = rows.filter(
          (row) => row.impressions >= input.minImpressions,
        );

        const strikingDistance =
          targetCtr === null
            ? []
            : eligible
                .filter(
                  (row) =>
                    row.position >= input.minPosition &&
                    row.position <= input.maxPosition,
                )
                .map((row) => ({
                  ...summarise(row),
                  potentialExtraClicks: Math.max(
                    0,
                    Math.round(row.impressions * targetCtr - row.clicks),
                  ),
                }))
                .sort((a, b) => b.potentialExtraClicks - a.potentialExtraClicks)
                .slice(0, input.limit);

        const ctrGaps = eligible
          .filter((row) => Math.round(row.position) <= CTR_GAP_MAX_POSITION)
          .map((row) => {
            const expected = expectedCtr.get(Math.round(row.position)) ?? 0;
            return {
              ...summarise(row),
              expectedCtr: expected,
              missedClicks: Math.round(row.impressions * (expected - row.ctr)),
            };
          })
          .filter((row) => row.missedClicks > 0)
          .sort((a, b) => b.missedClicks - a.missedClicks)
          .slice(0, input.limit);

        const result = {
          siteUrl: input.siteUrl,
          dimension: input.dimension,
          ...(input.dateRange && { dateRange: input.dateRange }),
          ...range,
          ctrCurve: curve,
          top3Ctr: targetCtr === null ? null : round(targetCtr, 4),
          strikingDistance,
          ctrGaps,
          ...(rows.length >= MAX_ROWS && {
            truncated: `The API's ${MAX_ROWS.toLocaleString("en")}-row limit was reached; rows are sorted by clicks, so low-click rows with many impressions may be missing. Narrow with filters for full coverage.`,
          }),
          ...(rows.length === 0 && {
            note: "No data matched this query. Check the date range, filters, search type and property.",
          }),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toToolError("find_opportunities", error);
      }
    },
  );
}

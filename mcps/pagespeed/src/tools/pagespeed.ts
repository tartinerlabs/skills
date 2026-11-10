import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type {
  Category,
  LighthouseAudit,
  LighthouseResult,
  PageSpeedClientProvider,
} from "../google/client.ts";
import { httpUrlSchema } from "../schemas/common.ts";
import { toToolError, UnexpectedResponseError } from "../utils/errors.ts";

const CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
] as const satisfies readonly Category[];

// Audits that cannot fail (informational, manual checks, not applicable) are never findings.
const SCORED_MODES = new Set(["binary", "numeric", "metricSavings"]);
const PASSING_SCORE = 0.9;

const inputSchema = z.object({
  url: httpUrlSchema.describe("The page to analyse."),
  strategy: z
    .enum(["mobile", "desktop"])
    .default("mobile")
    .describe("Emulated device (default mobile, which Google ranks on)."),
  categories: z
    .array(z.enum(CATEGORIES))
    .min(1)
    .default(["performance"])
    .refine((list) => new Set(list).size === list.length, {
      message: "Each category may appear only once.",
    })
    .describe("Lighthouse categories to run (default performance only)."),
  maxFindings: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum failing audits to return per category (default 10)."),
});

function totalSavings(audit: LighthouseAudit): number {
  return Object.values(audit.metricSavings ?? {}).reduce(
    (sum, value) => sum + value,
    0,
  );
}

function savings(audit: LighthouseAudit) {
  const nonZero = Object.entries(audit.metricSavings ?? {}).filter(
    ([, value]) => value > 0,
  );
  return nonZero.length ? Object.fromEntries(nonZero) : undefined;
}

/** Turn a multi-megabyte Lighthouse report into scores, lab metrics and the most impactful failing audits. */
function summariseLighthouse(
  result: LighthouseResult,
  categories: Category[],
  maxFindings: number,
) {
  const scores: Record<string, number | null> = {};
  const findings: Record<string, unknown[]> = {};

  for (const id of categories) {
    const category = result.categories[id];
    if (!category) continue;
    scores[id] =
      category.score === null ? null : Math.round(category.score * 100);

    const failing = category.auditRefs
      .filter((ref) => ref.group !== "metrics" && ref.group !== "hidden")
      .map((ref) => result.audits[ref.id])
      .filter(
        (audit): audit is LighthouseAudit =>
          audit !== undefined &&
          audit.score !== null &&
          audit.score < PASSING_SCORE &&
          SCORED_MODES.has(audit.scoreDisplayMode ?? ""),
      )
      .sort(
        (a, b) =>
          totalSavings(b) - totalSavings(a) || (a.score ?? 0) - (b.score ?? 0),
      );

    findings[id] = failing.slice(0, maxFindings).map((audit) => ({
      id: audit.id,
      title: audit.title,
      score: audit.score,
      displayValue: audit.displayValue,
      metricSavings: savings(audit),
    }));
  }

  const performance = result.categories.performance;
  const labMetrics = performance
    ? performance.auditRefs
        .filter((ref) => ref.group === "metrics")
        .flatMap((ref) => {
          const audit = result.audits[ref.id];
          if (!audit) return [];
          return [
            {
              id: audit.id,
              acronym: ref.acronym,
              title: audit.title,
              displayValue: audit.displayValue,
              numericValue: audit.numericValue,
              numericUnit: audit.numericUnit,
              score: audit.score,
            },
          ];
        })
    : undefined;

  return {
    requestedUrl: result.requestedUrl,
    finalUrl: result.finalDisplayedUrl,
    fetchTime: result.fetchTime,
    lighthouseVersion: result.lighthouseVersion,
    scores,
    labMetrics,
    findings,
    runWarnings: result.runWarnings?.length ? result.runWarnings : undefined,
  };
}

export function registerPagespeedTool(
  server: McpServer,
  getClient: PageSpeedClientProvider,
): void {
  server.registerTool(
    "pagespeed_analyze",
    {
      title: "Analyse a page with PageSpeed Insights",
      description:
        "Run Lighthouse on a public URL through PageSpeed Insights and return lab results: category scores (0-100), " +
        "lab metrics (LCP, CLS, TBT, FCP, Speed Index) and the failing audits per category, ranked by estimated savings. " +
        "A run takes 10-60 seconds. This is lab data from one emulated load; for real-user Core Web Vitals use crux_query.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ url, strategy, categories, maxFindings }) => {
      try {
        const response = await (await getClient()).runPagespeed({
          url,
          strategy,
          categories,
        });
        if (!response.lighthouseResult) {
          throw new UnexpectedResponseError(
            "PageSpeed Insights returned no Lighthouse result for this URL. Retry later.",
          );
        }
        const { runtimeError } = response.lighthouseResult;
        if (runtimeError) {
          throw new UnexpectedResponseError(
            `Lighthouse could not analyse this URL (${runtimeError.code}): ${runtimeError.message}`,
          );
        }
        const result = {
          strategy,
          ...summariseLighthouse(
            response.lighthouseResult,
            categories,
            maxFindings,
          ),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toToolError("pagespeed_analyze", error);
      }
    },
  );
}

import * as z from "zod";

const DOMAIN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function parseHttpUrl(value: string): URL | undefined {
  if (!URL.canParse(value)) return undefined;
  const url = new URL(value);
  return url.protocol === "https:" || url.protocol === "http:"
    ? url
    : undefined;
}

/** A Search Console property: URL-prefix (`https://example.com/`) or Domain (`sc-domain:example.com`). */
export const siteUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (value.startsWith("sc-domain:"))
        return DOMAIN.test(value.slice("sc-domain:".length));
      return parseHttpUrl(value) !== undefined && value.endsWith("/");
    },
    {
      message:
        "siteUrl must be a Search Console property exactly as listed by list_sites: " +
        "a URL-prefix property such as https://www.example.com/ (with trailing slash) " +
        "or a Domain property such as sc-domain:example.com.",
    },
  )
  .describe(
    "Search Console property, exactly as returned by list_sites, e.g. https://www.example.com/ or sc-domain:example.com",
  );

export const httpUrlSchema = z
  .string()
  .trim()
  .refine((value) => parseHttpUrl(value) !== undefined, {
    message: "Must be an absolute http:// or https:// URL.",
  });

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Dates must use the YYYY-MM-DD format.",
  })
  .refine(isRealDate, { message: "Not a valid calendar date." });

/** Whether `inspectionUrl` belongs to the Search Console property `siteUrl`. */
export function isUrlInProperty(
  inspectionUrl: string,
  siteUrl: string,
): boolean {
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    const host = parseHttpUrl(inspectionUrl)?.hostname.toLowerCase();
    return (
      host !== undefined && (host === domain || host.endsWith(`.${domain}`))
    );
  }
  return inspectionUrl.startsWith(siteUrl);
}

export const DATE_RANGE_PRESETS = [
  "last7Days",
  "last28Days",
  "last3Months",
  "last6Months",
  "last12Months",
  "last16Months",
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

/** Either a preset or an explicit `startDate`/`endDate` pair; combine with the refinements below. */
export const dateRangeFields = {
  startDate: dateSchema
    .optional()
    .describe(
      "Start date (inclusive), YYYY-MM-DD, Pacific Time. Use with endDate instead of dateRange.",
    ),
  endDate: dateSchema
    .optional()
    .describe(
      "End date (inclusive), YYYY-MM-DD, Pacific Time. Use with startDate instead of dateRange.",
    ),
  dateRange: z
    .enum(DATE_RANGE_PRESETS)
    .optional()
    .describe(
      "Preset ending on the latest day with final data, like the Search Console UI. Use instead of startDate/endDate.",
    ),
};

export interface DateRangeInput {
  startDate?: string;
  endDate?: string;
  dateRange?: DateRangePreset;
}

export function hasOneDateRange(input: DateRangeInput): boolean {
  return input.dateRange
    ? input.startDate === undefined && input.endDate === undefined
    : input.startDate !== undefined && input.endDate !== undefined;
}

export const oneDateRangeError = {
  message: "Give either dateRange or both startDate and endDate.",
  path: ["dateRange"],
};

export function isStartOnOrBeforeEnd(input: DateRangeInput): boolean {
  return (
    input.startDate === undefined ||
    input.endDate === undefined ||
    input.startDate <= input.endDate
  );
}

export const startAfterEndError = {
  message: "startDate must be on or before endDate.",
  path: ["startDate"],
};

// Values below follow https://developers.google.com/webmaster-tools/v1/searchanalytics/query
const FILTER_DIMENSIONS = [
  "country",
  "device",
  "page",
  "query",
  "searchAppearance",
] as const;
const OPERATORS = [
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "includingRegex",
  "excludingRegex",
] as const;
export const SEARCH_TYPES = [
  "web",
  "image",
  "video",
  "news",
  "discover",
  "googleNews",
] as const;

export const filterSchema = z.object({
  dimension: z.enum(FILTER_DIMENSIONS),
  operator: z.enum(OPERATORS).default("equals"),
  expression: z
    .string()
    .min(1)
    .max(4096)
    .describe(
      "Value to match. country: ISO 3166-1 alpha-3 code (e.g. GBR); device: DESKTOP, MOBILE or TABLET; regex operators use RE2 syntax.",
    ),
});

import * as z from "zod";

function parseHttpUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

export const httpUrlSchema = z
  .string()
  .trim()
  .refine((value) => parseHttpUrl(value) !== undefined, {
    message: "Must be an absolute http:// or https:// URL.",
  });

const originSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      const url = parseHttpUrl(value);
      return (
        url !== undefined &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash &&
        !url.username &&
        !value.endsWith("?") &&
        !value.endsWith("#")
      );
    },
    {
      message:
        "origin must be a scheme and host only, such as https://example.com (no path, query or fragment).",
    },
  )
  .transform((value) => new URL(value).origin);

export const formFactorSchema = z
  .enum(["PHONE", "DESKTOP", "TABLET"])
  .optional()
  .describe("Device type. Omit to aggregate all devices.");

/** The Core Web Vitals plus FCP and TTFB, as named by the CrUX API. */
export const CRUX_METRICS = [
  "largest_contentful_paint",
  "interaction_to_next_paint",
  "cumulative_layout_shift",
  "first_contentful_paint",
  "experimental_time_to_first_byte",
] as const;

export const cruxMetricsSchema = z
  .array(z.enum(CRUX_METRICS))
  .min(1)
  .optional()
  .describe("Metrics to return (default: all of LCP, INP, CLS, FCP and TTFB).");

/** Exactly one of `url` or `origin`, as the CrUX API requires. */
export const cruxTargetFields = {
  url: httpUrlSchema
    .optional()
    .describe("A single page URL. Give either url or origin."),
  origin: originSchema
    .optional()
    .describe(
      "A whole site, such as https://example.com. Give either url or origin.",
    ),
};

export function hasExactlyOneTarget(input: {
  url?: string;
  origin?: string;
}): boolean {
  return (input.url === undefined) !== (input.origin === undefined);
}

export const TARGET_MESSAGE = "Give exactly one of url or origin.";

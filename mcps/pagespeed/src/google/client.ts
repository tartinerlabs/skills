import { ConfigurationError, GoogleApiError } from "../utils/errors.ts";

type Strategy = "mobile" | "desktop";
export type Category =
  | "performance"
  | "accessibility"
  | "best-practices"
  | "seo";
type FormFactor = "PHONE" | "DESKTOP" | "TABLET";

export interface RunPagespeedParams {
  url: string;
  strategy: Strategy;
  categories: Category[];
}

/** One field-data metric from PageSpeed Insights' `loadingExperience`. */
interface LoadingExperienceMetric {
  percentile?: number;
  category?: string;
  distributions?: { min?: number; max?: number; proportion?: number }[];
}

interface LoadingExperience {
  id?: string;
  metrics?: Record<string, LoadingExperienceMetric>;
  overall_category?: string;
}

export interface LighthouseAudit {
  id: string;
  title: string;
  score: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
  numericUnit?: string;
  metricSavings?: Record<string, number>;
}

export interface LighthouseCategory {
  id: string;
  title: string;
  score: number | null;
  auditRefs: { id: string; weight: number; group?: string; acronym?: string }[];
}

export interface LighthouseResult {
  lighthouseVersion?: string;
  requestedUrl?: string;
  finalDisplayedUrl?: string;
  fetchTime?: string;
  runWarnings?: string[];
  /** Set when Lighthouse could not analyse the page; the result should be discarded. */
  runtimeError?: { code: string; message: string };
  categories: Partial<Record<Category, LighthouseCategory>>;
  audits: Record<string, LighthouseAudit>;
}

/** The parts of a PageSpeed Insights v5 response the tools read. */
export interface PagespeedResponse {
  id?: string;
  analysisUTCTimestamp?: string;
  loadingExperience?: LoadingExperience;
  originLoadingExperience?: LoadingExperience;
  lighthouseResult?: LighthouseResult;
}

export type CruxTarget = { url: string } | { origin: string };

export interface CruxRequest {
  formFactor?: FormFactor;
  metrics?: string[];
}

interface CruxDate {
  year: number;
  month: number;
  day: number;
}

export interface CruxCollectionPeriod {
  firstDate: CruxDate;
  lastDate: CruxDate;
}

export interface CruxRecordResponse {
  record: {
    key: Record<string, string>;
    metrics: Record<
      string,
      {
        histogram?: {
          start: number | string;
          end?: number | string;
          density?: number;
        }[];
        percentiles?: { p75?: number | string };
      }
    >;
    collectionPeriod?: CruxCollectionPeriod;
  };
}

export interface CruxHistoryResponse {
  record: {
    key: Record<string, string>;
    metrics: Record<
      string,
      {
        histogramTimeseries?: {
          start: number | string;
          end?: number | string;
          densities?: (number | string)[];
        }[];
        percentilesTimeseries?: { p75s?: (number | string | null)[] };
      }
    >;
    collectionPeriods?: CruxCollectionPeriod[];
  };
}

/** The Google API operations the MCP tools depend on. */
export interface PageSpeedClient {
  runPagespeed(params: RunPagespeedParams): Promise<PagespeedResponse>;
  queryRecord(
    target: CruxTarget,
    request: CruxRequest,
  ): Promise<CruxRecordResponse>;
  queryHistoryRecord(
    target: CruxTarget,
    request: CruxRequest & { collectionPeriodCount: number },
  ): Promise<CruxHistoryResponse>;
}

/**
 * Resolves the client lazily, inside each tool call, so a missing API key
 * surfaces as a tool error rather than an HTTP error.
 */
export type PageSpeedClientProvider = () =>
  | PageSpeedClient
  | Promise<PageSpeedClient>;

const PAGESPEED_URL =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CRUX_URL = "https://chromeuxreport.googleapis.com/v1/records";
// A Lighthouse run usually takes 10-30 s; stay well inside Vercel's function limit.
const PAGESPEED_TIMEOUT_MS = 120_000;
const CRUX_TIMEOUT_MS = 30_000;

async function request<T>(
  url: URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw new GoogleApiError(response.status, data);
  return data as T;
}

export function createPageSpeedClient(
  apiKey = process.env.GOOGLE_API_KEY,
): PageSpeedClient {
  if (!apiKey) {
    throw new ConfigurationError(
      "The server has no GOOGLE_API_KEY configured for PageSpeed Insights and the Chrome UX Report.",
    );
  }

  // The key travels in a header rather than `?key=` so it never appears in URLs.
  const headers = { "x-goog-api-key": apiKey };

  const crux = <T>(method: string, body: object) =>
    request<T>(
      new URL(`${CRUX_URL}:${method}`),
      {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      CRUX_TIMEOUT_MS,
    );

  return {
    runPagespeed({ url, strategy, categories }) {
      const endpoint = new URL(PAGESPEED_URL);
      endpoint.searchParams.set("url", url);
      endpoint.searchParams.set("strategy", strategy);
      for (const category of categories) {
        endpoint.searchParams.append("category", category);
      }
      return request(endpoint, { headers }, PAGESPEED_TIMEOUT_MS);
    },
    queryRecord(target, body) {
      return crux("queryRecord", { ...target, ...body });
    },
    queryHistoryRecord(target, body) {
      return crux("queryHistoryRecord", { ...target, ...body });
    },
  };
}

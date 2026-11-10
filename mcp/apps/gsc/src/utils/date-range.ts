import type { GscClient } from "../google/client.ts";
import type { DateRangeInput, DateRangePreset } from "../schemas/common.ts";

export interface DateRange {
  startDate: string;
  endDate: string;
}

const PRESET_LENGTHS: Record<
  DateRangePreset,
  { days?: number; months?: number }
> = {
  last7Days: { days: 7 },
  last28Days: { days: 28 },
  last3Months: { months: 3 },
  last6Months: { months: 6 },
  last12Months: { months: 12 },
  last16Months: { months: 16 },
};

/** How far back to look for the latest day with final data. */
const FRESHNESS_WINDOW_DAYS = 10;
/** Used when the freshness window has no data at all; final data usually lags 2–3 days. */
const FALLBACK_LAG_DAYS = 3;

function parse(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const result = parse(date);
  result.setUTCDate(result.getUTCDate() + days);
  return format(result);
}

/** Calendar month arithmetic, clamping to the last day of shorter months (e.g. 31 May − 3 months → 28 Feb). */
export function addMonths(date: string, months: number): string {
  const source = parse(date);
  const target = new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(source.getUTCDate(), lastDay));
  return format(target);
}

/** Inclusive number of days in a range. */
export function daysInRange({ startDate, endDate }: DateRange): number {
  return (
    (parse(endDate).getTime() - parse(startDate).getTime()) / 86_400_000 + 1
  );
}

/** Today's date in Pacific Time, the time zone Search Console reports in. */
export function todayInPacific(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
  }).format(now);
}

/** The latest day with final data for the property, found with one small date-grouped query. */
async function latestFinalDate(
  client: GscClient,
  siteUrl: string,
  type: string | undefined,
): Promise<string> {
  const today = todayInPacific();
  const response = await client.querySearchAnalytics(siteUrl, {
    startDate: addDays(today, -FRESHNESS_WINDOW_DAYS),
    endDate: today,
    dimensions: ["date"],
    type,
  });
  const dates = (response.rows ?? [])
    .map((row) => row.keys?.[0])
    .filter((date): date is string => date !== undefined);
  return dates.length > 0
    ? dates.reduce((latest, date) => (date > latest ? date : latest))
    : addDays(today, -FALLBACK_LAG_DAYS);
}

/** Explicit dates pass through; a preset ends on the latest day with final data. */
export async function resolveDateRange(
  client: GscClient,
  siteUrl: string,
  input: DateRangeInput,
  type?: string,
): Promise<DateRange> {
  if (!input.dateRange) {
    return { startDate: input.startDate ?? "", endDate: input.endDate ?? "" };
  }
  const endDate = await latestFinalDate(client, siteUrl, type);
  const { days, months } = PRESET_LENGTHS[input.dateRange];
  const startDate = days
    ? addDays(endDate, 1 - days)
    : addDays(addMonths(endDate, -(months ?? 0)), 1);
  return { startDate, endDate };
}

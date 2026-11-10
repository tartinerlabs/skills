import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysInRange,
  todayInPacific,
} from "../src/utils/date-range.ts";

describe("date arithmetic", () => {
  it("should add days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("should clamp to the last day of shorter months", () => {
    expect(addMonths("2026-05-31", -3)).toBe("2026-02-28");
    expect(addMonths("2026-10-17", -16)).toBe("2025-06-17");
  });

  it("should count days inclusively", () => {
    expect(
      daysInRange({ startDate: "2026-01-01", endDate: "2026-01-28" }),
    ).toBe(28);
  });

  it("should give today's date in Pacific Time", () => {
    // 05:00 UTC on 18 October is still 17 October in California.
    expect(todayInPacific(new Date("2026-10-18T05:00:00Z"))).toBe("2026-10-17");
  });
});

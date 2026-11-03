import { describe, expect, it } from "vitest";
import {
  addDaysToDateString,
  dateRange,
  formatPracticeDateTime,
  localDateTimeToIso,
  minutesToTime,
  overlaps,
  practiceDateFromIso,
  practiceTimeFromIso,
  timeToMinutes,
} from "@/lib/domain/time";

describe("practice time helpers", () => {
  it("converts winter practice time to UTC (EST)", () => {
    expect(localDateTimeToIso("2026-01-15", "09:00")).toBe(
      "2026-01-15T14:00:00.000Z",
    );
  });

  it("converts summer practice time to UTC (EDT)", () => {
    expect(localDateTimeToIso("2026-07-15", "09:00")).toBe(
      "2026-07-15T13:00:00.000Z",
    );
  });

  it("formats an ISO instant back into practice date and time", () => {
    const iso = "2026-11-10T13:00:00.000Z";
    expect(practiceDateFromIso(iso)).toBe("2026-11-10");
    expect(practiceTimeFromIso(iso)).toBe("08:00");
    expect(formatPracticeDateTime(iso)).toContain("8:00 AM");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDaysToDateString("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateString("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("builds inclusive date ranges with a guard", () => {
    expect(dateRange("2026-11-01", "2026-11-03")).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
    expect(dateRange("2026-11-01", "2027-01-01")).toHaveLength(62);
  });

  it("round-trips minutes and times", () => {
    expect(timeToMinutes("08:45")).toBe(525);
    expect(minutesToTime(525)).toBe("08:45");
  });

  it("detects overlapping intervals", () => {
    expect(
      overlaps(
        "2026-11-10T13:00:00.000Z",
        "2026-11-10T13:30:00.000Z",
        "2026-11-10T13:15:00.000Z",
        "2026-11-10T13:45:00.000Z",
      ),
    ).toBe(true);
    expect(
      overlaps(
        "2026-11-10T13:00:00.000Z",
        "2026-11-10T13:30:00.000Z",
        "2026-11-10T13:30:00.000Z",
        "2026-11-10T14:00:00.000Z",
      ),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  getNextOccurrenceDate,
  getOccurrenceDate,
  listOccurrenceDates,
} from "./recurring-transactions.service.js";

describe("recurring transactions schedule helpers", () => {
  it("preserves end-of-month cadence for monthly schedules", () => {
    const schedule = {
      startDate: "2026-01-31",
      endDate: null,
      cadence: "monthly" as const,
      intervalCount: 1,
    };

    expect(getOccurrenceDate(schedule, 0)).toBe("2026-01-31");
    expect(getOccurrenceDate(schedule, 1)).toBe("2026-02-28");
    expect(getOccurrenceDate(schedule, 2)).toBe("2026-03-31");
  });

  it("returns the next future occurrence from a reference date", () => {
    const schedule = {
      startDate: "2026-03-15",
      endDate: null,
      cadence: "monthly" as const,
      intervalCount: 1,
    };

    expect(getNextOccurrenceDate(schedule, "2026-04-02")).toBe("2026-04-15");
  });

  it("stops occurrence generation at the configured end date", () => {
    const schedule = {
      startDate: "2026-04-01",
      endDate: "2026-06-01",
      cadence: "monthly" as const,
      intervalCount: 1,
    };

    expect(listOccurrenceDates(schedule, "2026-12-31")).toEqual([
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
    ]);
  });
});
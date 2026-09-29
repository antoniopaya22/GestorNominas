import { describe, expect, it } from "vitest";
import { alertConfigSchemas, nextPeriod } from "./alerts.service.js";

describe("nextPeriod", () => {
  it("advances within the same year", () => {
    expect(nextPeriod(2026, 3)).toEqual({ year: 2026, month: 4 });
  });

  it("wraps around into the next year after december", () => {
    expect(nextPeriod(2026, 12)).toEqual({ year: 2027, month: 1 });
  });
});

describe("alertConfigSchemas", () => {
  it("applies defaults for salary_drop", () => {
    const result = alertConfigSchemas.salary_drop.parse({});
    expect(result).toEqual({ thresholdPercent: 10 });
  });

  it("rejects a threshold above 100%", () => {
    const result = alertConfigSchemas.salary_drop.safeParse({ thresholdPercent: 150 });
    expect(result.success).toBe(false);
  });

  it("requires conceptName for concept_change", () => {
    const result = alertConfigSchemas.concept_change.safeParse({ thresholdPercent: 20 });
    expect(result.success).toBe(false);
  });

  it("accepts a valid concept_change config", () => {
    const result = alertConfigSchemas.concept_change.parse({ conceptName: "IRPF" });
    expect(result).toEqual({ conceptName: "IRPF", thresholdPercent: 15 });
  });

  it("requires metric and comparator for custom_threshold", () => {
    const result = alertConfigSchemas.custom_threshold.safeParse({ value: 1500 });
    expect(result.success).toBe(false);
  });

  it("accepts a valid custom_threshold config", () => {
    const result = alertConfigSchemas.custom_threshold.parse({
      metric: "net",
      comparator: "below",
      value: 1500,
    });
    expect(result.metric).toBe("net");
  });

  it("rejects a negative graceDays for missing_payslip", () => {
    const result = alertConfigSchemas.missing_payslip.safeParse({ graceDays: -1 });
    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { scoreLinkCandidates, payslipReferenceDateMs, type LinkCandidate } from "./payslip-links.service.js";

function candidate(overrides: Partial<LinkCandidate> = {}): LinkCandidate {
  return {
    id: 1,
    accountId: 1,
    accountName: "Cuenta principal",
    amount: 1500,
    date: "2026-09-28",
    payee: null,
    ...overrides,
  };
}

describe("scoreLinkCandidates", () => {
  it("descarta candidatas con un importe muy distinto", () => {
    const candidates = [candidate({ id: 1, amount: 1500 }), candidate({ id: 2, amount: 40 })];
    const result = scoreLinkCandidates(candidates, 1500, null);
    expect(result.map((c) => c.id)).toEqual([1]);
  });

  it("prioriza la coincidencia exacta de importe sobre la fecha", () => {
    const target = payslipReferenceDateMs(2026, 9)!;
    const candidates = [
      candidate({ id: 1, amount: 1490, date: "2026-09-28" }), // exacta en fecha, no en importe
      candidate({ id: 2, amount: 1500, date: "2026-10-15" }), // exacta en importe, lejos en fecha
    ];
    const result = scoreLinkCandidates(candidates, 1500, target);
    expect(result[0].id).toBe(2);
  });

  it("ante el mismo importe, prefiere la fecha más cercana", () => {
    const target = payslipReferenceDateMs(2026, 9)!;
    const candidates = [
      candidate({ id: 1, amount: 1500, date: "2026-10-20" }),
      candidate({ id: 2, amount: 1500, date: "2026-09-29" }),
    ];
    const result = scoreLinkCandidates(candidates, 1500, target);
    expect(result[0].id).toBe(2);
  });

  it("limita el número de resultados", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => candidate({ id: i, amount: 1500 }));
    const result = scoreLinkCandidates(candidates, 1500, null, 3);
    expect(result).toHaveLength(3);
  });
});

describe("payslipReferenceDateMs", () => {
  it("devuelve null sin periodo", () => {
    expect(payslipReferenceDateMs(null, null)).toBeNull();
    expect(payslipReferenceDateMs(2026, null)).toBeNull();
  });

  it("resuelve el día 28 del mes de la nómina", () => {
    const ms = payslipReferenceDateMs(2026, 9)!;
    const date = new Date(ms);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8); // 0-indexado
    expect(date.getDate()).toBe(28);
  });
});

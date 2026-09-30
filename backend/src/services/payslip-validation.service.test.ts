import { describe, expect, it } from "vitest";
import { validatePayslip, SMI_MENSUAL_2026 } from "./payslip-validation.service.js";

describe("validatePayslip", () => {
  it("no avisa de nada cuando todo cuadra", () => {
    const warnings = validatePayslip({
      payslipType: "ordinal",
      grossSalary: 2000,
      netSalary: 1600,
      concepts: [
        { category: "devengo", amount: 2000 },
        { category: "deduccion", amount: 400 },
      ],
    });
    expect(warnings).toEqual([]);
  });

  it("avisa si bruto - deducciones no coincide con el neto", () => {
    const warnings = validatePayslip({
      payslipType: "ordinal",
      grossSalary: 2000,
      netSalary: 1700, // debería ser 1600
      concepts: [
        { category: "devengo", amount: 2000 },
        { category: "deduccion", amount: 400 },
      ],
    });
    expect(warnings.map((w) => w.code)).toContain("amount_mismatch");
  });

  it("tolera diferencias de céntimos por redondeo", () => {
    const warnings = validatePayslip({
      payslipType: "ordinal",
      grossSalary: 2000,
      netSalary: 1600.4, // 0,4 € de diferencia con 1600 exacto
      concepts: [
        { category: "devengo", amount: 2000 },
        { category: "deduccion", amount: 400 },
      ],
    });
    expect(warnings.map((w) => w.code)).not.toContain("amount_mismatch");
  });

  it("avisa si la suma de devengos no coincide con el bruto", () => {
    const warnings = validatePayslip({
      payslipType: "ordinal",
      grossSalary: 2000,
      netSalary: 1500,
      concepts: [
        { category: "devengo", amount: 1500 }, // falta extraer 500 € de devengos
        { category: "deduccion", amount: 500 },
      ],
    });
    expect(warnings.map((w) => w.code)).toContain("gross_mismatch");
  });

  it("avisa si el bruto de una nómina ordinaria está por debajo del SMI", () => {
    const warnings = validatePayslip({
      payslipType: "ordinal",
      grossSalary: SMI_MENSUAL_2026 - 100,
      netSalary: SMI_MENSUAL_2026 - 100,
      concepts: [],
    });
    expect(warnings.map((w) => w.code)).toContain("below_smi");
  });

  it("no comprueba el SMI en una paga extra", () => {
    const warnings = validatePayslip({
      payslipType: "extra",
      grossSalary: 300,
      netSalary: 300,
      concepts: [],
    });
    expect(warnings.map((w) => w.code)).not.toContain("below_smi");
  });

  it("no comprueba nada de importes sin conceptos", () => {
    const warnings = validatePayslip({
      payslipType: "ordinal",
      grossSalary: 2000,
      netSalary: 1000, // no cuadraría, pero sin conceptos no hay con qué comparar
      concepts: [],
    });
    expect(warnings.map((w) => w.code)).not.toContain("amount_mismatch");
    expect(warnings.map((w) => w.code)).not.toContain("gross_mismatch");
  });
});

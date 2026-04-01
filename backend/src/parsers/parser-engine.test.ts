import { describe, expect, it } from "vitest";
import { scoreParsedPayslip, shouldRetryWithOcr } from "./parser-engine.js";
import type { ParsedPayslip } from "./concept-matcher.js";

function buildParsedPayslip(overrides: Partial<ParsedPayslip> = {}): ParsedPayslip {
  return {
    periodMonth: 8,
    periodYear: 2022,
    company: "THENEXTPANGEA SL",
    grossSalary: 2591.58,
    netSalary: 1842.94,
    concepts: [
      { category: "devengo", name: "Salario Base", amount: 1291.04, isPercentage: false },
      { category: "devengo", name: "Plus Convenio", amount: 195.81, isPercentage: false },
      { category: "deduccion", name: "IRPF", amount: 469.56, isPercentage: false },
    ],
    rawText: "MENS 01 AGO 22 a 31 AGO 22\nLIQUIDO A PERCIBIR\n1.842,94",
    ...overrides,
  };
}

describe("parser-engine OCR retry heuristic", () => {
  it("retries OCR when PDF extraction is tokenized and parse quality is poor", () => {
    const rawText = [
      "NIF.",
      "B06875173",
      "PAYA",
      "GONZALEZ",
      "ANTONIO",
      "4MENS",
      "01 AGO 22",
      "a 31 AGO",
      "22",
      "1",
      "2",
      "36",
      "140",
      "144",
      "166",
      "715",
      "719",
      "799",
      "995",
      "996",
      "997",
      "999",
      "*Salario",
      "Base",
      "*Plus",
      "Convenio",
      "EMPRESA",
      "RECIBI",
      "31 AGOSTO",
      "2022",
      "LQUIDO",
      "A FERCIBIR",
      "1-.842,94",
      "3 .013. 00",
      "3 .013, 00",
      "0 ,20",
      "6, 03",
      "3,00",
      "3,00",
      "3,00",
      "3,00",
    ].join("\n");

    const parsed = buildParsedPayslip({
      periodMonth: null,
      periodYear: null,
      company: "EMPRESA",
      grossSalary: 3,
      netSalary: 3,
      concepts: [{ category: "devengo", name: "Concepto 0", amount: 3, isPercentage: false }],
      rawText,
    });

    expect(shouldRetryWithOcr(rawText, parsed)).toBe(true);
  });

  it("does not retry OCR when the PDF parse already looks reliable", () => {
    const rawText = [
      "MENS 01 JUN 22 a 30 JUN 22",
      "30,00 43,035 1  *Salario Base 1.291,04",
      "30,00 6,527 2  *Plus Convenio 195,81",
      "36  *mejora absorbible 1.041,72",
      "715  abono trabajador seguros salud 7,25",
      "789  Dcto.Conceptos en Especie 107,01",
      "995 COTIZACION CONT.COMU 4,70 143,68",
      "999 TRIBUTACION I.R.P.F.18,62 470,82",
      "LIQUIDO A PERCIBIR",
      "1.813,88",
    ].join("\n");

    const parsed = buildParsedPayslip({
      periodMonth: 6,
      periodYear: 2022,
      company: "THENEXTPANGEA SL",
      grossSalary: 2635.58,
      netSalary: 1813.88,
      concepts: [
        { category: "devengo", name: "Salario Base", amount: 1291.04, isPercentage: false },
        { category: "devengo", name: "Plus Convenio", amount: 195.81, isPercentage: false },
        { category: "devengo", name: "Mejora Voluntaria", amount: 1041.72, isPercentage: false },
        { category: "deduccion", name: "Abono Trabajador", amount: 7.25, isPercentage: false },
        { category: "deduccion", name: "Descuento Conceptos en Especie", amount: 107.01, isPercentage: false },
        { category: "deduccion", name: "IRPF", amount: 470.82, isPercentage: false },
      ],
      rawText,
    });

    expect(shouldRetryWithOcr(rawText, parsed)).toBe(false);
  });

  it("scores complete parses above broken parses", () => {
    const broken = buildParsedPayslip({
      periodMonth: null,
      periodYear: null,
      grossSalary: 3,
      netSalary: 3,
      company: "EMPRESA",
      concepts: [{ category: "devengo", name: "Concepto 0", amount: 3, isPercentage: false }],
    });
    const complete = buildParsedPayslip();

    expect(scoreParsedPayslip(complete)).toBeGreaterThan(scoreParsedPayslip(broken));
  });
});
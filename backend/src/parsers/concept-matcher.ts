export interface ParsedConcept {
  category: "devengo" | "deduccion" | "otros";
  name: string;
  amount: number;
  isPercentage: boolean;
}

export interface ParsedPayslip {
  periodMonth: number | null;
  periodYear: number | null;
  company: string | null;
  grossSalary: number | null;
  netSalary: number | null;
  concepts: ParsedConcept[];
  rawText: string;
}

// ─── Number parsing ─────────────────────────────────────────────

/** Parse Spanish number format: "1.234,56" → 1234.56 */
function parseSpanishNumber(str: string): number | null {
  const cleaned = str
    .replace(/\s/g, "")
    .replace(/\.(\d{3})/g, "$1") // Remove thousands dots (1.234 → 1234)
    .replace(",", ".");           // Decimal comma → dot
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

/** Find ALL Spanish-format amounts in a string */
function findAllAmounts(text: string): number[] {
  const re = /(\d{1,3}(?:\.\d{3})*,\d{2})/g;
  const results: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = parseSpanishNumber(m[1]);
    if (v !== null) results.push(v);
  }
  return results;
}

/** Extract the LAST amount from a text (the rightmost number) */
function extractLastAmount(text: string): number | null {
  const amounts = findAllAmounts(text);
  return amounts.length > 0 ? amounts[amounts.length - 1] : null;
}

// ─── Pre-processing: rejoin numbers split across lines ──────────

/**
 * pdf-parse often breaks lines in the middle of numbers.
 * Example: "1.869,3\n3" should be "1.869,33"
 * Example: "2.299\n,11" should be "2.299,11"
 */
function rejoinSplitNumbers(text: string): string {
  // Join: line ends with partial decimal (digit after comma, less than 2 digits)
  // Next line starts with 1-2 digits
  // e.g., "1.869,3\n3" → "1.869,33"  or  "1.869,\n33" → "1.869,33"
  text = text.replace(
    /(\d),(\d)?\s*\n\s*(\d{1,2})\b/g,
    (_, pre, mid, post) => mid ? `${pre},${mid}${post}` : `${pre},${post}`
  );

  // Join: line ends with digits (no comma yet), next line starts with ,\d{2}
  // e.g., "2.299\n,11" → "2.299,11"
  text = text.replace(
    /(\d)\s*\n\s*,(\d{2})\b/g,
    "$1,$2"
  );

  // Join: line ends with dot+digits (thousands), next line starts with digits
  // e.g., "3.628,1\n2" → "3.628,12"
  text = text.replace(
    /(\d),(\d)\s*\n\s*(\d)\b/g,
    "$1,$2$3"
  );

  return text;
}

// ─── Concept patterns ───────────────────────────────────────────

/** Combined name patterns — used for labeling only, not classification */
const NAME_PATTERNS: Array<{ regex: RegExp; name: string }> = [
  // Devengos
  { regex: /salario\s*base/i, name: "Salario Base" },
  { regex: /sueldo\s*base/i, name: "Salario Base" },
  { regex: /complemento\s*(?:personal|puesto|espec[ií]fico|destino)/i, name: "Complemento" },
  { regex: /plus\s*(?:convenio|transporte|actividad|nocturnidad|peligrosidad|turnicidad)/i, name: "Plus Convenio" },
  { regex: /antig[üu]edad/i, name: "Antigüedad" },
  { regex: /trienio/i, name: "Trienios" },
  { regex: /horas?\s*extra/i, name: "Horas Extra" },
  { regex: /paga\s*extra/i, name: "Paga Extra" },
  { regex: /gratificaci[oó]n/i, name: "Gratificación" },
  { regex: /incentivo/i, name: "Incentivo" },
  { regex: /bonus|prima\b/i, name: "Bonus/Prima" },
  { regex: /dieta/i, name: "Dietas" },
  { regex: /locomoci[oó]n|km|kil[oó]metro/i, name: "Locomoción/Transporte" },
  { regex: /mejora\s*(?:voluntaria|absorbible)/i, name: "Mejora Voluntaria" },
  { regex: /retribuci[oó]n\s*flexible/i, name: "Retribución Flexible" },
  { regex: /complemento\s*(?:de\s*)?convenio/i, name: "Complemento Convenio" },
  { regex: /vacaciones/i, name: "Vacaciones" },
  { regex: /productividad/i, name: "Productividad" },
  { regex: /poliza\s*seg(?:uro)?\s*salud/i, name: "Póliza Seguro Salud" },
  { regex: /poliza\s*seg(?:uro)?\s*vida/i, name: "Póliza Seguro Vida" },
  { regex: /abono\s*trabajador/i, name: "Abono Trabajador" },
  { regex: /abono\s*catering/i, name: "Abono Catering" },
  { regex: /catering/i, name: "Catering" },
  // Deducciones
  { regex: /cotizaci[oó]n\s*cont\.?\s*(?:ingencias?)?\s*comu/i, name: "Contingencias Comunes" },
  { regex: /contingencias?\s*comunes?/i, name: "Contingencias Comunes" },
  { regex: /cotizaci[oó]n\s*desempleo/i, name: "Desempleo" },
  { regex: /cotizaci[oó]n\s*formaci[oó]n/i, name: "Formación Profesional" },
  { regex: /formaci[oó]n\s*profesional/i, name: "Formación Profesional" },
  { regex: /cotizaci[oó]n\s*MEI|MEI\b/i, name: "MEI" },
  { regex: /mecanismo\s*equidad/i, name: "MEI" },
  { regex: /tributaci[oó]n\s*i\.?\s*r\.?\s*p\.?\s*f/i, name: "IRPF" },
  { regex: /i\.?\s*r\.?\s*p\.?\s*f\.?\s*\d/i, name: "IRPF" },
  { regex: /retenci[oó]n(?:es)?\s*(?:a\s*cuenta|irpf|fiscal)/i, name: "IRPF" },
  { regex: /desempleo/i, name: "Desempleo" },
  { regex: /anticipo/i, name: "Anticipo" },
  { regex: /embargo/i, name: "Embargo" },
  { regex: /pr[eé]stamo/i, name: "Préstamo" },
  { regex: /sindicat/i, name: "Cuota Sindical" },
  { regex: /seguro\s*m[eé]dico/i, name: "Seguro Médico" },
  { regex: /plan\s*(?:de\s*)?pensiones/i, name: "Plan de Pensiones" },
  { regex: /devol(?:uci[oó]n)?\s*poliza/i, name: "Devolución Póliza" },
  { regex: /dcto[\.\s]*conceptos/i, name: "Descuento Conceptos en Especie" },
  { regex: /imp[\.\s]*ingr/i, name: "Ingreso a Cuenta Especie" },
];

// ─── Period extraction ──────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
};

function resolveMonth(s: string): number | null {
  const low = s.toLowerCase().replace(/\./g, "");
  if (MONTH_NAMES[low]) return MONTH_NAMES[low];
  // Partial match for OCR issues
  for (const [key, val] of Object.entries(MONTH_NAMES)) {
    if (key.length >= 3 && low.startsWith(key)) return val;
  }
  return null;
}

function resolveYear(s: string): number | null {
  const n = parseInt(s, 10);
  if (isNaN(n)) return null;
  // 2-digit year
  if (n >= 0 && n <= 99) return n < 50 ? 2000 + n : 1900 + n;
  if (n >= 1990 && n <= 2100) return n;
  return null;
}

function extractPeriod(text: string): { month: number | null; year: number | null } {
  // 1) "MENS DD MON YY a DD MON YY" — payroll software period line
  const mensPattern = /MENS\s+\d{1,2}\s+(\w{3,})\s+(\d{2,4})\s+a\s+\d{1,2}\s+(\w{3,})\s+(\d{2,4})/i;
  const mensMatch = text.match(mensPattern);
  if (mensMatch) {
    const month = resolveMonth(mensMatch[3]) ?? resolveMonth(mensMatch[1]);
    const year = resolveYear(mensMatch[4]) ?? resolveYear(mensMatch[2]);
    if (month && year) return { month, year };
  }

  // 2) "P.EXTRA:... DD MON YYYY" — extra pay
  const pextraPattern = /P\.?\s*EXTRA[^\n]*?(\d{1,2})\s+(\w{3,})\s+(\d{2,4})/i;
  const pextraMatch = text.match(pextraPattern);
  if (pextraMatch) {
    const month = resolveMonth(pextraMatch[2]);
    const year = resolveYear(pextraMatch[3]);
    if (month && year) return { month, year };
  }

  // 3) "FECHA ... D MONTH YYYY" — receipt date line
  const fechaPattern = /FECHA[\s\S]{0,100}?(\d{1,2})\s+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+(\d{4})/i;
  const fechaMatch = text.match(fechaPattern);
  if (fechaMatch) {
    const month = resolveMonth(fechaMatch[2]);
    const year = resolveYear(fechaMatch[3]);
    if (month && year) return { month, year };
  }

  // 4) "Periodo de liquidación: MONTH YYYY" or "Periodo: MM-YYYY"
  const periodoPattern = /per[ií]odo(?:\s*de\s*liquidaci[oó]n)?[:\s]+(\w+)[\s\-\/]+(\d{2,4})/i;
  const periodoMatch = text.match(periodoPattern);
  if (periodoMatch) {
    const month = resolveMonth(periodoMatch[1]) ?? (parseInt(periodoMatch[1]) >= 1 && parseInt(periodoMatch[1]) <= 12 ? parseInt(periodoMatch[1]) : null);
    const year = resolveYear(periodoMatch[2]);
    if (month && year) return { month, year };
  }

  // 5) Generic "MonthName YYYY" or "MonthName de YYYY"
  const genericPattern = /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?(\d{4})\b/i;
  const genericMatch = text.match(genericPattern);
  if (genericMatch) {
    const month = resolveMonth(genericMatch[1]);
    const year = resolveYear(genericMatch[2]);
    if (month && year) return { month, year };
  }

  // 6) Numeric patterns: DD/MM/YYYY, MM-YYYY, MM/YYYY
  const numericPatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,  // DD/MM/YYYY
    /(\d{1,2})[\/\-](\d{4})/,                   // MM/YYYY or MM-YYYY
  ];
  for (const pat of numericPatterns) {
    const m = text.match(pat);
    if (m) {
      if (m[3]) {
        // DD/MM/YYYY
        const month = parseInt(m[2]);
        const year = parseInt(m[3]);
        if (month >= 1 && month <= 12 && year >= 1990 && year <= 2100) return { month, year };
      } else {
        // MM/YYYY
        const month = parseInt(m[1]);
        const year = parseInt(m[2]);
        if (month >= 1 && month <= 12 && year >= 1990 && year <= 2100) return { month, year };
      }
    }
  }

  return { month: null, year: null };
}

// ─── Company extraction ─────────────────────────────────────────

function extractCompany(text: string): string | null {
  // Pattern 1: Line after "NIF." containing company name (common payroll software)
  const nifBlock = /NIF\.?\s*[A-Z]?\d{7,8}[A-Z]?[\s\S]{0,200}?\n\s*([A-Z][A-Z0-9\s,\.]{2,60}(?:SL|SA|SLU|SAU|SLL|COOP|SCL))\b/i;
  const nifMatch = text.match(nifBlock);
  if (nifMatch) return nifMatch[1].trim();

  // Pattern 2: Explicit "Empresa:" / "Razón Social:" label
  const labelPatterns = [
    /(?:empresa|raz[oó]n\s*social|denominaci[oó]n)[:\s]+([^\n]{3,80})/i,
  ];
  for (const pat of labelPatterns) {
    const m = text.match(pat);
    if (m) {
      const company = m[1].trim().split(/\s{3,}/)[0].trim();
      if (company.length > 2 && company.length < 100) return company;
    }
  }

  // Pattern 3: Look for "SL", "SA" etc. on a line by itself or with a name
  const slPattern = /^\s{2,}([A-Z][A-Z0-9\s,\.]{2,60}(?:SL|SA|SLU|SAU|SLL)\b)/m;
  const slMatch = text.match(slPattern);
  if (slMatch) return slMatch[1].trim();

  return null;
}

// ─── Concept line detection ─────────────────────────────────────

/**
 * Detect if a line is a payslip concept line.
 * Spanish payroll lines typically look like:
 *   [days]  [price]  code  [*]name  amount
 * Code is a numeric 1-3 digit number. Names often start with *.
 */
function isConceptLine(line: string): boolean {
  // Must contain at least one amount
  if (!/\d{1,3}(?:\.\d{3})*,\d{2}/.test(line)) return false;
  // Must have a concept code (1-3 digit number) followed by text
  if (/\d{1,3}\s+\*?\s*[A-Za-zÀ-ÿ]/.test(line)) return true;
  // Or starts with spaces + code
  if (/^\s+\d{1,3}\s+/.test(line)) return true;
  return false;
}

// ─── Main parser ────────────────────────────────────────────────

export function matchConcepts(rawText: string): ParsedPayslip {
  // Step 1: Rejoin numbers split across line breaks
  const text = rejoinSplitNumbers(rawText.replace(/\r\n/g, "\n"));
  const lines = text.split("\n");

  const concepts: ParsedConcept[] = [];
  let grossSalary: number | null = null;
  let netSalary: number | null = null;
  let totalDeductions: number | null = null;
  let inConceptsSection = false;

  // Detect concepts section by looking for the header
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect start of concepts section
    if (/CONCEPTO\s*DEVENGOS\s*DEDUCCIONES/i.test(trimmed)) {
      inConceptsSection = true;
      continue;
    }

    // Detect end of concepts section (totals row)
    if (/T\.\s*DEVENGADO/i.test(trimmed) || /BASE\s*S\.?\s*S\.?/i.test(trimmed)) {
      inConceptsSection = false;
    }

    // ─── Parse concept lines ──────────────────────────────────
    if (inConceptsSection && /\d{1,3}(?:\.\d{3})*,\d{2}/.test(trimmed)) {
      const amounts = findAllAmounts(trimmed);
      const lastAmount = amounts.length > 0 ? amounts[amounts.length - 1] : null;

      if (lastAmount !== null && lastAmount > 0) {
        // Extract concept code (1-3 digit number before the concept name)
        const codeMatch = trimmed.match(/\b(\d{1,3})\s+[\*A-Za-zÀ-ÿ]/);
        const code = codeMatch ? parseInt(codeMatch[1]) : -1;

        // Try to match a friendly name from NAME_PATTERNS
        let conceptName: string | null = null;
        for (const { regex, name } of NAME_PATTERNS) {
          if (regex.test(trimmed)) {
            conceptName = name;
            break;
          }
        }

        // Fallback: extract raw concept name from line
        if (!conceptName) {
          const nameMatch = trimmed.match(/\d\s+\*?\s*([A-Za-zÀ-ÿ][\wÀ-ÿ\s\.\-()]{2,45})/);
          conceptName = nameMatch
            ? nameMatch[1].replace(/\s+/g, " ").replace(/\s*\d+[,\.]\d+\s*$/, "").trim()
            : `Concepto ${code}`;
        }

        // Determine category: 700+ = deduccion, except known devengo names
        const DEVENGO_NAMES = ["Paga Extra", "Gratificación", "Bonus/Prima"];
        let category: "devengo" | "deduccion";
        if (DEVENGO_NAMES.includes(conceptName)) {
          category = "devengo";
        } else {
          category = code >= 700 ? "deduccion" : "devengo";
        }

        if (!concepts.some((c) => c.name === conceptName && c.amount === lastAmount)) {
          concepts.push({ category, name: conceptName, amount: lastAmount, isPercentage: false });
        }
      }
    }

    // ─── Extract totals ──────────────────────────────────────
    // "LIQUIDO A PERCIBIR" — net salary (most reliable, extract first)
    if (/L[IÍ]QUIDO\s*A\s*PERCIBIR/i.test(trimmed)) {
      const searchBlock = lines.slice(i, Math.min(i + 3, lines.length)).join(" ");
      const blockAmounts = findAllAmounts(searchBlock);
      if (blockAmounts.length > 0) {
        netSalary = blockAmounts[0];
      }
    }

    // "T. DEVENGADO" / "T. A DEDUCIR" row — summary totals
    if (/T\.\s*DEVENGADO/i.test(trimmed) || /T\.\s*A\s*DEDUCIR/i.test(trimmed)) {
      const searchBlock = lines.slice(i, Math.min(i + 3, lines.length)).join(" ");
      const blockAmounts = findAllAmounts(searchBlock);
      if (blockAmounts.length > 0) {
        // T. A DEDUCIR is always the last value in this row
        totalDeductions = blockAmounts[blockAmounts.length - 1];

        // T. DEVENGADO: verify using net + deductions = gross
        // Try each amount to find the one that satisfies: amount - totalDeductions ≈ netSalary
        if (netSalary !== null && totalDeductions !== null) {
          for (const amt of blockAmounts) {
            if (Math.abs(amt - totalDeductions - netSalary) < 1) {
              grossSalary = amt;
              break;
            }
          }
        }

        // Fallback: second-to-last amount is likely T. DEVENGADO
        if (grossSalary === null && blockAmounts.length >= 2) {
          grossSalary = blockAmounts[blockAmounts.length - 2];
        }
      }
    }

    // Alternative net patterns
    if (!netSalary && /(?:neto\s*a\s*percibir|total\s*neto|importe\s*l[ií]quido)/i.test(trimmed)) {
      const amt = extractLastAmount(trimmed);
      if (amt !== null) netSalary = amt;
    }

    // Alternative gross patterns
    if (!grossSalary && /total\s*(?:devengado|devengos|percepciones|haberes|bruto)/i.test(trimmed)) {
      const amt = extractLastAmount(trimmed);
      if (amt !== null) grossSalary = amt;
    }

    // "T. A DEDUCIR"
    if (!totalDeductions && /T\.\s*A\s*DEDUCIR/i.test(trimmed)) {
      const searchBlock = lines.slice(i, Math.min(i + 3, lines.length)).join(" ");
      const blockAmounts = findAllAmounts(searchBlock);
      if (blockAmounts.length > 0) {
        totalDeductions = blockAmounts[blockAmounts.length - 1];
      }
    }
  }

  const period = extractPeriod(text);
  const company = extractCompany(text);

  // ─── Fallbacks ──────────────────────────────────────────────

  // If we found gross from the totals row, use it.
  // If not, compute from concepts.
  if (grossSalary === null && concepts.length > 0) {
    const devengos = concepts.filter((c) => c.category === "devengo");
    if (devengos.length > 0) {
      grossSalary = Math.round(devengos.reduce((s, c) => s + c.amount, 0) * 100) / 100;
    }
  }

  // Net = check LIQUIDO first, then gross - deductions
  if (netSalary === null && grossSalary !== null && totalDeductions !== null) {
    netSalary = Math.round((grossSalary - totalDeductions) * 100) / 100;
  }
  if (netSalary === null && grossSalary !== null && concepts.length > 0) {
    const deducciones = concepts.filter((c) => c.category === "deduccion");
    if (deducciones.length > 0) {
      netSalary = Math.round((grossSalary - deducciones.reduce((s, c) => s + c.amount, 0)) * 100) / 100;
    } else {
      netSalary = grossSalary;
    }
  }

  return {
    periodMonth: period.month,
    periodYear: period.year,
    company,
    grossSalary,
    netSalary,
    concepts,
    rawText,
  };
}

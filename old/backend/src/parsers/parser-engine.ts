import { extractTextFromPdf } from "./pdf-text-extractor.js";
import { extractTextWithOcr } from "./ocr-extractor.js";
import { matchConcepts, type ParsedPayslip } from "./concept-matcher.js";
import { logger } from "../logger.js";

const MIN_TEXT_LENGTH = 50; // Minimum characters to consider text extraction successful
const MIN_CONCEPTS_FOR_CONFIDENT_PARSE = 3;
const MIN_LINES_FOR_TOKENIZED_TEXT = 40;
const MAX_AVERAGE_LINE_LENGTH_FOR_TOKENIZED_TEXT = 16;

function getNonEmptyLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getAverageLineLength(rawText: string): number {
  const nonEmptyLines = getNonEmptyLines(rawText);
  if (nonEmptyLines.length === 0) {
    return 0;
  }

  return nonEmptyLines.reduce((sum, line) => sum + line.length, 0) / nonEmptyLines.length;
}

export function scoreParsedPayslip(parsed: ParsedPayslip): number {
  let score = 0;

  if (parsed.periodMonth !== null) score += 3;
  if (parsed.periodYear !== null) score += 3;
  if (parsed.company) score += 1;
  if (parsed.grossSalary !== null && parsed.grossSalary > 0) score += 4;
  if (parsed.netSalary !== null && parsed.netSalary > 0) score += 4;
  if (
    parsed.grossSalary !== null
    && parsed.netSalary !== null
    && parsed.grossSalary >= parsed.netSalary
  ) {
    score += 3;
  }

  const devengos = parsed.concepts.filter((concept) => concept.category === "devengo").length;
  const deducciones = parsed.concepts.filter((concept) => concept.category === "deduccion").length;

  score += Math.min(parsed.concepts.length, 20);
  if (devengos > 0) score += 2;
  if (deducciones > 0) score += 2;

  return score;
}

export function shouldRetryWithOcr(rawText: string, parsed: ParsedPayslip): boolean {
  const normalizedText = rawText.trim();
  if (normalizedText.length < MIN_TEXT_LENGTH) {
    return true;
  }

  if (parsed.periodMonth === null || parsed.periodYear === null) {
    return true;
  }

  if (parsed.grossSalary === null || parsed.grossSalary <= 0) {
    return true;
  }

  if (parsed.netSalary === null || parsed.netSalary <= 0) {
    return true;
  }

  if (parsed.grossSalary < parsed.netSalary) {
    return true;
  }

  if (parsed.concepts.length < MIN_CONCEPTS_FOR_CONFIDENT_PARSE) {
    return true;
  }

  const nonEmptyLines = getNonEmptyLines(normalizedText);
  if (
    nonEmptyLines.length >= MIN_LINES_FOR_TOKENIZED_TEXT
    && getAverageLineLength(normalizedText) <= MAX_AVERAGE_LINE_LENGTH_FOR_TOKENIZED_TEXT
  ) {
    return true;
  }

  return false;
}

export async function parsePayslip(filePath: string): Promise<ParsedPayslip> {
  // Step 1: Try text extraction first (for digital PDFs)
  let rawText = "";
  try {
    rawText = await extractTextFromPdf(filePath);
  } catch {
    // Text extraction failed, will try OCR
  }

  let bestParsed = matchConcepts(rawText);
  let bestScore = scoreParsedPayslip(bestParsed);

  // Step 2: If text extraction is too short or looks low-confidence, try OCR
  if (shouldRetryWithOcr(rawText, bestParsed)) {
    try {
      const ocrText = await extractTextWithOcr(filePath);
      if (ocrText.trim().length > 0) {
        const ocrParsed = matchConcepts(ocrText);
        const ocrScore = scoreParsedPayslip(ocrParsed);

        if (ocrScore >= bestScore) {
          rawText = ocrText;
          bestParsed = ocrParsed;
          bestScore = ocrScore;
        }
      }
    } catch (err) {
      logger.warn({ err }, "OCR extraction failed");
      // Continue with whatever text we have
    }
  }

  // Step 3: Return the best parsed result available
  return bestParsed;
}

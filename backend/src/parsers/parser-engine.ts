import { extractTextFromPdf } from "./pdf-text-extractor.js";
import { extractTextWithOcr } from "./ocr-extractor.js";
import { matchConcepts, type ParsedPayslip } from "./concept-matcher.js";

const MIN_TEXT_LENGTH = 50; // Minimum characters to consider text extraction successful

export async function parsePayslip(filePath: string): Promise<ParsedPayslip> {
  // Step 1: Try text extraction first (for digital PDFs)
  let rawText = "";
  try {
    rawText = await extractTextFromPdf(filePath);
  } catch {
    // Text extraction failed, will try OCR
  }

  // Step 2: If text extraction returned very little, try OCR
  if (rawText.trim().length < MIN_TEXT_LENGTH) {
    try {
      const ocrText = await extractTextWithOcr(filePath);
      if (ocrText.trim().length > rawText.trim().length) {
        rawText = ocrText;
      }
    } catch (err) {
      console.warn("OCR extraction failed:", err);
      // Continue with whatever text we have
    }
  }

  // Step 3: Match concepts from the extracted text
  return matchConcepts(rawText);
}

import { extractTextFromPdfBuffer } from "./pdf-text-extractor.js";
import { matchConcepts, type ParsedPayslip } from "./concept-matcher.js";

export async function parsePayslip(data: Uint8Array): Promise<ParsedPayslip> {
  const rawText = await extractTextFromPdfBuffer(data);
  return matchConcepts(rawText);
}

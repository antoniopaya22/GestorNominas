import { readFileSync } from "fs";
import pdfParse from "pdf-parse";

export async function extractTextFromPdf(filePath: string): Promise<string> {
  const buffer = readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

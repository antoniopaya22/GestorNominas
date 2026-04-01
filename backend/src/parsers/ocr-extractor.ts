import Tesseract from "tesseract.js";
import { createCanvas, type Canvas, type CanvasRenderingContext2D as NodeCanvasCtx } from "canvas";
import { readFileSync } from "fs";
import { createRequire } from "module";
import { logger } from "../logger.js";

// pdfjs-dist v3 legacy build is CJS
const require = createRequire(import.meta.url);
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js") as typeof import("pdfjs-dist");

const OCR_TIMEOUT_MS = 120_000;
const PDF_SCALE = 2; // render at 2x for better OCR quality

/**
 * NodeCanvasFactory so pdfjs-dist can create canvases and handle images
 * in a Node.js environment using the `canvas` npm package.
 */
class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }
  reset(canvasAndContext: { canvas: Canvas; context: NodeCanvasCtx }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext: { canvas: Canvas; context: NodeCanvasCtx }) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

/**
 * Use pdfjs-dist to render each page of a PDF to a node-canvas,
 * then return PNG buffers suitable for Tesseract OCR.
 */
async function renderPdfPagesToImages(filePath: string): Promise<Buffer[]> {
  const data = new Uint8Array(readFileSync(filePath));
  const canvasFactory = new NodeCanvasFactory();

  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    canvasFactory: canvasFactory as unknown as Record<string, unknown>,
  } as never).promise;

  const images: Buffer[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: PDF_SCALE });

    const { canvas, context } = canvasFactory.create(viewport.width, viewport.height);

    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    images.push(canvas.toBuffer("image/png"));
    page.cleanup();
  }

  await doc.destroy();
  return images;
}

export async function extractTextWithOcr(filePath: string): Promise<string> {
  let buffers: Buffer[];

  if (filePath.toLowerCase().endsWith(".pdf")) {
    try {
      buffers = await renderPdfPagesToImages(filePath);
    } catch (err) {
      logger.warn({ err }, "Failed to render PDF pages for OCR");
      return "";
    }
    if (buffers.length === 0) return "";
  } else {
    // For image files, read directly
    buffers = [readFileSync(filePath)];
  }

  const pageTexts: string[] = [];

  for (const buf of buffers) {
    const result = await Promise.race([
      Tesseract.recognize(buf, "spa"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("OCR timeout")), OCR_TIMEOUT_MS)
      ),
    ]);
    pageTexts.push(result.data.text);
  }

  return pageTexts.join("\n");
}

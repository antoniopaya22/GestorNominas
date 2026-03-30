import Tesseract from "tesseract.js";

export async function extractTextWithOcr(imagePath: string): Promise<string> {
  const {
    data: { text },
  } = await Tesseract.recognize(imagePath, "spa", {
    logger: (info) => {
      if (info.status === "recognizing text") {
        // Progress is available in info.progress (0-1)
      }
    },
  });
  return text;
}

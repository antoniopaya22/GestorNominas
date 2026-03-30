import multer from "multer";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { readFileSync, unlinkSync } from "fs";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsDir = resolve(__dirname, "../../", env.UPLOAD_DIR);

// PDF magic bytes: %PDF
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = file.originalname.split(".").pop()?.toLowerCase();
    cb(null, `${randomUUID()}.${ext}`);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten archivos PDF"));
  }
};

const multerUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Post-upload validation: check actual file magic bytes
export function validatePdfMagicBytes(req: Request, _res: Response, next: NextFunction) {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) return next();

  for (const file of files) {
    try {
      const buffer = readFileSync(file.path);
      const header = buffer.subarray(0, 4);
      if (!header.equals(PDF_MAGIC)) {
        // Remove the invalid file
        try { unlinkSync(file.path); } catch {}
        return next(new Error("El archivo no es un PDF válido"));
      }
    } catch {
      return next(new Error("Error al validar el archivo"));
    }
  }
  next();
}

export const upload = multerUpload;

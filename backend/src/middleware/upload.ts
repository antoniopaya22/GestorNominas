import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "./error-handler.js";

// PDF magic bytes: %PDF
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]);

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new AppError(400, "Solo se permiten archivos PDF"));
  }
};

const multerUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// busboy (el parser multipart que usa multer) decodifica el campo filename
// como latin1 por defecto, aunque el navegador mande UTF-8 — los nombres con
// tildes/ñ llegan con mojibake ("NÃ³mina") si no se revierte aquí.
export function fixFilenameEncoding(req: Request, _res: Response, next: NextFunction) {
  const files = req.files as Express.Multer.File[] | undefined;
  for (const file of files ?? []) {
    file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
  }
  next();
}

// Post-upload validation: check actual file magic bytes
export function validatePdfMagicBytes(req: Request, _res: Response, next: NextFunction) {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) return next();

  for (const file of files) {
    const header = file.buffer.subarray(0, 4);
    if (!header.equals(PDF_MAGIC)) {
      return next(new AppError(400, "El archivo no es un PDF válido"));
    }
  }
  next();
}

export const upload = multerUpload;

// ─── CSV Upload (for YNAB import) ───────────────────────────────
// Por extensión: el navegador no manda un MIME fiable para .tsv (el export
// "Register" de YNAB), a menudo vacío o application/octet-stream.
const CSV_EXTENSIONS = [".csv", ".tsv", ".txt"];

const csvFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const name = file.originalname.toLowerCase();
  const allowed =
    CSV_EXTENSIONS.some((ext) => name.endsWith(ext)) ||
    file.mimetype === "text/csv" ||
    file.mimetype === "text/tab-separated-values";
  if (allowed) {
    cb(null, true);
  } else {
    cb(new AppError(400, "Solo se permiten archivos CSV o TSV exportados desde YNAB"));
  }
};

export const uploadCsv = multer({
  storage: multer.memoryStorage(),
  fileFilter: csvFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

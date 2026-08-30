import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, ArrowRight,
  AlertTriangle, Eye,
} from "lucide-react";
import { importYnab, type ImportResult } from "../lib/api";
import { useToast } from "./Toast";

export function ImportView() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewMut = useMutation({
    mutationFn: (f: File) => importYnab(f, true),
    onSuccess: (data) => {
      setPreview(data);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setPreview(null);
    },
  });

  const importMut = useMutation({
    mutationFn: (f: File) => importYnab(f, false),
    onSuccess: (data) => {
      setResult(data);
      setPreview(null);
      setFile(null);
      toast.success("Importación completada correctamente");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (err: Error) => {
      setError(err.message);
      toast.error("Error al importar datos");
    },
  });

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      setFile(accepted[0]);
      setResult(null);
      setPreview(null);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "text/tab-separated-values": [".tsv"],
    },
    multiple: false,
  });

  const handlePreview = () => {
    if (!file) return;
    setError(null);
    previewMut.mutate(file);
  };

  const handleImport = () => {
    if (!file) return;
    setError(null);
    importMut.mutate(file);
  };

  return (
    <div className="max-w-2xl animate-fade-in space-y-6">
      {/* Hero */}
      <div className="card p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-400" />
        <div className="px-6 py-5 sm:px-8 sm:py-6">
          <p className="text-surface-400 text-xs uppercase tracking-wider mb-0.5">Importar datos</p>
          <p className="text-base font-semibold text-surface-900">Importa transacciones desde un archivo CSV de YNAB</p>
        </div>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        aria-label="Zona de carga de archivos CSV"
        className={`card p-8 border-2 border-dashed text-center cursor-pointer transition-all ${
          isDragActive
            ? "border-primary-400 bg-primary-50/50"
            : "border-surface-200 hover:border-primary-300 hover:bg-surface-50"
        }`}
      >
        <input {...getInputProps()} />
        <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
          <FileSpreadsheet className="w-7 h-7 text-primary-600" aria-hidden="true" />
        </div>
        {file ? (
          <>
            <p className="font-semibold text-surface-900 mb-1">{file.name}</p>
            <p className="text-sm text-surface-500 font-mono">{(file.size / 1024).toFixed(0)} KB</p>
          </>
        ) : (
          <>
            <p className="font-semibold text-surface-900 mb-1">
              {isDragActive ? "Suelta el archivo aquí" : "Arrastra tu archivo CSV de YNAB"}
            </p>
            <p className="text-sm text-surface-500">o haz clic para seleccionar (.csv, .tsv)</p>
          </>
        )}
      </div>

      {/* Action buttons */}
      {file && !result && (
        <div className="flex justify-end gap-3">
          {!preview && (
            <button
              onClick={handlePreview}
              disabled={previewMut.isPending}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {previewMut.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Vista previa
                </>
              )}
            </button>
          )}
          <button
            onClick={handleImport}
            disabled={importMut.isPending}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {importMut.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Importar
              </>
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card p-4 bg-danger-50 border-danger-200 flex items-start gap-3" role="alert">
          <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold text-danger-800 text-sm">Error al importar</p>
            <p className="text-sm text-danger-700">{error}</p>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="card p-6 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3 mb-4">
            <Eye className="w-6 h-6 text-blue-600" aria-hidden="true" />
            <h3 className="font-semibold text-blue-800">Vista previa de importación</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-blue-600 uppercase font-semibold">Cuentas</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-blue-800">{preview.summary.accounts}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 uppercase font-semibold">Categorías</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-blue-800">
                {preview.summary.categoryGroups + preview.summary.categories}
              </p>
            </div>
            <div>
              <p className="text-xs text-blue-600 uppercase font-semibold">Transacciones</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-blue-800">{preview.summary.transactions}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 uppercase font-semibold">Periodo</p>
              <p className="text-sm font-bold text-blue-800">
                {preview.summary.dateRange.from} — {preview.summary.dateRange.to}
              </p>
            </div>
          </div>

          {(preview.summary.duplicates ?? 0) > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Se detectaron <strong>{preview.summary.duplicates}</strong> posibles duplicados
                (transacciones con misma fecha, importe, cuenta y beneficiario ya existentes).
                Se importarán igualmente.
              </p>
            </div>
          )}

          <p className="text-sm text-blue-700">
            Haz clic en &laquo;Importar&raquo; para confirmar la importación.
          </p>
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="card p-6 bg-success-50 border-success-200">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="w-6 h-6 text-success-600" aria-hidden="true" />
            <h3 className="font-semibold text-success-800">Importación completada</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-xs text-success-600 uppercase font-semibold">Cuentas</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-success-800">{result.summary.accounts}</p>
            </div>
            <div>
              <p className="text-xs text-success-600 uppercase font-semibold">Categorías</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-success-800">
                {result.summary.categoryGroups + result.summary.categories}
              </p>
            </div>
            <div>
              <p className="text-xs text-success-600 uppercase font-semibold">Transacciones</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-success-800">{result.summary.transactions}</p>
            </div>
            <div>
              <p className="text-xs text-success-600 uppercase font-semibold">Periodo</p>
              <p className="text-sm font-bold text-success-800">
                {result.summary.dateRange.from} — {result.summary.dateRange.to}
              </p>
            </div>
          </div>

          {(result.summary.duplicates ?? 0) > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Se importaron <strong>{result.summary.duplicates}</strong> transacciones
                que podrían ser duplicadas.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <a href="/transactions" className="btn-primary text-sm flex items-center gap-1.5">
              Ver transacciones <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <a href="/accounts" className="btn-secondary text-sm">
              Ver cuentas
            </a>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="card p-5">
        <h3 className="font-semibold text-surface-900 text-sm mb-3">¿Cómo exportar desde YNAB?</h3>
        <ol className="space-y-2 text-sm text-surface-600">
          <li className="flex gap-2">
            <span className="font-bold text-primary-600">1.</span>
            En YNAB, haz clic en tu nombre de usuario (arriba a la izquierda) y elige &laquo;Export Plan&raquo;
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-primary-600">2.</span>
            YNAB descarga un .zip con <strong>dos ficheros .tsv</strong>: uno terminado en &laquo;Plan&raquo; y otro en &laquo;Register&raquo;
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-primary-600">3.</span>
            Descomprime el .zip y sube <strong>únicamente el fichero &laquo;Register&raquo;</strong> aquí (ver diferencia abajo)
          </li>
        </ol>
      </div>

      {/* Which file to upload */}
      <div className="card p-5">
        <h3 className="font-semibold text-surface-900 text-sm mb-3">¿Qué fichero subo? Plan vs Register</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-success-50 border border-success-200">
            <CheckCircle2 className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-success-800">
                &laquo;... - Register.tsv&raquo; &mdash; sube este
              </p>
              <p className="text-sm text-success-700 mt-0.5">
                El histórico de movimientos: cuenta, fecha, beneficiario, categoría, importe y si está
                conciliado. Es lo que esta app necesita para crear tus cuentas, categorías y transacciones.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-200">
            <AlertCircle className="w-5 h-5 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-surface-700">
                &laquo;... - Plan.tsv&raquo; &mdash; no se usa
              </p>
              <p className="text-sm text-surface-600 mt-0.5">
                El presupuesto mensual por categoría (cuánto asignaste, cuánto gastaste y cuánto queda
                disponible cada mes). Esta app no importa presupuestos, solo transacciones reales, así
                que este fichero se puede ignorar.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


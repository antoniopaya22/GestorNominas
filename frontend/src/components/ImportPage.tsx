import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, ArrowRight,
  AlertTriangle, Eye,
} from "lucide-react";
import { importYnab, type ImportResult } from "../lib/api";
import { Providers } from "./Providers";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

function ImportView() {
  const queryClient = useQueryClient();
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
      <Card className="p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-400" />
        <div className="px-6 py-5 sm:px-8 sm:py-6">
          <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Importar datos</p>
          <p className="text-base font-semibold text-foreground">Importa transacciones desde un archivo CSV de YNAB</p>
        </div>
      </Card>

      {/* Dropzone */}
      <Card
        {...getRootProps()}
        aria-label="Zona de carga de archivos CSV"
        className={cn(
          "p-8 border-2 border-dashed text-center cursor-pointer transition-all",
          isDragActive
            ? "border-primary-400 bg-primary-50/50 dark:bg-primary-500/10"
            : "border-border hover:border-primary-300 hover:bg-muted"
        )}
      >
        <input {...getInputProps()} />
        <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center mx-auto mb-4">
          <FileSpreadsheet className="w-7 h-7 text-primary-600 dark:text-primary-400" aria-hidden="true" />
        </div>
        {file ? (
          <>
            <p className="font-semibold text-foreground mb-1">{file.name}</p>
            <p className="text-sm text-muted-foreground font-mono">{(file.size / 1024).toFixed(0)} KB</p>
          </>
        ) : (
          <>
            <p className="font-semibold text-foreground mb-1">
              {isDragActive ? "Suelta el archivo aquí" : "Arrastra tu archivo CSV de YNAB"}
            </p>
            <p className="text-sm text-muted-foreground">o haz clic para seleccionar (.csv, .tsv)</p>
          </>
        )}
      </Card>

      {/* Action buttons */}
      {file && !result && (
        <div className="flex justify-end gap-3">
          {!preview && (
            <Button onClick={handlePreview} disabled={previewMut.isPending} variant="secondary" className="gap-2">
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
            </Button>
          )}
          <Button onClick={handleImport} disabled={importMut.isPending} className="gap-2">
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
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="p-4 bg-destructive/5 border-destructive/20 flex-row items-start gap-3" role="alert">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold text-destructive text-sm">Error al importar</p>
            <p className="text-sm text-destructive/80">{error}</p>
          </div>
        </Card>
      )}

      {/* Preview */}
      {preview && (
        <Card className="p-6 bg-primary-50/60 border-primary-200 dark:bg-primary-500/10 dark:border-primary-500/20">
          <div className="flex items-center gap-3 mb-4">
            <Eye className="w-6 h-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />
            <h3 className="font-semibold text-primary-800 dark:text-primary-300">Vista previa de importación</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-primary-600 dark:text-primary-400 uppercase font-semibold">Cuentas</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-primary-800 dark:text-primary-300">{preview.summary.accounts}</p>
            </div>
            <div>
              <p className="text-xs text-primary-600 dark:text-primary-400 uppercase font-semibold">Categorías</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-primary-800 dark:text-primary-300">
                {preview.summary.categoryGroups + preview.summary.categories}
              </p>
            </div>
            <div>
              <p className="text-xs text-primary-600 dark:text-primary-400 uppercase font-semibold">Transacciones</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-primary-800 dark:text-primary-300">{preview.summary.transactions}</p>
            </div>
            <div>
              <p className="text-xs text-primary-600 dark:text-primary-400 uppercase font-semibold">Periodo</p>
              <p className="text-sm font-bold text-primary-800 dark:text-primary-300">
                {preview.summary.dateRange.from} — {preview.summary.dateRange.to}
              </p>
            </div>
          </div>

          {(preview.summary.duplicates ?? 0) > 0 && (
            <div className="flex items-start gap-2 p-3 bg-accent-50 dark:bg-accent-500/10 rounded-xl border border-accent-200 dark:border-accent-500/20 mb-4">
              <AlertTriangle className="w-4 h-4 text-accent-600 dark:text-accent-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-accent-800 dark:text-accent-300">
                Se detectaron <strong>{preview.summary.duplicates}</strong> posibles duplicados
                (transacciones con misma fecha, importe, cuenta y beneficiario ya existentes).
                Se importarán igualmente.
              </p>
            </div>
          )}

          <p className="text-sm text-primary-700 dark:text-primary-400">
            Haz clic en &laquo;Importar&raquo; para confirmar la importación.
          </p>
        </Card>
      )}

      {/* Success */}
      {result && (
        <Card className="p-6 bg-success-50 border-success-100 dark:bg-success-500/10 dark:border-success-500/20">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="w-6 h-6 text-success-600" aria-hidden="true" />
            <h3 className="font-semibold text-success-700 dark:text-success-500">Importación completada</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-xs text-success-600 uppercase font-semibold">Cuentas</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-success-700 dark:text-success-500">{result.summary.accounts}</p>
            </div>
            <div>
              <p className="text-xs text-success-600 uppercase font-semibold">Categorías</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-success-700 dark:text-success-500">
                {result.summary.categoryGroups + result.summary.categories}
              </p>
            </div>
            <div>
              <p className="text-xs text-success-600 uppercase font-semibold">Transacciones</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-success-700 dark:text-success-500">{result.summary.transactions}</p>
            </div>
            <div>
              <p className="text-xs text-success-600 uppercase font-semibold">Periodo</p>
              <p className="text-sm font-bold text-success-700 dark:text-success-500">
                {result.summary.dateRange.from} — {result.summary.dateRange.to}
              </p>
            </div>
          </div>

          {(result.summary.duplicates ?? 0) > 0 && (
            <div className="flex items-start gap-2 p-3 bg-accent-50 dark:bg-accent-500/10 rounded-xl border border-accent-200 dark:border-accent-500/20 mb-4">
              <AlertTriangle className="w-4 h-4 text-accent-600 dark:text-accent-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-accent-800 dark:text-accent-300">
                Se importaron <strong>{result.summary.duplicates}</strong> transacciones
                que podrían ser duplicadas.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <a href="/app/transactions" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
              Ver transacciones <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <a href="/app/accounts" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              Ver cuentas
            </a>
          </div>
        </Card>
      )}

      {/* Instructions */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground text-sm mb-3">¿Cómo exportar desde YNAB?</h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="font-bold text-primary-600 dark:text-primary-400">1.</span>
            Abre YNAB y ve a la sección de tu presupuesto
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-primary-600 dark:text-primary-400">2.</span>
            En la cuenta o en &laquo;Todas las cuentas&raquo;, haz clic en exportar
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-primary-600 dark:text-primary-400">3.</span>
            Selecciona formato CSV y descarga el archivo
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-primary-600 dark:text-primary-400">4.</span>
            Sube el archivo aquí para importar tus datos automáticamente
          </li>
        </ol>
      </Card>
    </div>
  );
}

export default function ImportPage() {
  return (
    <Providers>
      <ImportView />
    </Providers>
  );
}

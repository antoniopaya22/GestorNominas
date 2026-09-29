import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import {
  Upload, FileText, X, CheckCircle2, AlertCircle, Loader2, Users, ArrowRight,
} from "lucide-react";
import { getProfiles, uploadPayslips, type Payslip } from "../lib/api";
import { Providers } from "./Providers";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadManager() {
  const queryClient = useQueryClient();
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: getProfiles,
  });

  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [payslipType, setPayslipType] = useState<"ordinal" | "extra">("ordinal");
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<Payslip[]>([]);

  const uploadMut = useMutation({
    mutationFn: (args: { profileId: number; files: File[]; payslipType: "ordinal" | "extra" }) =>
      uploadPayslips(args.profileId, args.files, args.payslipType),
    onSuccess: (data) => {
      setResults(data);
      setFiles([]);
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
    },
  });

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted]);
    setResults([]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
  });

  const handleUpload = () => {
    if (!selectedProfile || files.length === 0) return;
    uploadMut.mutate({ profileId: selectedProfile, files, payslipType });
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  // Auto-select first profile
  useEffect(() => {
    if (!selectedProfile && profiles.length > 0) {
      setSelectedProfile(profiles[0].id);
    }
  }, [profiles, selectedProfile]);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="max-w-2xl animate-fade-in space-y-6">
      {/* Hero */}
      <Card className="p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-accent-500 to-accent-400" />
        <div className="px-6 py-5 sm:px-8 sm:py-6">
          <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Subir Nóminas</p>
          <p className="text-base font-semibold text-foreground">Sube archivos PDF para extraer datos automáticamente</p>
        </div>
      </Card>

      {profiles.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent-50 dark:bg-accent-500/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-accent-600 dark:text-accent-400" aria-hidden="true" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Perfil necesario</h3>
          <p className="text-sm text-muted-foreground mb-5">Antes de subir nóminas, necesitas crear un perfil de empleado.</p>
          <a href="/app/profiles" className={cn(buttonVariants(), "gap-1.5")}>
            Crear perfil
            <ArrowRight className="w-4 h-4" />
          </a>
        </Card>
      ) : (
        <>
          {/* Profile selector */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Perfil</label>
            <div className="flex gap-2 flex-wrap" role="group" aria-label="Seleccionar perfil">
              {profiles.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant={selectedProfile === p.id ? "secondary" : "ghost"}
                  onClick={() => setSelectedProfile(p.id)}
                  aria-pressed={selectedProfile === p.id}
                  className={cn("gap-2", selectedProfile === p.id ? "shadow-sm" : "text-muted-foreground")}
                >
                  <div
                    className={cn("w-3.5 h-3.5 rounded-full transition-opacity", selectedProfile === p.id ? "opacity-100" : "opacity-40")}
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Type selector */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tipo de nómina</label>
            <div className="flex gap-2" role="group" aria-label="Tipo de nómina">
              <Button
                type="button"
                variant={payslipType === "ordinal" ? "secondary" : "ghost"}
                onClick={() => setPayslipType("ordinal")}
                aria-pressed={payslipType === "ordinal"}
                className={payslipType === "ordinal" ? "shadow-sm" : "text-muted-foreground"}
              >
                Mensual
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPayslipType("extra")}
                aria-pressed={payslipType === "extra"}
                className={cn(
                  payslipType === "extra"
                    ? "bg-accent-50 dark:bg-accent-500/10 shadow-sm border border-accent-200 dark:border-accent-500/20 text-accent-700 dark:text-accent-400"
                    : "text-muted-foreground"
                )}
              >
                Paga Extra
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">El tipo se detectará automáticamente si el PDF lo indica</p>
          </div>

          {/* Dropzone */}
          <Card
            {...getRootProps()}
            aria-label="Zona de carga de archivos PDF"
            className={cn(
              "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200",
              isDragActive
                ? "border-primary-400 bg-primary-50/60 dark:bg-primary-500/10 shadow-card-hover"
                : "border-border hover:shadow-card-hover"
            )}
          >
            <input {...getInputProps()} />
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors",
              isDragActive ? "bg-primary-100 dark:bg-primary-500/20" : "bg-muted"
            )}>
              <Upload className={cn("w-7 h-7 transition-colors", isDragActive ? "text-primary-600 dark:text-primary-400" : "text-muted-foreground")} aria-hidden="true" />
            </div>
            {isDragActive ? (
              <p className="text-primary-700 dark:text-primary-400 font-semibold text-sm">Suelta los archivos aquí...</p>
            ) : (
              <>
                <p className="text-foreground font-semibold text-sm">Arrastra tus nóminas PDF aquí</p>
                <p className="text-muted-foreground text-xs mt-1.5">
                  o <span className="text-primary-600 dark:text-primary-400 font-medium">haz clic para seleccionar</span> · Solo PDF · Máx 10 MB
                </p>
              </>
            )}
          </Card>

          {/* Selected files */}
          {files.length > 0 && (
            <div className="mt-6 animate-slide-up">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {files.length} archivo{files.length > 1 ? "s" : ""} seleccionado{files.length > 1 ? "s" : ""}
                </h3>
                <span className="text-xs text-muted-foreground font-mono">{formatFileSize(totalSize)}</span>
              </div>
              <div className="space-y-2">
                {files.map((f, i) => (
                  <Card key={i} className="flex-row items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-destructive" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      aria-label={`Eliminar ${f.name}`}
                      className="hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </Card>
                ))}
              </div>
              <Button
                onClick={handleUpload}
                disabled={uploadMut.isPending}
                className="w-full mt-4 py-3 h-auto gap-2"
              >
                {uploadMut.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Subir {files.length} archivo{files.length > 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <Card className="mt-6 border-success-100 dark:border-success-500/20 bg-success-50/50 dark:bg-success-500/10 p-5 animate-slide-up flex-row items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-success-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-success-700 dark:text-success-500 text-sm">
                  {results.length} nómina{results.length > 1 ? "s" : ""} subida{results.length > 1 ? "s" : ""}
                </h3>
                <p className="text-xs text-success-700/80 dark:text-success-500/80 mt-1">
                  Se están procesando en segundo plano.{" "}
                  <a href="/app/payslips" className="font-semibold underline underline-offset-2">
                    Ver nóminas →
                  </a>
                </p>
              </div>
            </Card>
          )}

          {uploadMut.isError && (
            <Card className="mt-4 border-destructive/20 bg-destructive/5 p-5 animate-slide-up flex-row items-start gap-3" role="alert">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-destructive text-sm">Error al subir</h3>
                <p className="text-xs text-destructive/80 mt-0.5">{uploadMut.error.message}</p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function UploadPage() {
  return (
    <Providers>
      <UploadManager />
    </Providers>
  );
}

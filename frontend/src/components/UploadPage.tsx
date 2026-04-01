import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import {
  Upload, FileText, X, CheckCircle2, AlertCircle, Loader2, Users, ArrowRight,
} from "lucide-react";
import { getProfiles, uploadPayslips, type Payslip } from "../lib/api";
import { Providers } from "./Providers";

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
    <div className="max-w-2xl animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-surface-900">Subir Nóminas</h2>
        <p className="text-sm text-surface-500 mt-0.5">Sube archivos PDF de tus nóminas para extraer datos automáticamente</p>
      </div>

      {profiles.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent-50 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-accent-600" />
          </div>
          <h3 className="font-semibold text-surface-900 mb-1">Perfil necesario</h3>
          <p className="text-sm text-surface-500 mb-5">Antes de subir nóminas, necesitas crear un perfil de empleado.</p>
          <a href="/profiles" className="btn-primary">
            Crear perfil
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      ) : (
        <>
          {/* Profile selector */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Perfil</label>
            <div className="flex gap-2">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProfile(p.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                    selectedProfile === p.id
                      ? "bg-white shadow-card border border-surface-200 text-surface-900"
                      : "text-surface-500 hover:text-surface-700 hover:bg-surface-100"
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full transition-opacity ${
                      selectedProfile === p.id ? "opacity-100" : "opacity-40"
                    }`}
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Type selector */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Tipo de nómina</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPayslipType("ordinal")}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                  payslipType === "ordinal"
                    ? "bg-white shadow-card border border-surface-200 text-surface-900"
                    : "text-surface-500 hover:text-surface-700 hover:bg-surface-100"
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setPayslipType("extra")}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                  payslipType === "extra"
                    ? "bg-accent-50 shadow-card border border-accent-200 text-accent-700"
                    : "text-surface-500 hover:text-surface-700 hover:bg-surface-100"
                }`}
              >
                Paga Extra
              </button>
            </div>
            <p className="text-xs text-surface-400 mt-1.5">El tipo se detectará automáticamente si el PDF lo indica</p>
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`card border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
              isDragActive
                ? "border-primary-400 bg-primary-50/60 shadow-card-hover"
                : "border-surface-200 hover:border-surface-300 hover:shadow-card-hover"
            }`}
          >
            <input {...getInputProps()} />
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors ${
              isDragActive ? "bg-primary-100" : "bg-surface-100"
            }`}>
              <Upload className={`w-7 h-7 transition-colors ${isDragActive ? "text-primary-600" : "text-surface-400"}`} />
            </div>
            {isDragActive ? (
              <p className="text-primary-700 font-semibold text-sm">Suelta los archivos aquí...</p>
            ) : (
              <>
                <p className="text-surface-900 font-semibold text-sm">Arrastra tus nóminas PDF aquí</p>
                <p className="text-surface-400 text-xs mt-1.5">
                  o <span className="text-primary-600 font-medium">haz clic para seleccionar</span> · Solo PDF · Máx 10 MB
                </p>
              </>
            )}
          </div>

          {/* Selected files */}
          {files.length > 0 && (
            <div className="mt-6 animate-slide-up">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                  {files.length} archivo{files.length > 1 ? "s" : ""} seleccionado{files.length > 1 ? "s" : ""}
                </h3>
                <span className="text-xs text-surface-400 font-mono">{formatFileSize(totalSize)}</span>
              </div>
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="card flex items-center gap-3 px-4 py-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-danger-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-danger-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-900 truncate">{f.name}</p>
                      <p className="text-xs text-surface-400">{formatFileSize(f.size)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="w-7 h-7 rounded-lg hover:bg-surface-100 flex items-center justify-center text-surface-400 hover:text-danger-500 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleUpload}
                disabled={uploadMut.isPending}
                className="btn-primary w-full mt-4 justify-center py-3"
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
              </button>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="mt-6 card border-success-200 bg-success-50/50 p-5 animate-slide-up">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-success-800 text-sm">
                    {results.length} nómina{results.length > 1 ? "s" : ""} subida{results.length > 1 ? "s" : ""}
                  </h3>
                  <p className="text-xs text-success-700 mt-1">
                    Se están procesando en segundo plano.{" "}
                    <a href="/payslips" className="font-semibold underline underline-offset-2">
                      Ver nóminas →
                    </a>
                  </p>
                </div>
              </div>
            </div>
          )}

          {uploadMut.isError && (
            <div className="mt-4 card border-danger-200 bg-danger-50/50 p-5 animate-slide-up">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-danger-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-danger-800 text-sm">Error al subir</h3>
                  <p className="text-xs text-danger-700 mt-0.5">{uploadMut.error.message}</p>
                </div>
              </div>
            </div>
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

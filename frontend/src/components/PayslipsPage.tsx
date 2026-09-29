import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Edit3, RefreshCw, Trash2, FileText, Plus, X, Save,
  ChevronDown, Building2, Calendar, ArrowRight, Search, Download,
  ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import {
  getProfiles,
  getPayslips,
  getPayslip,
  deletePayslip,
  reprocessPayslip,
  updatePayslipConcepts,
  updatePayslipType,
  exportData,
  type Payslip,
  type PayslipConcept,
  type PayslipSortField,
} from "../lib/api";
import { Providers } from "./Providers";
import { formatCurrency } from "../lib/format";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: "Procesando", cls: "bg-accent-50 text-accent-700" },
  parsed: { label: "Procesada", cls: "bg-success-50 text-success-700" },
  error: { label: "Error", cls: "bg-danger-50 text-danger-700" },
  review: { label: "Revisar", cls: "bg-accent-50 text-accent-700" },
};

function formatPeriod(m: number | null, y: number | null): string {
  if (!m || !y) return "Sin fecha";
  const names = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${names[m]} ${y}`;
}

function getPayslipSortDirection(field: PayslipSortField): "asc" | "desc" {
  return field === "fileName" || field === "parsingStatus" ? "asc" : "desc";
}

interface SortIndicatorProps {
  active: boolean;
  direction: "asc" | "desc";
}

function SortIndicator({ active, direction }: SortIndicatorProps) {
  if (!active) {
    return <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />;
  }

  return direction === "asc"
    ? <ArrowUp className="w-3.5 h-3.5" />
    : <ArrowDown className="w-3.5 h-3.5" />;
}

function PayslipsList() {
  const queryClient = useQueryClient();
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: getProfiles,
  });

  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<number | null>(null);
  const [yearFilter, setYearFilter] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [sortField, setSortField] = useState<PayslipSortField>("period");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const profileId = selectedProfile ?? profiles[0]?.id;

  const { data: payslipsData, isLoading } = useQuery({
    queryKey: ["payslips", profileId, yearFilter, searchFilter, statusFilter, typeFilter, sortField, sortDir, page],
    queryFn: () =>
      getPayslips({
        profileId,
        year: yearFilter ? Number(yearFilter) : undefined,
        search: searchFilter || undefined,
        status: statusFilter || undefined,
        type: (typeFilter as "ordinal" | "extra") || undefined,
        sortBy: sortField,
        sortDir,
        page,
        limit: 20,
      }),
    enabled: !!profileId,
  });

  const payslips = payslipsData?.data ?? [];
  const totalPayslips = payslipsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalPayslips / 20));

  // Client-side filters for month (status is now server-side)
  const filteredPayslips = payslips
    .filter((p) => {
      if (monthFilter && p.periodMonth !== Number(monthFilter)) return false;
      return true;
    });

  const handleSort = (field: PayslipSortField) => {
    setPage(1);

    if (sortField === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDir(getPayslipSortDirection(field));
  };

  const { data: detail } = useQuery({
    queryKey: ["payslip", selectedPayslip],
    queryFn: () => getPayslip(selectedPayslip!),
    enabled: !!selectedPayslip,
  });

  const deleteMut = useMutation({
    mutationFn: deletePayslip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
      setSelectedPayslip(null);
    },
  });

  const reprocessMut = useMutation({
    mutationFn: reprocessPayslip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
      queryClient.invalidateQueries({ queryKey: ["payslip", selectedPayslip] });
    },
  });

  useEffect(() => {
    if (!selectedProfile && profiles.length > 0 && profiles[0]) {
      setSelectedProfile(profiles[0].id);
    }
  }, [profiles, selectedProfile]);

  const years = Array.from(
    new Set(payslips.map((p) => p.periodYear).filter(Boolean))
  ).sort((a, b) => (b ?? 0) - (a ?? 0));

  if (selectedPayslip && detail) {
    return (
      <PayslipDetail
        payslip={detail}
        onBack={() => setSelectedPayslip(null)}
        onDelete={() => {
          if (confirm("¿Eliminar esta nómina?")) deleteMut.mutate(detail.id);
        }}
        onReprocess={() => reprocessMut.mutate(detail.id)}
        isReprocessing={reprocessMut.isPending}
      />
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Hero */}
      <div className="card p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-accent-500 to-accent-400" />
        <div className="px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Mis Nóminas</p>
              <p className="text-2xl font-bold text-foreground">
                {filteredPayslips.length} nómina{filteredPayslips.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <div className="flex items-center gap-1.5 bg-accent-50 rounded-lg px-3 py-1.5">
                <FileText className="w-3.5 h-3.5 text-accent-600" aria-hidden="true" />
                <span className="text-xs font-bold text-accent-800 font-mono">{totalPayslips}</span>
                <span className="text-xs font-medium text-accent-700">total</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            {profileId && (
              <button
                onClick={() => exportData(profileId, yearFilter ? Number(yearFilter) : undefined, "csv")}
                className="flex items-center gap-1.5 bg-muted hover:bg-muted rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors"
                aria-label="Exportar CSV"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                CSV
              </button>
            )}
            <a href="/app/upload" className="flex items-center gap-1.5 bg-accent-50 hover:bg-accent-100 rounded-lg px-3 py-1.5 text-xs font-medium text-accent-700 transition-colors">
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Subir nóminas
            </a>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1.5" role="group" aria-label="Filtrar por perfil">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedProfile(p.id); setSelectedPayslip(null); setPage(1); }}
              aria-pressed={profileId === p.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                profileId === p.id
                  ? "bg-white shadow-card border border-border text-foreground"
                  : "text-muted-foreground hover:text-muted-foreground hover:bg-muted"
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full transition-opacity ${profileId === p.id ? "opacity-100" : "opacity-40"}`}
                style={{ backgroundColor: p.color }}
              />
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Extended Filters Bar */}
      <div className="card p-3 mb-6 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por archivo o empresa..."
            value={searchFilter}
            onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }}
            className="input text-xs pl-9 py-2"
          />
        </div>

        {years.length > 0 && (
          <div className="relative">
            <select
              value={yearFilter}
              onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
              className="input text-xs pr-8 py-2 appearance-none cursor-pointer w-auto"
            >
              <option value="">Año</option>
              {years.map((y) => (
                <option key={y} value={y ?? ""}>{y}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        )}

        <div className="relative">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="input text-xs pr-8 py-2 appearance-none cursor-pointer w-auto"
          >
            <option value="">Mes</option>
            {["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"].map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input text-xs pr-8 py-2 appearance-none cursor-pointer w-auto"
          >
            <option value="">Estado</option>
            <option value="parsed">Procesada</option>
            <option value="pending">Procesando</option>
            <option value="review">Revisar</option>
            <option value="error">Error</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="input text-xs pr-8 py-2 appearance-none cursor-pointer w-auto"
          >
            <option value="">Tipo</option>
            <option value="ordinal">Mensual</option>
            <option value="extra">Paga Extra</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>

        {(searchFilter || yearFilter || monthFilter || statusFilter || typeFilter) && (
          <button
            onClick={() => { setSearchFilter(""); setYearFilter(""); setMonthFilter(""); setStatusFilter(""); setTypeFilter(""); setPage(1); }}
            className="btn-ghost text-xs py-2 px-3 text-danger-600 hover:bg-danger-50"
          >
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
      </div>

      {/* Summary bar */}
      {filteredPayslips.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Bruto Medio</p>
            <p className="text-sm font-bold font-mono text-foreground mt-0.5">
              {formatCurrency(filteredPayslips.reduce((s, p) => s + (p.grossSalary ?? 0), 0) / filteredPayslips.length)}
            </p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Neto Medio</p>
            <p className="text-sm font-bold font-mono text-success-700 mt-0.5">
              {formatCurrency(filteredPayslips.reduce((s, p) => s + (p.netSalary ?? 0), 0) / filteredPayslips.length)}
            </p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Bruto</p>
            <p className="text-sm font-bold font-mono text-foreground mt-0.5">
              {formatCurrency(filteredPayslips.reduce((s, p) => s + (p.grossSalary ?? 0), 0))}
            </p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Neto</p>
            <p className="text-sm font-bold font-mono text-success-700 mt-0.5">
              {formatCurrency(filteredPayslips.reduce((s, p) => s + (p.netSalary ?? 0), 0))}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="card p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-16" />
            </div>
          ))}
        </div>
      ) : filteredPayslips.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground text-sm mb-1">No hay nóminas</h3>
          <p className="text-muted-foreground text-xs mb-5">Sube nóminas para este perfil.</p>
          <a href="/app/upload" className="btn-primary text-sm">
            Subir nóminas <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th scope="col" aria-sort={sortField === "period" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="text-left px-5 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => handleSort("period")}
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:text-foreground dark:hover:text-surface-200 dark:focus-visible:text-surface-200"
                  >
                    <span>Período</span>
                    <SortIndicator active={sortField === "period"} direction={sortDir} />
                  </button>
                </th>
                <th scope="col" aria-sort={sortField === "fileName" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => handleSort("fileName")}
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:text-foreground dark:hover:text-surface-200 dark:focus-visible:text-surface-200"
                  >
                    <span>Archivo</span>
                    <SortIndicator active={sortField === "fileName"} direction={sortDir} />
                  </button>
                </th>
                <th scope="col" aria-sort={sortField === "grossSalary" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="text-right px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => handleSort("grossSalary")}
                    className="inline-flex w-full items-center justify-end gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:text-foreground dark:hover:text-surface-200 dark:focus-visible:text-surface-200"
                  >
                    <span>Bruto</span>
                    <SortIndicator active={sortField === "grossSalary"} direction={sortDir} />
                  </button>
                </th>
                <th scope="col" aria-sort={sortField === "netSalary" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="text-right px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => handleSort("netSalary")}
                    className="inline-flex w-full items-center justify-end gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:text-foreground dark:hover:text-surface-200 dark:focus-visible:text-surface-200"
                  >
                    <span>Neto</span>
                    <SortIndicator active={sortField === "netSalary"} direction={sortDir} />
                  </button>
                </th>
                <th scope="col" aria-sort={sortField === "parsingStatus" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="text-center px-5 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => handleSort("parsingStatus")}
                    className="inline-flex items-center justify-center gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:text-foreground dark:hover:text-surface-200 dark:focus-visible:text-surface-200"
                  >
                    <span>Estado</span>
                    <SortIndicator active={sortField === "parsingStatus"} direction={sortDir} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPayslips.map((p) => {
                const status = STATUS_MAP[p.parsingStatus] ?? STATUS_MAP.error;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPayslip(p.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedPayslip(p.id); } }}
                    role="button"
                    tabIndex={0}
                    className="border-b border-border hover:bg-muted/80 cursor-pointer transition-colors group focus-visible:outline-2 focus-visible:outline-accent-500"
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-foreground">{formatPeriod(p.periodMonth, p.periodYear)}</span>
                      {p.payslipType === "extra" && (
                        <span className="ml-2 badge bg-accent-50 text-accent-700 text-[10px]">Extra</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-[200px]">{p.fileName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-right font-mono tabular-nums text-foreground">{formatCurrency(p.grossSalary)}</td>
                    <td className="px-4 py-3.5 text-sm text-right font-mono tabular-nums font-semibold text-success-700">{formatCurrency(p.netSalary)}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`badge ${status.cls}`}>{status.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-muted-foreground text-xs">
            {totalPayslips} nómina{totalPayslips !== 1 ? "s" : ""} en total
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-ghost text-xs px-2 py-1 disabled:opacity-30"
            >
              Anterior
            </button>
            <span className="text-xs text-muted-foreground px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-ghost text-xs px-2 py-1 disabled:opacity-30"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Payslip Detail ─────────────────────────────────────────────
function PayslipDetail({
  payslip,
  onBack,
  onDelete,
  onReprocess,
  isReprocessing,
}: {
  payslip: Payslip & { concepts: PayslipConcept[] };
  onBack: () => void;
  onDelete: () => void;
  onReprocess: () => void;
  isReprocessing: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [concepts, setConcepts] = useState(payslip.concepts);
  const [grossSalary, setGrossSalary] = useState(payslip.grossSalary ?? 0);
  const [netSalary, setNetSalary] = useState(payslip.netSalary ?? 0);
  const [periodMonth, setPeriodMonth] = useState(payslip.periodMonth ?? 1);
  const [periodYear, setPeriodYear] = useState(payslip.periodYear ?? new Date().getFullYear());

  const saveMut = useMutation({
    mutationFn: () =>
      updatePayslipConcepts(payslip.id, {
        concepts: concepts.map((c) => ({
          category: c.category,
          name: c.name,
          amount: c.amount,
          isPercentage: c.isPercentage,
        })),
        grossSalary,
        netSalary,
        periodMonth,
        periodYear,
      }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["payslip", payslip.id] });
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
    },
  });

  const typeMut = useMutation({
    mutationFn: (type: "ordinal" | "extra") => updatePayslipType(payslip.id, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payslip", payslip.id] });
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
    },
  });

  const devengos = concepts.filter((c) => c.category === "devengo");
  const deducciones = concepts.filter((c) => c.category === "deduccion");

  const addConcept = (category: "devengo" | "deduccion") => {
    setConcepts([
      ...concepts,
      { id: 0, payslipId: payslip.id, category, name: "", amount: 0, isPercentage: false },
    ]);
  };

  const updateConcept = (index: number, field: string, value: string | number) => {
    const updated = [...concepts];
    (updated[index] as unknown as Record<string, unknown>)[field] = value;
    setConcepts(updated);
  };

  const removeConcept = (index: number) => {
    setConcepts(concepts.filter((_, i) => i !== index));
  };

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-5 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver al listado
      </button>

      {/* Header */}
      <div className="card p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-50 ring-1 ring-primary-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">{payslip.fileName}</h2>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                {payslip.company && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> {payslip.company}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {payslip.periodMonth && payslip.periodYear
                    ? `${payslip.periodMonth}/${payslip.periodYear}`
                    : "Sin fecha"}
                </span>
                <button
                  onClick={() => typeMut.mutate(payslip.payslipType === "extra" ? "ordinal" : "extra")}
                  disabled={typeMut.isPending}
                  className={`badge text-[10px] cursor-pointer transition-colors ${payslip.payslipType === "extra" ? "bg-accent-50 text-accent-700 hover:bg-accent-100" : "bg-muted text-muted-foreground hover:bg-muted"}`}
                  title="Haz clic para cambiar el tipo"
                >
                  {payslip.payslipType === "extra" ? "Paga Extra" : "Mensual"}
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!editing && (
              <button onClick={() => setEditing(true)} className="btn-ghost text-xs cursor-pointer">
                <Edit3 className="w-3.5 h-3.5" /> Editar
              </button>
            )}
            <button
              onClick={onReprocess}
              disabled={isReprocessing}
              className="btn-ghost text-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReprocessing ? "animate-spin" : ""}`} />
              {isReprocessing ? "…" : "Reprocesar"}
            </button>
            <button onClick={onDelete} className="btn-ghost text-xs text-danger-600 hover:bg-danger-50 cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
          </div>
        </div>
      </div>

      {/* Metadata (editable) */}
      {editing && (
        <div className="card p-5 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4 animate-slide-up">
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Mes</label>
            <input type="number" min={1} max={12}
              value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))}
              className="input text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Año</label>
            <input type="number" min={1990} max={2100}
              value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))}
              className="input text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Bruto</label>
            <input type="number" step="0.01"
              value={grossSalary} onChange={(e) => setGrossSalary(Number(e.target.value))}
              className="input text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Neto</label>
            <input type="number" step="0.01"
              value={netSalary} onChange={(e) => setNetSalary(Number(e.target.value))}
              className="input text-sm" />
          </div>
        </div>
      )}

      {/* Concepts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Devengos */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 rounded-full bg-success-500" />
            <h3 className="font-semibold text-foreground text-sm">Devengos</h3>
            <span className="text-[11px] text-muted-foreground ml-auto">{devengos.length}</span>
          </div>
          <div className="space-y-2">
            {devengos.map((c, i) => {
              const realIndex = concepts.indexOf(c);
              return (
                <div key={i} className="flex items-center gap-2">
                  {editing ? (
                    <>
                      <input value={c.name} onChange={(e) => updateConcept(realIndex, "name", e.target.value)}
                        className="input text-xs flex-1" placeholder="Concepto" />
                      <input type="number" step="0.01" value={c.amount}
                        onChange={(e) => updateConcept(realIndex, "amount", Number(e.target.value))}
                        className="input text-xs w-24 text-right font-mono" />
                      <button onClick={() => removeConcept(realIndex)}
                        className="w-6 h-6 rounded hover:bg-danger-50 flex items-center justify-center text-muted-foreground hover:text-danger-500 transition-colors cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground flex-1">{c.name}</span>
                      <span className="text-xs font-mono font-semibold text-foreground">{formatCurrency(c.amount)}</span>
                    </>
                  )}
                </div>
              );
            })}
            {devengos.length === 0 && <p className="text-xs text-muted-foreground">Sin devengos detectados</p>}
            {editing && (
              <button onClick={() => addConcept("devengo")}
                className="flex items-center gap-1 text-xs text-primary-600 font-medium hover:text-primary-700 transition-colors cursor-pointer mt-1">
                <Plus className="w-3 h-3" /> Añadir devengo
              </button>
            )}
          </div>
        </div>

        {/* Deducciones */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 rounded-full bg-danger-500" />
            <h3 className="font-semibold text-foreground text-sm">Deducciones</h3>
            <span className="text-[11px] text-muted-foreground ml-auto">{deducciones.length}</span>
          </div>
          <div className="space-y-2">
            {deducciones.map((c, i) => {
              const realIndex = concepts.indexOf(c);
              return (
                <div key={i} className="flex items-center gap-2">
                  {editing ? (
                    <>
                      <input value={c.name} onChange={(e) => updateConcept(realIndex, "name", e.target.value)}
                        className="input text-xs flex-1" placeholder="Concepto" />
                      <input type="number" step="0.01" value={c.amount}
                        onChange={(e) => updateConcept(realIndex, "amount", Number(e.target.value))}
                        className="input text-xs w-24 text-right font-mono" />
                      <button onClick={() => removeConcept(realIndex)}
                        className="w-6 h-6 rounded hover:bg-danger-50 flex items-center justify-center text-muted-foreground hover:text-danger-500 transition-colors cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground flex-1">{c.name}</span>
                      <span className="text-xs font-mono font-semibold text-danger-600">{formatCurrency(c.amount)}</span>
                    </>
                  )}
                </div>
              );
            })}
            {deducciones.length === 0 && <p className="text-xs text-muted-foreground">Sin deducciones detectadas</p>}
            {editing && (
              <button onClick={() => addConcept("deduccion")}
                className="flex items-center gap-1 text-xs text-primary-600 font-medium hover:text-primary-700 transition-colors cursor-pointer mt-1">
                <Plus className="w-3 h-3" /> Añadir deducción
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Totals */}
      {!editing && (
        <div className="card mt-6 p-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Bruto</p>
            <p className="text-lg font-bold text-foreground font-mono">{formatCurrency(payslip.grossSalary)}</p>
          </div>
          <div className="w-px h-10 bg-muted" />
          <div className="text-right">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Líquido a Percibir</p>
            <p className="text-lg font-bold text-success-700 font-mono">{formatCurrency(payslip.netSalary)}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      {editing && (
        <div className="mt-6 flex gap-3 animate-slide-up">
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="btn-primary text-sm">
            <Save className="w-4 h-4" />
            {saveMut.isPending ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            onClick={() => { setEditing(false); setConcepts(payslip.concepts); }}
            className="btn-secondary text-sm"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

export default function PayslipsPage() {
  return (
    <Providers>
      <PayslipsList />
    </Providers>
  );
}

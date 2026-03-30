import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Edit3, RefreshCw, Trash2, FileText, Plus, X, Save,
  ChevronDown, Building2, Calendar, ArrowRight, Search, Download,
  SortAsc, SortDesc,
} from "lucide-react";
import {
  getProfiles,
  getPayslips,
  getPayslip,
  deletePayslip,
  reprocessPayslip,
  updatePayslipConcepts,
  exportData,
  type Payslip,
  type PayslipConcept,
} from "../lib/api";
import { Providers } from "./Providers";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: "Procesando", cls: "bg-accent-50 text-accent-700" },
  parsed: { label: "Procesada", cls: "bg-success-50 text-success-700" },
  error: { label: "Error", cls: "bg-danger-50 text-danger-700" },
  review: { label: "Revisar", cls: "bg-accent-50 text-accent-700" },
};

function formatCurrency(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR", minimumFractionDigits: 2,
  }).format(n);
}

function formatPeriod(m: number | null, y: number | null): string {
  if (!m || !y) return "Sin fecha";
  const names = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${names[m]} ${y}`;
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
  const [sortField, setSortField] = useState<"period" | "gross" | "net">("period");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const profileId = selectedProfile ?? profiles[0]?.id;

  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ["payslips", profileId, yearFilter, searchFilter],
    queryFn: () =>
      getPayslips(profileId, yearFilter ? Number(yearFilter) : undefined, searchFilter || undefined),
    enabled: !!profileId,
  });

  // Client-side filters for month and status (already fetched)
  const filteredPayslips = payslips
    .filter((p) => {
      if (statusFilter && p.parsingStatus !== statusFilter) return false;
      if (monthFilter && p.periodMonth !== Number(monthFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "gross") return ((a.grossSalary ?? 0) - (b.grossSalary ?? 0)) * dir;
      if (sortField === "net") return ((a.netSalary ?? 0) - (b.netSalary ?? 0)) * dir;
      // period
      const aKey = (a.periodYear ?? 0) * 100 + (a.periodMonth ?? 0);
      const bKey = (b.periodYear ?? 0) * 100 + (b.periodMonth ?? 0);
      return (aKey - bKey) * dir;
    });

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
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-surface-900">Mis Nóminas</h2>
          <p className="text-sm text-surface-500 mt-0.5">
            {filteredPayslips.length} nómina{filteredPayslips.length !== 1 ? "s" : ""} encontrada{filteredPayslips.length !== 1 ? "s" : ""}
            {filteredPayslips.length !== payslips.length && ` (de ${payslips.length})`}
          </p>
        </div>
        <div className="flex gap-2">
          {profileId && (
            <button
              onClick={() => exportData(profileId, yearFilter ? Number(yearFilter) : undefined, "csv")}
              className="btn-secondary text-sm"
              aria-label="Exportar CSV"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
          )}
          <a href="/upload" className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
            Subir nóminas
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedProfile(p.id); setSelectedPayslip(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                profileId === p.id
                  ? "bg-white shadow-card border border-surface-200 text-surface-900"
                  : "text-surface-400 hover:text-surface-600 hover:bg-surface-100"
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
          <input
            type="text"
            placeholder="Buscar por archivo o empresa..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="input text-xs pl-9 py-2"
          />
        </div>

        {years.length > 0 && (
          <div className="relative">
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="input text-xs pr-8 py-2 appearance-none cursor-pointer w-auto"
            >
              <option value="">Año</option>
              {years.map((y) => (
                <option key={y} value={y ?? ""}>{y}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
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
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-xs pr-8 py-2 appearance-none cursor-pointer w-auto"
          >
            <option value="">Estado</option>
            <option value="parsed">Procesada</option>
            <option value="pending">Procesando</option>
            <option value="review">Revisar</option>
            <option value="error">Error</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
        </div>

        <button
          onClick={() => {
            const next = sortField === "period" ? "gross" : sortField === "gross" ? "net" : "period";
            setSortField(next);
          }}
          className="btn-ghost text-xs py-2 px-3"
          title={`Ordenar por: ${sortField === "period" ? "Período" : sortField === "gross" ? "Bruto" : "Neto"}`}
        >
          {sortDir === "desc" ? <SortDesc className="w-3.5 h-3.5" /> : <SortAsc className="w-3.5 h-3.5" />}
          {sortField === "period" ? "Período" : sortField === "gross" ? "Bruto" : "Neto"}
        </button>
        <button
          onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
          className="btn-ghost text-xs py-2 px-2"
          title={sortDir === "asc" ? "Ascendente" : "Descendente"}
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </button>

        {(searchFilter || yearFilter || monthFilter || statusFilter) && (
          <button
            onClick={() => { setSearchFilter(""); setYearFilter(""); setMonthFilter(""); setStatusFilter(""); }}
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
            <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Bruto Medio</p>
            <p className="text-sm font-bold font-mono text-surface-900 mt-0.5">
              {formatCurrency(filteredPayslips.reduce((s, p) => s + (p.grossSalary ?? 0), 0) / filteredPayslips.length)}
            </p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Neto Medio</p>
            <p className="text-sm font-bold font-mono text-success-700 mt-0.5">
              {formatCurrency(filteredPayslips.reduce((s, p) => s + (p.netSalary ?? 0), 0) / filteredPayslips.length)}
            </p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Total Bruto</p>
            <p className="text-sm font-bold font-mono text-surface-900 mt-0.5">
              {formatCurrency(filteredPayslips.reduce((s, p) => s + (p.grossSalary ?? 0), 0))}
            </p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Total Neto</p>
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
          <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-surface-300" />
          </div>
          <h3 className="font-semibold text-surface-900 text-sm mb-1">No hay nóminas</h3>
          <p className="text-surface-500 text-xs mb-5">Sube nóminas para este perfil.</p>
          <a href="/upload" className="btn-primary text-sm">
            Subir nóminas <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100 bg-surface-50/50">
                <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Período</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Archivo</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Bruto</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Neto</th>
                <th className="text-center px-5 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayslips.map((p) => {
                const status = STATUS_MAP[p.parsingStatus] ?? STATUS_MAP.error;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPayslip(p.id)}
                    className="border-b border-surface-50 hover:bg-surface-50/80 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-surface-900">{formatPeriod(p.periodMonth, p.periodYear)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-surface-400" />
                        <span className="text-sm text-surface-600 group-hover:text-surface-900 transition-colors truncate max-w-[200px]">{p.fileName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-right font-mono text-surface-700">{formatCurrency(p.grossSalary)}</td>
                    <td className="px-4 py-3.5 text-sm text-right font-mono font-semibold text-success-700">{formatCurrency(p.netSalary)}</td>
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
        className="flex items-center gap-1.5 text-xs font-medium text-surface-500 hover:text-surface-900 mb-5 transition-colors cursor-pointer"
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
              <h2 className="text-base font-bold text-surface-900">{payslip.fileName}</h2>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-500">
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
            <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Mes</label>
            <input type="number" min={1} max={12}
              value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))}
              className="input text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Año</label>
            <input type="number" min={1990} max={2100}
              value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))}
              className="input text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Bruto</label>
            <input type="number" step="0.01"
              value={grossSalary} onChange={(e) => setGrossSalary(Number(e.target.value))}
              className="input text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Neto</label>
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
            <h3 className="font-semibold text-surface-900 text-sm">Devengos</h3>
            <span className="text-[11px] text-surface-400 ml-auto">{devengos.length}</span>
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
                        className="w-6 h-6 rounded hover:bg-danger-50 flex items-center justify-center text-surface-400 hover:text-danger-500 transition-colors cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-surface-600 flex-1">{c.name}</span>
                      <span className="text-xs font-mono font-semibold text-surface-900">{formatCurrency(c.amount)}</span>
                    </>
                  )}
                </div>
              );
            })}
            {devengos.length === 0 && <p className="text-xs text-surface-400">Sin devengos detectados</p>}
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
            <h3 className="font-semibold text-surface-900 text-sm">Deducciones</h3>
            <span className="text-[11px] text-surface-400 ml-auto">{deducciones.length}</span>
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
                        className="w-6 h-6 rounded hover:bg-danger-50 flex items-center justify-center text-surface-400 hover:text-danger-500 transition-colors cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-surface-600 flex-1">{c.name}</span>
                      <span className="text-xs font-mono font-semibold text-danger-600">{formatCurrency(c.amount)}</span>
                    </>
                  )}
                </div>
              );
            })}
            {deducciones.length === 0 && <p className="text-xs text-surface-400">Sin deducciones detectadas</p>}
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
            <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Total Bruto</p>
            <p className="text-lg font-bold text-surface-900 font-mono">{formatCurrency(payslip.grossSalary)}</p>
          </div>
          <div className="w-px h-10 bg-surface-100" />
          <div className="text-right">
            <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Líquido a Percibir</p>
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

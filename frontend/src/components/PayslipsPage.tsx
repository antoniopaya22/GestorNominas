import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Edit3, RefreshCw, Trash2, FileText, Plus, X, Save,
  Building2, Calendar, ArrowRight, Search, Download,
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
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ConfirmModal } from "./ui/ConfirmModal";
import { cn } from "cn";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: "Procesando", cls: "bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400" },
  parsed: { label: "Procesada", cls: "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500" },
  error: { label: "Error", cls: "bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-400" },
  review: { label: "Revisar", cls: "bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400" },
};

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const TYPE_FILTER_LABELS: Record<string, string> = { ordinal: "Mensual", extra: "Paga Extra" };

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

const ALL = "__all__";

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
  const [deleteTarget, setDeleteTarget] = useState<(Payslip & { concepts: PayslipConcept[] }) | null>(null);

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
        onDelete={() => setDeleteTarget(detail)}
        onReprocess={() => reprocessMut.mutate(detail.id)}
        isReprocessing={reprocessMut.isPending}
      />
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Hero */}
      <Card className="p-0 overflow-hidden">
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
              <Badge variant="secondary" className="bg-accent-50 text-accent-800 dark:bg-accent-500/10 dark:text-accent-300 gap-1.5">
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="font-mono">{totalPayslips}</span>
                total
              </Badge>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            {profileId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => exportData(profileId, yearFilter ? Number(yearFilter) : undefined, "csv")}
                className="gap-1.5"
                aria-label="Exportar CSV"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                CSV
              </Button>
            )}
            <a href="/app/upload" className="inline-flex items-center gap-1.5 bg-accent-50 hover:bg-accent-100 dark:bg-accent-500/10 dark:hover:bg-accent-500/20 rounded-lg px-3 py-1.5 text-xs font-medium text-accent-700 dark:text-accent-400 transition-colors">
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Subir nóminas
            </a>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filtrar por perfil">
          {profiles.map((p) => (
            <Button
              key={p.id}
              type="button"
              variant={profileId === p.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => { setSelectedProfile(p.id); setSelectedPayslip(null); setPage(1); }}
              aria-pressed={profileId === p.id}
              className={cn("gap-1.5", profileId === p.id ? "shadow-sm" : "text-muted-foreground")}
            >
              <div
                className={cn("w-2.5 h-2.5 rounded-full transition-opacity", profileId === p.id ? "opacity-100" : "opacity-40")}
                style={{ backgroundColor: p.color }}
              />
              {p.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Extended Filters Bar */}
      <Card className="p-3 mb-6 flex-row flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por archivo o empresa..."
            value={searchFilter}
            onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>

        {years.length > 0 && (
          <Select value={yearFilter || ALL} onValueChange={(v) => { setYearFilter(v === ALL || v === null ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-auto" size="sm">
              <SelectValue placeholder="Año">{(v: string) => (v === ALL ? "Año" : v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Año</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y ?? "")}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={monthFilter || ALL} onValueChange={(v) => setMonthFilter(v === ALL || v === null ? "" : v)}>
          <SelectTrigger className="w-auto" size="sm">
            <SelectValue placeholder="Mes">{(v: string) => (v === ALL ? "Mes" : MONTH_NAMES[Number(v) - 1])}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Mes</SelectItem>
            {MONTH_NAMES.map((m, i) => (
              <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter || ALL} onValueChange={(v) => { setStatusFilter(v === ALL || v === null ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-auto" size="sm">
            <SelectValue placeholder="Estado">{(v: string) => (STATUS_MAP[v]?.label ?? "Estado")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Estado</SelectItem>
            <SelectItem value="parsed">Procesada</SelectItem>
            <SelectItem value="pending">Procesando</SelectItem>
            <SelectItem value="review">Revisar</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter || ALL} onValueChange={(v) => { setTypeFilter(v === ALL || v === null ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-auto" size="sm">
            <SelectValue placeholder="Tipo">{(v: string) => (TYPE_FILTER_LABELS[v] ?? "Tipo")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tipo</SelectItem>
            <SelectItem value="ordinal">Mensual</SelectItem>
            <SelectItem value="extra">Paga Extra</SelectItem>
          </SelectContent>
        </Select>

        {(searchFilter || yearFilter || monthFilter || statusFilter || typeFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearchFilter(""); setYearFilter(""); setMonthFilter(""); setStatusFilter(""); setTypeFilter(""); setPage(1); }}
            className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="w-3 h-3" /> Limpiar
          </Button>
        )}
      </Card>

      {/* Summary bar */}
      {filteredPayslips.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Bruto Medio</p>
            <p className="text-sm font-bold font-mono text-foreground mt-0.5">
              {formatCurrency(filteredPayslips.reduce((s, p) => s + (p.grossSalary ?? 0), 0) / filteredPayslips.length)}
            </p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Neto Medio</p>
            <p className="text-sm font-bold font-mono text-success-700 dark:text-success-500 mt-0.5">
              {formatCurrency(filteredPayslips.reduce((s, p) => s + (p.netSalary ?? 0), 0) / filteredPayslips.length)}
            </p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Bruto</p>
            <p className="text-sm font-bold font-mono text-foreground mt-0.5">
              {formatCurrency(filteredPayslips.reduce((s, p) => s + (p.grossSalary ?? 0), 0))}
            </p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Neto</p>
            <p className="text-sm font-bold font-mono text-success-700 dark:text-success-500 mt-0.5">
              {formatCurrency(filteredPayslips.reduce((s, p) => s + (p.netSalary ?? 0), 0))}
            </p>
          </Card>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <Card className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </Card>
      ) : filteredPayslips.length === 0 ? (
        <Card className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground text-sm mb-1">No hay nóminas</h3>
          <p className="text-muted-foreground text-xs mb-5">Sube nóminas para este perfil.</p>
          <a href="/app/upload" className={cn(buttonVariants(), "gap-1.5")}>
            Subir nóminas <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead aria-sort={sortField === "period" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    onClick={() => handleSort("period")}
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:text-foreground"
                  >
                    <span>Período</span>
                    <SortIndicator active={sortField === "period"} direction={sortDir} />
                  </button>
                </TableHead>
                <TableHead aria-sort={sortField === "fileName" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    onClick={() => handleSort("fileName")}
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:text-foreground"
                  >
                    <span>Archivo</span>
                    <SortIndicator active={sortField === "fileName"} direction={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-right" aria-sort={sortField === "grossSalary" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    onClick={() => handleSort("grossSalary")}
                    className="inline-flex w-full items-center justify-end gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:text-foreground"
                  >
                    <span>Bruto</span>
                    <SortIndicator active={sortField === "grossSalary"} direction={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-right" aria-sort={sortField === "netSalary" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    onClick={() => handleSort("netSalary")}
                    className="inline-flex w-full items-center justify-end gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:text-foreground"
                  >
                    <span>Neto</span>
                    <SortIndicator active={sortField === "netSalary"} direction={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-center" aria-sort={sortField === "parsingStatus" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    onClick={() => handleSort("parsingStatus")}
                    className="inline-flex items-center justify-center gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:text-foreground"
                  >
                    <span>Estado</span>
                    <SortIndicator active={sortField === "parsingStatus"} direction={sortDir} />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayslips.map((p) => {
                const status = STATUS_MAP[p.parsingStatus] ?? STATUS_MAP.error;
                return (
                  <TableRow
                    key={p.id}
                    onClick={() => setSelectedPayslip(p.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedPayslip(p.id); } }}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer group focus-visible:outline-2 focus-visible:outline-accent-500"
                  >
                    <TableCell className="py-3.5">
                      <span className="text-sm font-semibold text-foreground">{formatPeriod(p.periodMonth, p.periodYear)}</span>
                      {p.payslipType === "extra" && (
                        <Badge variant="secondary" className="ml-2 bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400 text-[10px]">Extra</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-[200px]">{p.fileName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 text-right font-mono tabular-nums text-foreground">{formatCurrency(p.grossSalary)}</TableCell>
                    <TableCell className="py-3.5 text-right font-mono tabular-nums font-semibold text-success-700 dark:text-success-500">{formatCurrency(p.netSalary)}</TableCell>
                    <TableCell className="py-3.5 text-center">
                      <Badge variant="secondary" className={status.cls}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-muted-foreground text-xs">
            {totalPayslips} nómina{totalPayslips !== 1 ? "s" : ""} en total
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Eliminar nómina"
        message={`¿Eliminar la nómina "${deleteTarget?.fileName ?? ""}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />
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
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground mb-5">
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver al listado
      </Button>

      {/* Header */}
      <Card className="p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-500/10 ring-1 ring-primary-100 dark:ring-primary-500/20 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
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
                  title="Haz clic para cambiar el tipo"
                >
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] cursor-pointer transition-colors",
                      payslip.payslipType === "extra"
                        ? "bg-accent-50 text-accent-700 hover:bg-accent-100 dark:bg-accent-500/10 dark:text-accent-400"
                        : ""
                    )}
                  >
                    {payslip.payslipType === "extra" ? "Paga Extra" : "Mensual"}
                  </Badge>
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!editing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                <Edit3 className="w-3.5 h-3.5" /> Editar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onReprocess} disabled={isReprocessing} className="gap-1.5">
              <RefreshCw className={cn("w-3.5 h-3.5", isReprocessing && "animate-spin")} />
              {isReprocessing ? "…" : "Reprocesar"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </Button>
          </div>
        </div>
      </Card>

      {/* Metadata (editable) */}
      {editing && (
        <Card className="p-5 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4 animate-slide-up">
          <div className="space-y-1.5">
            <Label>Mes</Label>
            <Input type="number" min={1} max={12}
              value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Año</Label>
            <Input type="number" min={1990} max={2100}
              value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Bruto</Label>
            <Input type="number" step="0.01"
              value={grossSalary} onChange={(e) => setGrossSalary(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Neto</Label>
            <Input type="number" step="0.01"
              value={netSalary} onChange={(e) => setNetSalary(Number(e.target.value))} />
          </div>
        </Card>
      )}

      {/* Concepts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Devengos */}
        <Card className="p-5">
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
                      <Input value={c.name} onChange={(e) => updateConcept(realIndex, "name", e.target.value)}
                        className="flex-1" placeholder="Concepto" />
                      <Input type="number" step="0.01" value={c.amount}
                        onChange={(e) => updateConcept(realIndex, "amount", Number(e.target.value))}
                        className="w-24 text-right font-mono" />
                      <Button variant="ghost" size="icon-sm" onClick={() => removeConcept(realIndex)} className="hover:bg-destructive/10 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </Button>
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
              <Button variant="link" size="sm" onClick={() => addConcept("devengo")} className="gap-1 px-0 h-auto text-primary-600 dark:text-primary-400 mt-1">
                <Plus className="w-3 h-3" /> Añadir devengo
              </Button>
            )}
          </div>
        </Card>

        {/* Deducciones */}
        <Card className="p-5">
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
                      <Input value={c.name} onChange={(e) => updateConcept(realIndex, "name", e.target.value)}
                        className="flex-1" placeholder="Concepto" />
                      <Input type="number" step="0.01" value={c.amount}
                        onChange={(e) => updateConcept(realIndex, "amount", Number(e.target.value))}
                        className="w-24 text-right font-mono" />
                      <Button variant="ghost" size="icon-sm" onClick={() => removeConcept(realIndex)} className="hover:bg-destructive/10 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </Button>
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
              <Button variant="link" size="sm" onClick={() => addConcept("deduccion")} className="gap-1 px-0 h-auto text-primary-600 dark:text-primary-400 mt-1">
                <Plus className="w-3 h-3" /> Añadir deducción
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Totals */}
      {!editing && (
        <Card className="mt-6 p-5 flex-row items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Bruto</p>
            <p className="text-lg font-bold text-foreground font-mono">{formatCurrency(payslip.grossSalary)}</p>
          </div>
          <div className="w-px h-10 bg-muted" />
          <div className="text-right">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Líquido a Percibir</p>
            <p className="text-lg font-bold text-success-700 dark:text-success-500 font-mono">{formatCurrency(payslip.netSalary)}</p>
          </div>
        </Card>
      )}

      {/* Actions */}
      {editing && (
        <div className="mt-6 flex gap-3 animate-slide-up">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="gap-2">
            <Save className="w-4 h-4" />
            {saveMut.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => { setEditing(false); setConcepts(payslip.concepts); }}
          >
            Cancelar
          </Button>
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

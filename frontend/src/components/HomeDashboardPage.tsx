import { useQuery } from "@tanstack/react-query";
import {
  Wallet, FileText, ArrowUpRight, ArrowDownRight,
  PiggyBank, Receipt, TrendingUp, BarChart3,
  ArrowRight, DollarSign, Users, Upload,
  Landmark, CheckCircle2, Circle, CreditCard,
  Download,
} from "lucide-react";
import {
  getDashboard, getFinanceSummary, getAccounts, getTransactions,
  type Account, type Transaction,
} from "../lib/api";
import { Providers } from "./Providers";
import { formatCurrency } from "../lib/format";

// ─── Helpers ────────────────────────────────────────────────────
function greeting(): string {
  const h = new Date().getHours();
  if (h < 7) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const ACCOUNT_ICONS: Record<string, typeof Wallet> = {
  bank: Landmark,
  credit_card: CreditCard,
  cash: DollarSign,
  investment: TrendingUp,
  other: Wallet,
};

// ─── Skeleton ───────────────────────────────────────────────────
function HomeSkeleton() {
  return (
    <div className="animate-fade-in space-y-8">
      {/* Hero skeleton */}
      <div className="card p-8">
        <div className="skeleton h-8 w-56 mb-2" />
        <div className="skeleton h-12 w-72 mb-1" />
        <div className="skeleton h-5 w-48" />
      </div>
      {/* Cards skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6"><div className="skeleton h-40 w-full" /></div>
        <div className="card p-6"><div className="skeleton h-40 w-full" /></div>
      </div>
      {/* Bottom skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2"><div className="skeleton h-48 w-full" /></div>
        <div className="card p-5"><div className="skeleton h-48 w-full" /></div>
      </div>
    </div>
  );
}

// ─── Main View ──────────────────────────────────────────────────
function HomeDashboardView() {
  const { data: payrollData, isLoading: loadingPayroll } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
  });

  const { data: financeSummary, isLoading: loadingFinance } = useQuery({
    queryKey: ["finance-summary"],
    queryFn: getFinanceSummary,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });

  const { data: txData } = useQuery({
    queryKey: ["transactions", { limit: 5, page: 1 }],
    queryFn: () => getTransactions({ limit: 5, page: 1 }),
  });

  const isLoading = loadingPayroll || loadingFinance;
  if (isLoading) return <HomeSkeleton />;

  const kpis = payrollData?.kpis;
  const hasPayroll = !!kpis && kpis.totalPayslips > 0;
  const hasFinance = !!financeSummary && (financeSummary.totalBalance !== 0 || financeSummary.monthExpenses !== 0);
  const hasData = hasFinance || hasPayroll;
  const recentTx = txData?.data ?? [];

  // ── Onboarding: no data yet ───────────────────────────────────
  if (!hasData) {
    return (
      <div className="animate-fade-in max-w-2xl mx-auto py-8">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary-500/20">
            <BarChart3 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-surface-900 mb-2">Te damos la bienvenida</h2>
          <p className="text-surface-500 max-w-md mx-auto leading-relaxed">
            Empieza importando tus datos financieros o subiendo tus nóminas en PDF para ver todo tu resumen aquí.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a href="/settings?tab=finanzas" className="card p-6 group cursor-pointer hover:shadow-card-hover transition-all duration-200 hover:border-primary-200">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 ring-1 ring-primary-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200">
              <Download className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="font-bold text-surface-900 mb-1">Importar datos YNAB</h3>
            <p className="text-sm text-surface-500 leading-relaxed">Sube tu CSV exportado de YNAB para importar cuentas y transacciones automáticamente.</p>
          </a>
          <a href="/upload" className="card p-6 group cursor-pointer hover:shadow-card-hover transition-all duration-200 hover:border-accent-200">
            <div className="w-12 h-12 rounded-2xl bg-accent-50 ring-1 ring-accent-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200">
              <Upload className="w-6 h-6 text-accent-600" />
            </div>
            <h3 className="font-bold text-surface-900 mb-1">Subir nóminas</h3>
            <p className="text-sm text-surface-500 leading-relaxed">Sube archivos PDF de tus nóminas y extraeremos los datos automáticamente con OCR.</p>
          </a>
          <a href="/accounts" className="card p-6 group cursor-pointer hover:shadow-card-hover transition-all duration-200 hover:border-success-200">
            <div className="w-12 h-12 rounded-2xl bg-success-50 ring-1 ring-success-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200">
              <Landmark className="w-6 h-6 text-success-600" />
            </div>
            <h3 className="font-bold text-surface-900 mb-1">Crear cuentas</h3>
            <p className="text-sm text-surface-500 leading-relaxed">Añade tus cuentas bancarias, tarjetas o efectivo para gestionar tus finanzas.</p>
          </a>
          <a href="/profiles" className="card p-6 group cursor-pointer hover:shadow-card-hover transition-all duration-200 hover:border-surface-300">
            <div className="w-12 h-12 rounded-2xl bg-surface-100 ring-1 ring-surface-200 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200">
              <Users className="w-6 h-6 text-surface-600" />
            </div>
            <h3 className="font-bold text-surface-900 mb-1">Crear perfiles</h3>
            <p className="text-sm text-surface-500 leading-relaxed">Crea perfiles de empleados para organizar las nóminas por persona.</p>
          </a>
        </div>
      </div>
    );
  }

  // ── Main dashboard: has data ──────────────────────────────────
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero / Balance header */}
      <div className="card p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-400" />
        <div className="px-6 py-6 sm:px-8 sm:py-7">
          <p className="text-surface-500 text-sm font-medium mb-1">{greeting()}</p>
          {hasFinance ? (
            <>
              <p className="text-surface-400 text-xs uppercase tracking-wider mb-0.5">Balance total</p>
              <p className={`text-3xl sm:text-4xl font-bold font-mono tracking-tight ${
                financeSummary.totalBalance >= 0 ? "text-primary-700" : "text-danger-600"
              }`}>
                {formatCurrency(financeSummary.totalBalance)}
              </p>
            </>
          ) : (
            <>
              <p className="text-surface-400 text-xs uppercase tracking-wider mb-0.5">Salario neto medio</p>
              <p className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-accent-700">
                {formatCurrency(kpis!.avgNet)}
              </p>
            </>
          )}

          {/* Mini KPI pills */}
          <div className="flex flex-wrap gap-2.5 mt-5">
            {hasFinance && (
              <>
                <div className="flex items-center gap-1.5 bg-success-50 rounded-lg px-3 py-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-success-600" />
                  <span className="text-xs font-medium text-success-700">Ingresos</span>
                  <span className="text-xs font-bold text-success-800 font-mono">{formatCurrency(financeSummary.monthIncome)}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-danger-50 rounded-lg px-3 py-1.5">
                  <ArrowDownRight className="w-3.5 h-3.5 text-danger-600" />
                  <span className="text-xs font-medium text-danger-700">Gastos</span>
                  <span className="text-xs font-bold text-danger-800 font-mono">{formatCurrency(financeSummary.monthExpenses)}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-primary-50 rounded-lg px-3 py-1.5">
                  <PiggyBank className="w-3.5 h-3.5 text-primary-600" />
                  <span className="text-xs font-medium text-primary-700">Ahorro</span>
                  <span className="text-xs font-bold text-primary-800 font-mono">{formatCurrency(financeSummary.monthSavings)}</span>
                </div>
              </>
            )}
            {hasPayroll && (
              <>
                <div className="flex items-center gap-1.5 bg-accent-50 rounded-lg px-3 py-1.5">
                  <FileText className="w-3.5 h-3.5 text-accent-600" />
                  <span className="text-xs font-medium text-accent-700">{kpis!.totalPayslips} nóminas</span>
                </div>
                {hasFinance || (
                  <div className="flex items-center gap-1.5 bg-success-50 rounded-lg px-3 py-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-success-600" />
                    <span className="text-xs font-medium text-success-700">Bruto medio</span>
                    <span className="text-xs font-bold text-success-800 font-mono">{formatCurrency(kpis!.avgGross)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Section navigation cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Finanzas card */}
        <a
          href="/finance"
          className="card p-0 overflow-hidden group cursor-pointer hover:shadow-card-hover transition-all duration-200"
        >
          <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-400" />
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary-50 ring-1 ring-primary-100 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-bold text-surface-900">Finanzas</h3>
                  <p className="text-xs text-surface-500">Cuentas, gastos e ingresos</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-surface-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all duration-200" />
            </div>
            {hasFinance ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Ingresos</p>
                  <p className="text-lg font-bold text-success-600 tabular-nums font-mono mt-0.5">
                    {formatCurrency(financeSummary.monthIncome)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Gastos</p>
                  <p className="text-lg font-bold text-danger-600 tabular-nums font-mono mt-0.5">
                    {formatCurrency(financeSummary.monthExpenses)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Cuentas</p>
                  <p className="text-lg font-bold text-surface-900 tabular-nums font-mono mt-0.5">
                    {accounts.length}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 py-2 text-sm text-surface-500">
                <Receipt className="w-5 h-5 text-surface-300 flex-shrink-0" />
                Importa tu CSV de YNAB o añade cuentas para empezar
              </div>
            )}
          </div>
        </a>

        {/* Nóminas card */}
        <a
          href="/payroll"
          className="card p-0 overflow-hidden group cursor-pointer hover:shadow-card-hover transition-all duration-200"
        >
          <div className="h-1.5 bg-gradient-to-r from-accent-500 to-accent-400" />
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-accent-50 ring-1 ring-accent-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-accent-600" />
                </div>
                <div>
                  <h3 className="font-bold text-surface-900">Nóminas</h3>
                  <p className="text-xs text-surface-500">Salarios, retenciones y análisis</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-surface-300 group-hover:text-accent-500 group-hover:translate-x-0.5 transition-all duration-200" />
            </div>
            {hasPayroll ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Bruto medio</p>
                  <p className="text-lg font-bold text-surface-900 tabular-nums font-mono mt-0.5">
                    {formatCurrency(kpis!.avgGross)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Neto medio</p>
                  <p className="text-lg font-bold text-success-600 tabular-nums font-mono mt-0.5">
                    {formatCurrency(kpis!.avgNet)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">IRPF medio</p>
                  <p className="text-lg font-bold text-danger-600 tabular-nums font-mono mt-0.5">
                    {kpis!.avgIrpf.toFixed(1)}%
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 py-2 text-sm text-surface-500">
                <Users className="w-5 h-5 text-surface-300 flex-shrink-0" />
                Crea un perfil y sube tus nóminas en PDF para empezar
              </div>
            )}
          </div>
        </a>
      </div>

      {/* Bottom row: Recent activity + Accounts sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent transactions */}
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
            <h3 className="font-semibold text-surface-900 text-sm">Actividad reciente</h3>
            <a href="/transactions" className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors cursor-pointer">
              Ver todo
            </a>
          </div>
          {recentTx.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {recentTx.map((tx) => {
                const isExpense = tx.type === "expense";
                const isIncome = tx.type === "income";
                return (
                  <div key={tx.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-50/50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isExpense ? "bg-danger-50" : isIncome ? "bg-success-50" : "bg-primary-50"
                    }`}>
                      {isExpense
                        ? <ArrowDownRight className="w-4 h-4 text-danger-500" />
                        : isIncome
                          ? <ArrowUpRight className="w-4 h-4 text-success-500" />
                          : <Receipt className="w-4 h-4 text-primary-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-900 truncate">
                        {tx.payee ?? tx.accountName}
                      </p>
                      <p className="text-xs text-surface-400">
                        {formatDate(tx.date)}{tx.categoryName ? ` · ${tx.categoryName}` : ""}
                      </p>
                    </div>
                    <p className={`text-sm font-bold tabular-nums font-mono ${
                      isExpense ? "text-danger-600" : isIncome ? "text-success-600" : "text-surface-600"
                    }`}>
                      {isExpense ? "−" : isIncome ? "+" : ""}{formatCurrency(tx.amount)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <Receipt className="w-8 h-8 text-surface-200 mx-auto mb-2" />
              <p className="text-sm text-surface-400">Sin transacciones todavía</p>
            </div>
          )}
        </div>

        {/* Accounts sidebar */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
            <h3 className="font-semibold text-surface-900 text-sm">Mis cuentas</h3>
            <a href="/accounts" className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors cursor-pointer">
              Gestionar
            </a>
          </div>
          {accounts.length > 0 ? (
            <div className="divide-y divide-surface-100">
              {accounts.slice(0, 5).map((a) => {
                const Icon = ACCOUNT_ICONS[a.type] ?? Wallet;
                return (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
                      style={{ backgroundColor: a.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-900 truncate">{a.name}</p>
                    </div>
                    <p className={`text-sm font-bold tabular-nums font-mono ${
                      a.balance >= 0 ? "text-surface-900" : "text-danger-600"
                    }`}>
                      {formatCurrency(a.balance)}
                    </p>
                  </div>
                );
              })}
              {accounts.length > 5 && (
                <div className="px-5 py-2.5 text-center">
                  <a href="/accounts" className="text-xs font-semibold text-primary-600 hover:text-primary-700 cursor-pointer">
                    +{accounts.length - 5} más
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <Landmark className="w-8 h-8 text-surface-200 mx-auto mb-2" />
              <p className="text-sm text-surface-400">Sin cuentas todavía</p>
              <a href="/accounts" className="text-xs font-semibold text-primary-600 mt-1 inline-block cursor-pointer">
                Crear cuenta
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <a href="/settings?tab=finanzas" className="btn-ghost text-sm flex items-center gap-1.5">
          <Download className="w-4 h-4" /> Importar YNAB
        </a>
        <a href="/upload" className="btn-ghost text-sm flex items-center gap-1.5">
          <Upload className="w-4 h-4" /> Subir nóminas
        </a>
        <a href="/transactions" className="btn-ghost text-sm flex items-center gap-1.5">
          <Receipt className="w-4 h-4" /> Transacciones
        </a>
        <a href="/payroll?tab=predicciones" className="btn-ghost text-sm flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4" /> Analítica
        </a>
      </div>
    </div>
  );
}

export default function HomeDashboardPage() {
  return (
    <Providers>
      <HomeDashboardView />
    </Providers>
  );
}

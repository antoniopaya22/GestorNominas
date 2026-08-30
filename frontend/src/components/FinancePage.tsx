import { useState } from "react";
import { Providers } from "./Providers";
import { TabBar } from "./ui/TabBar";
import { FinanceDashboardView } from "./FinanceDashboardPage";
import { FinanceAnalyticsView } from "./FinanceAnalyticsPage";

type FinanceTab = "resumen" | "detallado";

function getInitialTab(): FinanceTab {
  if (typeof window === "undefined") return "resumen";
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") === "detallado" ? "detallado" : "resumen";
}

function FinanceView() {
  const [tab, setTab] = useState<FinanceTab>(getInitialTab);

  return (
    <div className="space-y-6">
      <TabBar
        tabs={[
          { key: "resumen", label: "Resumen" },
          { key: "detallado", label: "Análisis detallado" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "resumen" ? <FinanceDashboardView onOpenDetailed={() => setTab("detallado")} /> : <FinanceAnalyticsView />}
    </div>
  );
}

export default function FinancePage() {
  return (
    <Providers>
      <FinanceView />
    </Providers>
  );
}

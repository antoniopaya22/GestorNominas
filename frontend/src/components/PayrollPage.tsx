import { useState } from "react";
import { Providers } from "./Providers";
import { TabBar } from "./ui/TabBar";
import { DashboardView } from "./DashboardPage";
import { AnalyticsView } from "./AnalyticsPage";

type PayrollTab = "resumen" | "predicciones";

function getInitialTab(): PayrollTab {
  if (typeof window === "undefined") return "resumen";
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") === "predicciones" ? "predicciones" : "resumen";
}

function PayrollView() {
  const [tab, setTab] = useState<PayrollTab>(getInitialTab);

  return (
    <div className="space-y-6">
      <TabBar
        tabs={[
          { key: "resumen", label: "Resumen" },
          { key: "predicciones", label: "Predicciones y alertas" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "resumen" ? <DashboardView /> : <AnalyticsView />}
    </div>
  );
}

export default function PayrollPage() {
  return (
    <Providers>
      <PayrollView />
    </Providers>
  );
}

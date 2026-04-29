import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ShoppingCart, Package, DollarSign, Users, UserCog } from "lucide-react";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { PeriodSelector, PeriodPreset, getPresetRange } from "@/components/reports/PeriodSelector";
import { SalesTab } from "@/components/reports/tabs/SalesTab";
import { StockTab } from "@/components/reports/tabs/StockTab";
import { FinancialTab } from "@/components/reports/tabs/FinancialTab";
import { CustomersTab } from "@/components/reports/tabs/CustomersTab";
import { OperatorsTab } from "@/components/reports/tabs/OperatorsTab";
import { format, parseISO, isValid } from "date-fns";

const TABS = ["sales", "stock", "financial", "customers", "operators"] as const;
type TabKey = (typeof TABS)[number];

const Reports = () => {
  const [params, setParams] = useSearchParams();

  const initialTab = (params.get("tab") as TabKey) || "sales";
  const initialPreset = (params.get("preset") as PeriodPreset) || "month";
  const urlStart = params.get("start");
  const urlEnd = params.get("end");

  const [tab, setTab] = useState<TabKey>(TABS.includes(initialTab) ? initialTab : "sales");
  const [preset, setPreset] = useState<PeriodPreset>(initialPreset);

  const initRange = useMemo(() => {
    if (initialPreset === "custom" && urlStart && urlEnd) {
      const s = parseISO(urlStart), e = parseISO(urlEnd);
      if (isValid(s) && isValid(e)) return { start: s, end: e };
    }
    return getPresetRange(initialPreset);
  }, []); // eslint-disable-line

  const [start, setStart] = useState<Date>(initRange.start);
  const [end, setEnd] = useState<Date>(initRange.end);

  // Sync URL whenever filters change
  useEffect(() => {
    const next: Record<string, string> = {
      tab,
      preset,
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    };
    setParams(next, { replace: true });
  }, [tab, preset, start, end, setParams]);

  const handlePresetChange = (p: PeriodPreset) => {
    setPreset(p);
    if (p !== "custom") {
      const r = getPresetRange(p);
      setStart(r.start);
      setEnd(r.end);
    }
  };

  return (
    <AppLayout title="Relatórios">
      <PermissionGuard permission="reports">
        <div className="space-y-6 print:space-y-3" id="report-print-area">
          <Card className="p-4 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PeriodSelector
                preset={preset}
                start={start}
                end={end}
                onPresetChange={handlePresetChange}
                onCustomChange={(s, e) => { setStart(s); setEnd(e); }}
              />
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" /> Exportar PDF
              </Button>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Período: {format(start, "dd/MM/yyyy")} a {format(end, "dd/MM/yyyy")}
            </div>
          </Card>

          <div className="hidden print:block mb-4">
            <h1 className="text-2xl font-bold">Relatório Nexus Retail</h1>
            <p className="text-sm">Período: {format(start, "dd/MM/yyyy")} a {format(end, "dd/MM/yyyy")}</p>
            <p className="text-xs text-muted-foreground">Gerado em {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <TabsList className="flex flex-wrap h-auto print:hidden">
              <TabsTrigger value="sales" className="gap-2"><ShoppingCart className="w-4 h-4" />Vendas</TabsTrigger>
              <TabsTrigger value="stock" className="gap-2"><Package className="w-4 h-4" />Estoque</TabsTrigger>
              <TabsTrigger value="financial" className="gap-2"><DollarSign className="w-4 h-4" />Financeiro</TabsTrigger>
              <TabsTrigger value="customers" className="gap-2"><Users className="w-4 h-4" />Clientes</TabsTrigger>
              <TabsTrigger value="operators" className="gap-2"><UserCog className="w-4 h-4" />Operadores</TabsTrigger>
            </TabsList>
            <TabsContent value="sales" className="pt-4"><SalesTab start={start} end={end} /></TabsContent>
            <TabsContent value="stock" className="pt-4"><StockTab start={start} end={end} /></TabsContent>
            <TabsContent value="financial" className="pt-4"><FinancialTab start={start} end={end} /></TabsContent>
            <TabsContent value="customers" className="pt-4"><CustomersTab start={start} end={end} /></TabsContent>
            <TabsContent value="operators" className="pt-4"><OperatorsTab start={start} end={end} /></TabsContent>
          </Tabs>
        </div>
      </PermissionGuard>
    </AppLayout>
  );
};

export default Reports;

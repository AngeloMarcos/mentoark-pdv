import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialDashboard } from "@/components/financial/FinancialDashboard";
import { AccountsList } from "@/components/financial/AccountsList";
import { CashFlowView } from "@/components/financial/CashFlowView";
import { CategoriesManager } from "@/components/financial/CategoriesManager";

const Financial = () => {
  return (
    <AppLayout title="Financeiro">
      <div className="space-y-6 animate-fade-in">
        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full sm:w-auto">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="receivable">A Receber</TabsTrigger>
            <TabsTrigger value="payable">A Pagar</TabsTrigger>
            <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><FinancialDashboard /></TabsContent>
          <TabsContent value="receivable"><AccountsList type="receber" /></TabsContent>
          <TabsContent value="payable"><AccountsList type="pagar" /></TabsContent>
          <TabsContent value="cashflow"><CashFlowView /></TabsContent>
          <TabsContent value="categories"><CategoriesManager /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Financial;

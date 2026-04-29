import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchaseOrdersTab } from "@/components/purchases/PurchaseOrdersTab";
import { SuppliersTab } from "@/components/suppliers/SuppliersTab";

const Compras = () => {
  return (
    <AppLayout title="Compras">
      <div className="space-y-6 animate-fade-in">
        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full sm:w-auto">
            <TabsTrigger value="orders">Pedidos de Compra</TabsTrigger>
            <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
          </TabsList>
          <TabsContent value="orders"><PurchaseOrdersTab /></TabsContent>
          <TabsContent value="suppliers"><SuppliersTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Compras;

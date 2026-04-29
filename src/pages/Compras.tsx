import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchaseOrdersTab } from "@/components/purchases/PurchaseOrdersTab";
import { SuppliersTab } from "@/components/suppliers/SuppliersTab";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useFindByBarcode } from "@/hooks/useBarcodes";
import { toast } from "sonner";

const Compras = () => {
  const findByBarcode = useFindByBarcode();

  // Barcode scanner: just notify which product was scanned (consumed by inner forms)
  useBarcodeScanner(async (code) => {
    try {
      const product = await findByBarcode.mutateAsync(code);
      if (product) {
        // Broadcast via window event so nested dialogs can react
        window.dispatchEvent(new CustomEvent("barcode-product-scanned", { detail: { product, code } }));
        toast.success(`${product.name} (${code})`);
      } else {
        toast.error(`Produto não encontrado: ${code}`);
      }
    } catch {
      toast.error("Erro ao buscar produto");
    }
  });

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

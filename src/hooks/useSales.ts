import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  product_name?: string;
}

export interface Sale {
  id: string;
  tenant_id: string;
  datetime: string;
  user_id: string | null;
  customer_id: string | null;
  gross_total: number;
  discount_total: number;
  net_total: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
  sale_items?: SaleItem[];
}

export interface CreateSaleInput {
  items: SaleItem[];
  customer_id?: string | null;
  payment_method: string;
  discount_total?: number;
  notes?: string;
}

export function useTodaySales() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["sales", "today", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return { total: 0, count: 0, byPaymentMethod: {} };

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .gte("datetime", today.toISOString());

      if (error) throw error;

      const sales = data as Sale[];
      const total = sales.reduce((sum, s) => sum + Number(s.net_total), 0);
      const byPaymentMethod = sales.reduce(
        (acc, s) => {
          acc[s.payment_method] = (acc[s.payment_method] || 0) + Number(s.net_total);
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        total,
        count: sales.length,
        byPaymentMethod,
      };
    },
    enabled: !!currentTenant,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useSalesReport(startDate: Date, endDate: Date) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["sales", "report", currentTenant?.id, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      if (!currentTenant) return null;

      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Fetch sales
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .gte("datetime", start.toISOString())
        .lte("datetime", end.toISOString())
        .order("datetime", { ascending: false });

      if (salesError) throw salesError;

      const sales = salesData as Sale[];
      const saleIds = sales.map((s) => s.id);

      // Fetch sale items with product info
      let productRanking: { product_id: string; product_name: string; quantity: number; revenue: number }[] = [];
      
      if (saleIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from("sale_items")
          .select(`
            quantity,
            total,
            product_id,
            products:product_id (name)
          `)
          .in("sale_id", saleIds);

        if (itemsError) throw itemsError;

        // Aggregate by product
        const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
        
        for (const item of itemsData || []) {
          const productId = item.product_id;
          const productName = (item.products as any)?.name || "Produto removido";
          const current = productMap.get(productId) || { name: productName, quantity: 0, revenue: 0 };
          current.quantity += Number(item.quantity);
          current.revenue += Number(item.total);
          productMap.set(productId, current);
        }

        productRanking = Array.from(productMap.entries())
          .map(([id, data]) => ({
            product_id: id,
            product_name: data.name,
            quantity: data.quantity,
            revenue: data.revenue,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);
      }

      const totalGross = sales.reduce((sum, s) => sum + Number(s.gross_total), 0);
      const totalDiscount = sales.reduce((sum, s) => sum + Number(s.discount_total), 0);
      const totalNet = sales.reduce((sum, s) => sum + Number(s.net_total), 0);

      const byPaymentMethod = sales.reduce(
        (acc, s) => {
          acc[s.payment_method] = (acc[s.payment_method] || 0) + Number(s.net_total);
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        sales,
        totalGross,
        totalDiscount,
        totalNet,
        count: sales.length,
        byPaymentMethod,
        productRanking,
      };
    },
    enabled: !!currentTenant,
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateSaleInput) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");
      if (!user) throw new Error("Usuário não autenticado");

      const grossTotal = input.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const itemDiscounts = input.items.reduce((sum, item) => sum + item.discount, 0);
      const discountTotal = (input.discount_total || 0) + itemDiscounts;
      const netTotal = grossTotal - discountTotal;

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          tenant_id: currentTenant.id,
          user_id: user.id,
          customer_id: input.customer_id || null,
          gross_total: grossTotal,
          discount_total: discountTotal,
          net_total: netTotal,
          payment_method: input.payment_method,
          notes: input.notes || null,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = input.items.map((item) => ({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount,
        total: item.total,
      }));

      const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
      if (itemsError) throw itemsError;

      // Update stock and create movements
      for (const item of input.items) {
        // Update product stock directly
        const { data: product } = await supabase
          .from("products")
          .select("stock_current")
          .eq("id", item.product_id)
          .single();

        if (product) {
          await supabase
            .from("products")
            .update({ stock_current: Number(product.stock_current) - item.quantity })
            .eq("id", item.product_id);
        }

        // Create stock movement
        await supabase.from("stock_movements").insert({
          tenant_id: currentTenant.id,
          product_id: item.product_id,
          movement_type: "sale",
          quantity: -item.quantity,
          description: `Venda #${sale.id.slice(0, 8)}`,
          sale_id: sale.id,
        });
      }

      // Create financial entry
      await supabase.from("financial_entries").insert({
        tenant_id: currentTenant.id,
        type: "income",
        description: `Venda #${sale.id.slice(0, 8)}`,
        amount: netTotal,
        payment_method: input.payment_method,
        sale_id: sale.id,
      });

      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      queryClient.invalidateQueries({ queryKey: ["financial_entries"] });
      toast.success("Venda finalizada com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao finalizar venda: ${error.message}`);
    },
  });
}

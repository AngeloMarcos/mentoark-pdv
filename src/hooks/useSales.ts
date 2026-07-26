import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CreateSaleInputSchema, validateInput } from "@/lib/validations";
import { getUserFriendlyError } from "@/lib/error-handler";
import { SalePayment } from "@/hooks/usePaymentMethods";
import { salesService } from "@/services/db/sales.service";

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
  payments: SalePayment[];
  customer_id?: string | null;
  discount_total?: number;
  notes?: string;
  session_id?: string | null;
  // Legacy support
  payment_method?: string;
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
    refetchInterval: 30000,
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

      // Normaliza input para suportar legacy (payment_method) e novo (payments)
      const payments: SalePayment[] = input.payments?.length > 0
        ? input.payments
        : input.payment_method
          ? [{ payment_method_code: input.payment_method, amount: 0 }]
          : [];

      if (payments.length === 0) throw new Error("Selecione uma forma de pagamento");

      // Validate input
      const validationInput = {
        ...input,
        payment_method: payments[0].payment_method_code,
      };
      validateInput(CreateSaleInputSchema, validationInput);

      const grossTotal = input.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const itemDiscounts = input.items.reduce((sum, item) => sum + item.discount, 0);
      const discountTotal = (input.discount_total || 0) + itemDiscounts;
      const netTotal = grossTotal - discountTotal;

      // Validate calculated totals
      if (netTotal < 0) throw new Error("Total líquido não pode ser negativo");
      if (discountTotal > grossTotal) throw new Error("Desconto não pode ser maior que o valor bruto");

      // Validate payments total
      const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
      if (totalPayments < netTotal) throw new Error("Valor dos pagamentos insuficiente");

      // Despacha toda a carga para o serviço especializado
      const response = await salesService.checkoutSale({
        tenant_id: currentTenant.id,
        user_id: user.id,
        customer_id: input.customer_id || null,
        session_id: input.session_id || null,
        gross_total: grossTotal,
        discount_total: discountTotal,
        net_total: netTotal,
        payment_method: primaryPaymentMethod,
        notes: input.notes || null,
        items: input.items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          total: item.total,
        })),
        payments: payments.map((p) => ({
          payment_method_id: p.payment_method_id || null,
          payment_method_code: p.payment_method_code,
          amount: p.amount,
          change_amount: p.change_amount || 0,
          installments: p.installments || 1,
          authorization_code: p.authorization_code || null,
        })),
      });

      return { id: response.sale_id };
    },
    onSuccess: (sale, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      queryClient.invalidateQueries({ queryKey: ["financial_entries"] });
      queryClient.invalidateQueries({ queryKey: ["cash_movements"] });
      queryClient.invalidateQueries({ queryKey: ["cash_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["sale_payments"] });
      
      // Invalidate customer points if customer was identified
      if (variables.customer_id) {
        queryClient.invalidateQueries({ queryKey: ["customer-points", variables.customer_id] });
        queryClient.invalidateQueries({ queryKey: ["points-history", variables.customer_id] });
      }
      
      toast.success("Venda finalizada com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SaleProduct {
  name: string;
  internal_code: string | null;
}

interface SaleItem {
  quantity: number;
  unit_price: number;
  discount: number | null;
  total: number;
  products: SaleProduct | null;
}

export interface CustomerSale {
  id: string;
  datetime: string;
  net_total: number;
  gross_total: number;
  discount_total: number | null;
  payment_method: string;
  sale_items: SaleItem[];
}

export interface CustomerStats {
  totalSpent: number;
  purchaseCount: number;
  averageTicket: number;
  lastPurchase: string | null;
}

export function useCustomerPurchaseHistory(customerId: string | null) {
  return useQuery({
    queryKey: ["customer-purchase-history", customerId],
    queryFn: async () => {
      if (!customerId) return { sales: [], stats: null };

      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          datetime,
          net_total,
          gross_total,
          discount_total,
          payment_method,
          sale_items (
            quantity,
            unit_price,
            discount,
            total,
            products:product_id (
              name,
              internal_code
            )
          )
        `)
        .eq("customer_id", customerId)
        .order("datetime", { ascending: false });

      if (error) throw error;

      const sales = (data || []) as CustomerSale[];
      
      // Calculate stats
      const totalSpent = sales.reduce((sum, sale) => sum + Number(sale.net_total), 0);
      const purchaseCount = sales.length;
      const averageTicket = purchaseCount > 0 ? totalSpent / purchaseCount : 0;
      const lastPurchase = sales.length > 0 ? sales[0].datetime : null;

      const stats: CustomerStats = {
        totalSpent,
        purchaseCount,
        averageTicket,
        lastPurchase,
      };

      return { sales, stats };
    },
    enabled: !!customerId,
  });
}

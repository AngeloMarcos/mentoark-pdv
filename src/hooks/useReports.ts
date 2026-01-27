import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { format, startOfDay, endOfDay } from "date-fns";

export interface ReportFilters {
  startDate: Date;
  endDate: Date;
  category?: string;
  paymentMethod?: string;
  limit?: number;
}

export interface ProductProfitReport {
  product_id: string;
  product_name: string;
  category: string | null;
  quantity_sold: number;
  revenue: number;
  cost: number;
  gross_profit: number;
  profit_margin: number;
}

export interface CategoryReport {
  category: string;
  product_count: number;
  quantity_sold: number;
  revenue: number;
  percentage: number;
}

export interface PaymentMethodReport {
  payment_method: string;
  payment_label: string;
  sale_count: number;
  total_amount: number;
  percentage: number;
}

export interface DailyReport {
  date: string;
  sale_count: number;
  gross_total: number;
  discount_total: number;
  net_total: number;
  cost: number;
  profit: number;
}

export interface DREReport {
  grossRevenue: number;
  discounts: number;
  netRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMargin: number;
}

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  pix: "PIX",
  fiado: "Fiado",
};

// Hook for product profit/margin report
export function useProductProfitReport(filters: ReportFilters) {
  const { currentTenant } = useTenant();
  
  return useQuery({
    queryKey: ["report-product-profit", currentTenant?.id, filters.startDate, filters.endDate, filters.category, filters.limit],
    queryFn: async (): Promise<ProductProfitReport[]> => {
      if (!currentTenant?.id) return [];
      
      const startStr = format(startOfDay(filters.startDate), "yyyy-MM-dd'T'HH:mm:ss");
      const endStr = format(endOfDay(filters.endDate), "yyyy-MM-dd'T'HH:mm:ss");
      
      // Get sales in range
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("id")
        .eq("tenant_id", currentTenant.id)
        .gte("datetime", startStr)
        .lte("datetime", endStr);
      
      if (salesError) throw salesError;
      if (!sales || sales.length === 0) return [];
      
      const saleIds = sales.map((s) => s.id);
      
      // Get sale items with product info
      const { data: items, error: itemsError } = await supabase
        .from("sale_items")
        .select(`
          quantity,
          total,
          unit_price,
          product_id,
          products:product_id (
            name,
            category,
            cost_price,
            weighted_avg_cost
          )
        `)
        .in("sale_id", saleIds);
      
      if (itemsError) throw itemsError;
      if (!items) return [];
      
      // Aggregate by product
      const productMap = new Map<string, ProductProfitReport>();
      
      for (const item of items) {
        const product = item.products as any;
        if (!product) continue;
        
        // Filter by category if specified
        if (filters.category && product.category !== filters.category) continue;
        
        const costPrice = product.weighted_avg_cost || product.cost_price || 0;
        const itemCost = item.quantity * costPrice;
        
        const existing = productMap.get(item.product_id);
        if (existing) {
          existing.quantity_sold += item.quantity;
          existing.revenue += item.total;
          existing.cost += itemCost;
        } else {
          productMap.set(item.product_id, {
            product_id: item.product_id,
            product_name: product.name,
            category: product.category,
            quantity_sold: item.quantity,
            revenue: item.total,
            cost: itemCost,
            gross_profit: 0,
            profit_margin: 0,
          });
        }
      }
      
      // Calculate profit and margin
      const results = Array.from(productMap.values()).map((p) => ({
        ...p,
        gross_profit: p.revenue - p.cost,
        profit_margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
      }));
      
      // Sort by margin descending
      results.sort((a, b) => b.profit_margin - a.profit_margin);
      
      // Limit results
      return filters.limit ? results.slice(0, filters.limit) : results;
    },
    enabled: !!currentTenant?.id,
  });
}

// Hook for product revenue ranking
export function useProductRevenueReport(filters: ReportFilters) {
  const { currentTenant } = useTenant();
  
  return useQuery({
    queryKey: ["report-product-revenue", currentTenant?.id, filters.startDate, filters.endDate, filters.category, filters.limit],
    queryFn: async (): Promise<ProductProfitReport[]> => {
      if (!currentTenant?.id) return [];
      
      const startStr = format(startOfDay(filters.startDate), "yyyy-MM-dd'T'HH:mm:ss");
      const endStr = format(endOfDay(filters.endDate), "yyyy-MM-dd'T'HH:mm:ss");
      
      const { data: sales } = await supabase
        .from("sales")
        .select("id")
        .eq("tenant_id", currentTenant.id)
        .gte("datetime", startStr)
        .lte("datetime", endStr);
      
      if (!sales || sales.length === 0) return [];
      
      const saleIds = sales.map((s) => s.id);
      
      const { data: items } = await supabase
        .from("sale_items")
        .select(`
          quantity,
          total,
          product_id,
          products:product_id (
            name,
            category,
            cost_price,
            weighted_avg_cost
          )
        `)
        .in("sale_id", saleIds);
      
      if (!items) return [];
      
      const productMap = new Map<string, ProductProfitReport>();
      
      for (const item of items) {
        const product = item.products as any;
        if (!product) continue;
        if (filters.category && product.category !== filters.category) continue;
        
        const costPrice = product.weighted_avg_cost || product.cost_price || 0;
        const itemCost = item.quantity * costPrice;
        
        const existing = productMap.get(item.product_id);
        if (existing) {
          existing.quantity_sold += item.quantity;
          existing.revenue += item.total;
          existing.cost += itemCost;
        } else {
          productMap.set(item.product_id, {
            product_id: item.product_id,
            product_name: product.name,
            category: product.category,
            quantity_sold: item.quantity,
            revenue: item.total,
            cost: itemCost,
            gross_profit: 0,
            profit_margin: 0,
          });
        }
      }
      
      const results = Array.from(productMap.values()).map((p) => ({
        ...p,
        gross_profit: p.revenue - p.cost,
        profit_margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
      }));
      
      // Sort by revenue descending
      results.sort((a, b) => b.revenue - a.revenue);
      
      return filters.limit ? results.slice(0, filters.limit) : results;
    },
    enabled: !!currentTenant?.id,
  });
}

// Hook for category report
export function useCategoryReport(filters: ReportFilters) {
  const { currentTenant } = useTenant();
  
  return useQuery({
    queryKey: ["report-category", currentTenant?.id, filters.startDate, filters.endDate],
    queryFn: async (): Promise<CategoryReport[]> => {
      if (!currentTenant?.id) return [];
      
      const startStr = format(startOfDay(filters.startDate), "yyyy-MM-dd'T'HH:mm:ss");
      const endStr = format(endOfDay(filters.endDate), "yyyy-MM-dd'T'HH:mm:ss");
      
      const { data: sales } = await supabase
        .from("sales")
        .select("id")
        .eq("tenant_id", currentTenant.id)
        .gte("datetime", startStr)
        .lte("datetime", endStr);
      
      if (!sales || sales.length === 0) return [];
      
      const saleIds = sales.map((s) => s.id);
      
      const { data: items } = await supabase
        .from("sale_items")
        .select(`
          quantity,
          total,
          products:product_id (
            id,
            category
          )
        `)
        .in("sale_id", saleIds);
      
      if (!items) return [];
      
      const categoryMap = new Map<string, { products: Set<string>; quantity: number; revenue: number }>();
      let totalRevenue = 0;
      
      for (const item of items) {
        const product = item.products as any;
        if (!product) continue;
        
        const category = product.category || "Sem Categoria";
        totalRevenue += item.total;
        
        const existing = categoryMap.get(category);
        if (existing) {
          existing.products.add(product.id);
          existing.quantity += item.quantity;
          existing.revenue += item.total;
        } else {
          categoryMap.set(category, {
            products: new Set([product.id]),
            quantity: item.quantity,
            revenue: item.total,
          });
        }
      }
      
      const results: CategoryReport[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        product_count: data.products.size,
        quantity_sold: data.quantity,
        revenue: data.revenue,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      }));
      
      results.sort((a, b) => b.revenue - a.revenue);
      
      return results;
    },
    enabled: !!currentTenant?.id,
  });
}

// Hook for payment method report
export function usePaymentMethodReport(filters: ReportFilters) {
  const { currentTenant } = useTenant();
  
  return useQuery({
    queryKey: ["report-payment-method", currentTenant?.id, filters.startDate, filters.endDate],
    queryFn: async (): Promise<PaymentMethodReport[]> => {
      if (!currentTenant?.id) return [];
      
      const startStr = format(startOfDay(filters.startDate), "yyyy-MM-dd'T'HH:mm:ss");
      const endStr = format(endOfDay(filters.endDate), "yyyy-MM-dd'T'HH:mm:ss");
      
      const { data: sales, error } = await supabase
        .from("sales")
        .select("id, payment_method, net_total")
        .eq("tenant_id", currentTenant.id)
        .gte("datetime", startStr)
        .lte("datetime", endStr);
      
      if (error) throw error;
      if (!sales || sales.length === 0) return [];
      
      const methodMap = new Map<string, { count: number; total: number }>();
      let grandTotal = 0;
      
      for (const sale of sales) {
        grandTotal += sale.net_total;
        
        const existing = methodMap.get(sale.payment_method);
        if (existing) {
          existing.count += 1;
          existing.total += sale.net_total;
        } else {
          methodMap.set(sale.payment_method, {
            count: 1,
            total: sale.net_total,
          });
        }
      }
      
      const results: PaymentMethodReport[] = Array.from(methodMap.entries()).map(([method, data]) => ({
        payment_method: method,
        payment_label: PAYMENT_LABELS[method] || method,
        sale_count: data.count,
        total_amount: data.total,
        percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
      }));
      
      results.sort((a, b) => b.total_amount - a.total_amount);
      
      return results;
    },
    enabled: !!currentTenant?.id,
  });
}

// Hook for daily report
export function useDailyReport(filters: ReportFilters) {
  const { currentTenant } = useTenant();
  
  return useQuery({
    queryKey: ["report-daily", currentTenant?.id, filters.startDate, filters.endDate],
    queryFn: async (): Promise<DailyReport[]> => {
      if (!currentTenant?.id) return [];
      
      const startStr = format(startOfDay(filters.startDate), "yyyy-MM-dd'T'HH:mm:ss");
      const endStr = format(endOfDay(filters.endDate), "yyyy-MM-dd'T'HH:mm:ss");
      
      const { data: sales } = await supabase
        .from("sales")
        .select("id, datetime, gross_total, discount_total, net_total")
        .eq("tenant_id", currentTenant.id)
        .gte("datetime", startStr)
        .lte("datetime", endStr);
      
      if (!sales || sales.length === 0) return [];
      
      // Get sale items for cost calculation
      const saleIds = sales.map((s) => s.id);
      const { data: items } = await supabase
        .from("sale_items")
        .select(`
          sale_id,
          quantity,
          products:product_id (
            cost_price,
            weighted_avg_cost
          )
        `)
        .in("sale_id", saleIds);
      
      // Calculate cost per sale
      const saleCostMap = new Map<string, number>();
      if (items) {
        for (const item of items) {
          const product = item.products as any;
          const costPrice = product?.weighted_avg_cost || product?.cost_price || 0;
          const itemCost = item.quantity * costPrice;
          
          const existing = saleCostMap.get(item.sale_id) || 0;
          saleCostMap.set(item.sale_id, existing + itemCost);
        }
      }
      
      // Aggregate by date
      const dayMap = new Map<string, DailyReport>();
      
      for (const sale of sales) {
        const dateKey = format(new Date(sale.datetime), "yyyy-MM-dd");
        const cost = saleCostMap.get(sale.id) || 0;
        
        const existing = dayMap.get(dateKey);
        if (existing) {
          existing.sale_count += 1;
          existing.gross_total += sale.gross_total;
          existing.discount_total += sale.discount_total || 0;
          existing.net_total += sale.net_total;
          existing.cost += cost;
        } else {
          dayMap.set(dateKey, {
            date: dateKey,
            sale_count: 1,
            gross_total: sale.gross_total,
            discount_total: sale.discount_total || 0,
            net_total: sale.net_total,
            cost,
            profit: 0,
          });
        }
      }
      
      const results = Array.from(dayMap.values()).map((d) => ({
        ...d,
        profit: d.net_total - d.cost,
      }));
      
      results.sort((a, b) => a.date.localeCompare(b.date));
      
      return results;
    },
    enabled: !!currentTenant?.id,
  });
}

// Hook for DRE (simplified income statement)
export function useDREReport(filters: ReportFilters) {
  const { currentTenant } = useTenant();
  
  return useQuery({
    queryKey: ["report-dre", currentTenant?.id, filters.startDate, filters.endDate],
    queryFn: async (): Promise<DREReport> => {
      if (!currentTenant?.id) {
        return {
          grossRevenue: 0,
          discounts: 0,
          netRevenue: 0,
          costOfGoodsSold: 0,
          grossProfit: 0,
          grossMargin: 0,
        };
      }
      
      const startStr = format(startOfDay(filters.startDate), "yyyy-MM-dd'T'HH:mm:ss");
      const endStr = format(endOfDay(filters.endDate), "yyyy-MM-dd'T'HH:mm:ss");
      
      const { data: sales } = await supabase
        .from("sales")
        .select("id, gross_total, discount_total, net_total")
        .eq("tenant_id", currentTenant.id)
        .gte("datetime", startStr)
        .lte("datetime", endStr);
      
      if (!sales || sales.length === 0) {
        return {
          grossRevenue: 0,
          discounts: 0,
          netRevenue: 0,
          costOfGoodsSold: 0,
          grossProfit: 0,
          grossMargin: 0,
        };
      }
      
      const saleIds = sales.map((s) => s.id);
      const { data: items } = await supabase
        .from("sale_items")
        .select(`
          quantity,
          products:product_id (
            cost_price,
            weighted_avg_cost
          )
        `)
        .in("sale_id", saleIds);
      
      // Calculate totals
      let grossRevenue = 0;
      let discounts = 0;
      let netRevenue = 0;
      
      for (const sale of sales) {
        grossRevenue += sale.gross_total;
        discounts += sale.discount_total || 0;
        netRevenue += sale.net_total;
      }
      
      // Calculate CMV
      let costOfGoodsSold = 0;
      if (items) {
        for (const item of items) {
          const product = item.products as any;
          const costPrice = product?.weighted_avg_cost || product?.cost_price || 0;
          costOfGoodsSold += item.quantity * costPrice;
        }
      }
      
      const grossProfit = netRevenue - costOfGoodsSold;
      const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
      
      return {
        grossRevenue,
        discounts,
        netRevenue,
        costOfGoodsSold,
        grossProfit,
        grossMargin,
      };
    },
    enabled: !!currentTenant?.id,
  });
}

// Hook to get available categories
export function useCategories() {
  const { currentTenant } = useTenant();
  
  return useQuery({
    queryKey: ["categories", currentTenant?.id],
    queryFn: async (): Promise<string[]> => {
      if (!currentTenant?.id) return [];
      
      const { data } = await supabase
        .from("products")
        .select("category")
        .eq("tenant_id", currentTenant.id)
        .not("category", "is", null);
      
      if (!data) return [];
      
      const categories = new Set(data.map((p) => p.category as string));
      return Array.from(categories).sort();
    },
    enabled: !!currentTenant?.id,
  });
}

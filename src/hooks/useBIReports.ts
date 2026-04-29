import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { format, startOfDay, endOfDay, subMonths, startOfMonth, endOfMonth } from "date-fns";

// =====================================================
// Sales — Hourly breakdown (heatmap of peak times)
// =====================================================
export interface HourlyReport {
  hour: number;
  sale_count: number;
  total: number;
}

export function useHourlyReport(start: Date, end: Date) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["report-hourly", currentTenant?.id, start, end],
    queryFn: async (): Promise<HourlyReport[]> => {
      if (!currentTenant?.id) return [];
      const { data } = await supabase
        .from("sales")
        .select("datetime, net_total")
        .eq("tenant_id", currentTenant.id)
        .gte("datetime", format(startOfDay(start), "yyyy-MM-dd'T'HH:mm:ss"))
        .lte("datetime", format(endOfDay(end), "yyyy-MM-dd'T'HH:mm:ss"));

      const map = new Map<number, { count: number; total: number }>();
      for (let h = 0; h < 24; h++) map.set(h, { count: 0, total: 0 });

      (data || []).forEach((s) => {
        const h = new Date(s.datetime).getHours();
        const v = map.get(h)!;
        v.count += 1;
        v.total += Number(s.net_total) || 0;
      });

      return Array.from(map.entries()).map(([hour, v]) => ({
        hour,
        sale_count: v.count,
        total: v.total,
      }));
    },
    enabled: !!currentTenant?.id,
  });
}

// =====================================================
// Sales — History list (paginated table source)
// =====================================================
export interface SaleRow {
  id: string;
  datetime: string;
  net_total: number;
  payment_method: string;
  item_count: number;
  operator_name: string | null;
  customer_name: string | null;
}

export function useSalesHistory(start: Date, end: Date) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["report-sales-history", currentTenant?.id, start, end],
    queryFn: async (): Promise<SaleRow[]> => {
      if (!currentTenant?.id) return [];

      const { data: sales } = await supabase
        .from("sales")
        .select("id, datetime, net_total, payment_method, user_id, customer_id")
        .eq("tenant_id", currentTenant.id)
        .gte("datetime", format(startOfDay(start), "yyyy-MM-dd'T'HH:mm:ss"))
        .lte("datetime", format(endOfDay(end), "yyyy-MM-dd'T'HH:mm:ss"))
        .order("datetime", { ascending: false })
        .limit(1000);

      if (!sales || sales.length === 0) return [];

      const saleIds = sales.map((s) => s.id);
      const customerIds = Array.from(new Set(sales.map((s) => s.customer_id).filter(Boolean))) as string[];

      const [{ data: items }, { data: customers }, { data: members }] = await Promise.all([
        supabase.from("sale_items").select("sale_id, quantity").in("sale_id", saleIds),
        customerIds.length
          ? supabase.from("customers").select("id, name").in("id", customerIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.rpc("get_tenant_members", { p_tenant_id: currentTenant.id }).then((r) => r).catch(() => ({ data: [] as any[] })),
      ]);

      const itemCounts = new Map<string, number>();
      (items || []).forEach((it: any) => {
        itemCounts.set(it.sale_id, (itemCounts.get(it.sale_id) || 0) + 1);
      });

      const customerMap = new Map<string, string>();
      (customers || []).forEach((c: any) => customerMap.set(c.id, c.name));

      const memberMap = new Map<string, string>();
      ((members as any) || []).forEach((m: any) => memberMap.set(m.user_id, m.email || ""));

      return sales.map((s) => ({
        id: s.id,
        datetime: s.datetime,
        net_total: Number(s.net_total) || 0,
        payment_method: s.payment_method,
        item_count: itemCounts.get(s.id) || 0,
        operator_name: s.user_id ? memberMap.get(s.user_id) || null : null,
        customer_name: s.customer_id ? customerMap.get(s.customer_id) || null : null,
      }));
    },
    enabled: !!currentTenant?.id,
  });
}

// =====================================================
// Stock — Current stock + valuation
// =====================================================
export interface StockRow {
  id: string;
  name: string;
  category: string | null;
  stock_current: number;
  min_stock: number | null;
  unit_cost: number;
  total_value: number;
  below_min: boolean;
}

export function useStockReport() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["report-stock", currentTenant?.id],
    queryFn: async (): Promise<StockRow[]> => {
      if (!currentTenant?.id) return [];
      const { data } = await supabase
        .from("products")
        .select("id, name, category, stock_current, min_stock, cost_price, weighted_avg_cost")
        .eq("tenant_id", currentTenant.id)
        .eq("active", true);

      return (data || []).map((p: any) => {
        const cost = Number(p.weighted_avg_cost ?? p.cost_price ?? 0);
        const stock = Number(p.stock_current ?? 0);
        const min = p.min_stock != null ? Number(p.min_stock) : null;
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          stock_current: stock,
          min_stock: min,
          unit_cost: cost,
          total_value: stock * cost,
          below_min: min != null && stock < min,
        };
      });
    },
    enabled: !!currentTenant?.id,
  });
}

// Stock distribution by category (for donut chart)
export function useStockByCategory() {
  const { data: stock = [] } = useStockReport();
  const map = new Map<string, number>();
  stock.forEach((p) => {
    const cat = p.category || "Sem Categoria";
    map.set(cat, (map.get(cat) || 0) + p.total_value);
  });
  return Array.from(map.entries()).map(([category, value]) => ({ category, value }));
}

// Products without movement in period
export function useProductsWithoutMovement(start: Date, end: Date) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["report-no-movement", currentTenant?.id, start, end],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const startStr = format(startOfDay(start), "yyyy-MM-dd'T'HH:mm:ss");
      const endStr = format(endOfDay(end), "yyyy-MM-dd'T'HH:mm:ss");

      const [{ data: products }, { data: sales }] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, category, stock_current")
          .eq("tenant_id", currentTenant.id)
          .eq("active", true),
        supabase
          .from("sales")
          .select("id")
          .eq("tenant_id", currentTenant.id)
          .gte("datetime", startStr)
          .lte("datetime", endStr),
      ]);

      const saleIds = (sales || []).map((s) => s.id);
      if (saleIds.length === 0) return products || [];

      const { data: items } = await supabase
        .from("sale_items")
        .select("product_id")
        .in("sale_id", saleIds);

      const sold = new Set((items || []).map((i: any) => i.product_id));
      return (products || []).filter((p) => !sold.has(p.id));
    },
    enabled: !!currentTenant?.id,
  });
}

// =====================================================
// Financial — KPIs + monthly comparison + accounts lists
// =====================================================
export interface FinancialKPI {
  income: number;
  expense: number;
  profit: number;
  margin: number;
}

export function useFinancialKPIs(start: Date, end: Date) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["report-financial-kpi", currentTenant?.id, start, end],
    queryFn: async (): Promise<FinancialKPI> => {
      if (!currentTenant?.id) return { income: 0, expense: 0, profit: 0, margin: 0 };
      const { data } = await supabase
        .from("financial_entries")
        .select("type, amount")
        .eq("tenant_id", currentTenant.id)
        .gte("entry_date", format(start, "yyyy-MM-dd"))
        .lte("entry_date", format(end, "yyyy-MM-dd"));

      let income = 0, expense = 0;
      (data || []).forEach((e: any) => {
        const a = Number(e.amount) || 0;
        if (e.type === "income") income += a;
        else expense += a;
      });
      const profit = income - expense;
      const margin = income > 0 ? (profit / income) * 100 : 0;
      return { income, expense, profit, margin };
    },
    enabled: !!currentTenant?.id,
  });
}

export interface MonthlyFinancial {
  month: string; // yyyy-MM
  label: string; // Jan, Fev...
  income: number;
  expense: number;
}

export function useMonthlyFinancial(months = 6) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["report-monthly-financial", currentTenant?.id, months],
    queryFn: async (): Promise<MonthlyFinancial[]> => {
      if (!currentTenant?.id) return [];
      const start = startOfMonth(subMonths(new Date(), months - 1));
      const end = endOfMonth(new Date());

      const { data } = await supabase
        .from("financial_entries")
        .select("entry_date, type, amount")
        .eq("tenant_id", currentTenant.id)
        .gte("entry_date", format(start, "yyyy-MM-dd"))
        .lte("entry_date", format(end, "yyyy-MM-dd"));

      const map = new Map<string, { income: number; expense: number }>();
      const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

      for (let i = months - 1; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const key = format(d, "yyyy-MM");
        map.set(key, { income: 0, expense: 0 });
      }

      (data || []).forEach((e: any) => {
        const key = format(new Date(e.entry_date), "yyyy-MM");
        const v = map.get(key);
        if (!v) return;
        const a = Number(e.amount) || 0;
        if (e.type === "income") v.income += a;
        else v.expense += a;
      });

      return Array.from(map.entries()).map(([month, v]) => {
        const m = Number(month.split("-")[1]) - 1;
        return { month, label: labels[m], income: v.income, expense: v.expense };
      });
    },
    enabled: !!currentTenant?.id,
  });
}

export function useOverdueReceivables() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["report-overdue-receivables", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("accounts")
        .select("id, description, party_name, amount, due_date, status")
        .eq("tenant_id", currentTenant.id)
        .eq("type", "receber")
        .neq("status", "paga")
        .neq("status", "cancelada")
        .lt("due_date", today)
        .order("due_date", { ascending: true });
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useUpcomingPayables() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["report-upcoming-payables", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const today = format(new Date(), "yyyy-MM-dd");
      const in30 = format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd");
      const { data } = await supabase
        .from("accounts")
        .select("id, description, party_name, amount, due_date, status")
        .eq("tenant_id", currentTenant.id)
        .eq("type", "pagar")
        .eq("status", "aberta")
        .gte("due_date", today)
        .lte("due_date", in30)
        .order("due_date", { ascending: true });
      return data || [];
    },
    enabled: !!currentTenant?.id,
  });
}

// =====================================================
// Customers — KPIs and rankings
// =====================================================
export interface CustomerKPI {
  total_customers: number;
  new_in_period: number;
  active_in_period: number;
  avg_ticket: number;
}

export function useCustomerKPIs(start: Date, end: Date) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["report-customer-kpi", currentTenant?.id, start, end],
    queryFn: async (): Promise<CustomerKPI> => {
      if (!currentTenant?.id) {
        return { total_customers: 0, new_in_period: 0, active_in_period: 0, avg_ticket: 0 };
      }
      const startStr = format(startOfDay(start), "yyyy-MM-dd'T'HH:mm:ss");
      const endStr = format(endOfDay(end), "yyyy-MM-dd'T'HH:mm:ss");

      const [{ count: totalCount }, { data: newCustomers }, { data: sales }] = await Promise.all([
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", currentTenant.id),
        supabase
          .from("customers")
          .select("id")
          .eq("tenant_id", currentTenant.id)
          .gte("created_at", startStr)
          .lte("created_at", endStr),
        supabase
          .from("sales")
          .select("customer_id, net_total")
          .eq("tenant_id", currentTenant.id)
          .not("customer_id", "is", null)
          .gte("datetime", startStr)
          .lte("datetime", endStr),
      ]);

      const activeIds = new Set((sales || []).map((s: any) => s.customer_id));
      const totals = new Map<string, number>();
      (sales || []).forEach((s: any) => {
        totals.set(s.customer_id, (totals.get(s.customer_id) || 0) + Number(s.net_total));
      });
      const sumTotals = Array.from(totals.values()).reduce((a, b) => a + b, 0);
      const avg = activeIds.size > 0 ? sumTotals / activeIds.size : 0;

      return {
        total_customers: totalCount || 0,
        new_in_period: (newCustomers || []).length,
        active_in_period: activeIds.size,
        avg_ticket: avg,
      };
    },
    enabled: !!currentTenant?.id,
  });
}

export interface TopCustomer {
  id: string;
  name: string;
  purchase_count: number;
  total_spent: number;
  last_purchase: string | null;
}

export function useTopCustomers(start: Date, end: Date) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["report-top-customers", currentTenant?.id, start, end],
    queryFn: async (): Promise<TopCustomer[]> => {
      if (!currentTenant?.id) return [];
      const { data: sales } = await supabase
        .from("sales")
        .select("customer_id, net_total, datetime")
        .eq("tenant_id", currentTenant.id)
        .not("customer_id", "is", null)
        .gte("datetime", format(startOfDay(start), "yyyy-MM-dd'T'HH:mm:ss"))
        .lte("datetime", format(endOfDay(end), "yyyy-MM-dd'T'HH:mm:ss"));

      if (!sales || sales.length === 0) return [];

      const map = new Map<string, { count: number; total: number; last: string }>();
      sales.forEach((s: any) => {
        const ex = map.get(s.customer_id);
        if (ex) {
          ex.count += 1;
          ex.total += Number(s.net_total);
          if (s.datetime > ex.last) ex.last = s.datetime;
        } else {
          map.set(s.customer_id, {
            count: 1,
            total: Number(s.net_total),
            last: s.datetime,
          });
        }
      });

      const ids = Array.from(map.keys());
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", ids);

      const nameMap = new Map((customers || []).map((c: any) => [c.id, c.name]));

      return ids
        .map((id) => {
          const v = map.get(id)!;
          return {
            id,
            name: nameMap.get(id) || "—",
            purchase_count: v.count,
            total_spent: v.total,
            last_purchase: v.last,
          };
        })
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 20);
    },
    enabled: !!currentTenant?.id,
  });
}

export function useInactiveCustomers(daysInactive: number) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["report-inactive-customers", currentTenant?.id, daysInactive],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const cutoff = new Date(Date.now() - daysInactive * 86400000);

      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, phone, email, created_at")
        .eq("tenant_id", currentTenant.id);

      if (!customers || customers.length === 0) return [];

      const { data: recentSales } = await supabase
        .from("sales")
        .select("customer_id, datetime")
        .eq("tenant_id", currentTenant.id)
        .not("customer_id", "is", null)
        .gte("datetime", cutoff.toISOString());

      const recentIds = new Set((recentSales || []).map((s: any) => s.customer_id));

      // Fetch last purchase date for each customer
      const { data: allSales } = await supabase
        .from("sales")
        .select("customer_id, datetime")
        .eq("tenant_id", currentTenant.id)
        .not("customer_id", "is", null)
        .order("datetime", { ascending: false });

      const lastByCustomer = new Map<string, string>();
      (allSales || []).forEach((s: any) => {
        if (!lastByCustomer.has(s.customer_id)) {
          lastByCustomer.set(s.customer_id, s.datetime);
        }
      });

      return customers
        .filter((c: any) => !recentIds.has(c.id))
        .map((c: any) => ({
          ...c,
          last_purchase: lastByCustomer.get(c.id) || null,
        }))
        .sort((a: any, b: any) => {
          if (!a.last_purchase) return 1;
          if (!b.last_purchase) return -1;
          return b.last_purchase.localeCompare(a.last_purchase);
        });
    },
    enabled: !!currentTenant?.id,
  });
}

// =====================================================
// Operators — Performance per cashier/user
// =====================================================
export interface OperatorReport {
  user_id: string;
  name: string;
  sale_count: number;
  total_sold: number;
  avg_ticket: number;
}

export function useOperatorReport(start: Date, end: Date) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["report-operators", currentTenant?.id, start, end],
    queryFn: async (): Promise<OperatorReport[]> => {
      if (!currentTenant?.id) return [];
      const { data: sales } = await supabase
        .from("sales")
        .select("user_id, net_total")
        .eq("tenant_id", currentTenant.id)
        .gte("datetime", format(startOfDay(start), "yyyy-MM-dd'T'HH:mm:ss"))
        .lte("datetime", format(endOfDay(end), "yyyy-MM-dd'T'HH:mm:ss"));

      if (!sales || sales.length === 0) return [];

      const map = new Map<string, { count: number; total: number }>();
      sales.forEach((s: any) => {
        const id = s.user_id || "—";
        const ex = map.get(id);
        if (ex) {
          ex.count += 1;
          ex.total += Number(s.net_total);
        } else {
          map.set(id, { count: 1, total: Number(s.net_total) });
        }
      });

      let memberMap = new Map<string, string>();
      try {
        const { data: members } = await supabase.rpc("get_tenant_members", {
          p_tenant_id: currentTenant.id,
        });
        memberMap = new Map(((members as any) || []).map((m: any) => [m.user_id, m.email || ""]));
      } catch {
        // not admin — skip member resolution
      }

      return Array.from(map.entries())
        .map(([user_id, v]) => ({
          user_id,
          name: memberMap.get(user_id) || (user_id === "—" ? "Sem operador" : "Operador"),
          sale_count: v.count,
          total_sold: v.total,
          avg_ticket: v.count > 0 ? v.total / v.count : 0,
        }))
        .sort((a, b) => b.total_sold - a.total_sold);
    },
    enabled: !!currentTenant?.id,
  });
}

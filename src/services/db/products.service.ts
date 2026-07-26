import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchTerm } from "@/lib/error-handler";

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  internal_code: string | null;
  barcode: string | null;
  category: string | null;
  sale_price: number;
  cost_price: number | null;
  stock_current: number;
  unit: string;
  min_stock: number | null;
  active: boolean;
  extra_attributes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  name: string;
  internal_code?: string | null;
  barcode?: string | null;
  category?: string | null;
  sale_price: number;
  cost_price?: number | null;
  stock_current?: number;
  unit?: string;
  min_stock?: number | null;
  active?: boolean;
  extra_attributes?: Record<string, unknown>;
}

export const productsService = {
  async getProducts(tenantId: string, searchTerm?: string): Promise<Product[]> {
    let query = supabase
      .from("products")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name");

    if (searchTerm) {
      const sanitized = sanitizeSearchTerm(searchTerm);
      query = query.or(
        `name.ilike.%${sanitized}%,internal_code.ilike.%${sanitized}%,barcode.ilike.%${sanitized}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Product[];
  },

  async getProductById(id: string, tenantId: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) throw error;
    return data as Product | null;
  },

  async createProduct(tenantId: string, input: ProductInput) {
    const { data, error } = await supabase
      .from("products")
      .insert({
        name: input.name,
        sale_price: input.sale_price,
        tenant_id: tenantId,
        internal_code: input.internal_code,
        barcode: input.barcode,
        category: input.category,
        cost_price: input.cost_price,
        stock_current: input.stock_current,
        unit: input.unit,
        min_stock: input.min_stock,
        active: input.active,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProduct(id: string, input: ProductInput) {
    const { data, error } = await supabase
      .from("products")
      .update({
        name: input.name,
        sale_price: input.sale_price,
        internal_code: input.internal_code,
        barcode: input.barcode,
        category: input.category,
        cost_price: input.cost_price,
        stock_current: input.stock_current,
        unit: input.unit,
        min_stock: input.min_stock,
        active: input.active,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
  },

  async getLowStockProducts(tenantId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .not("min_stock", "is", null)
      .order("name");

    if (error) throw error;
    return data as Product[];
  },

  async bulkUpdateProductActive(ids: string[], active: boolean) {
    const { data, error } = await supabase
      .from("products")
      .update({ active })
      .in("id", ids);

    if (error) throw error;
    return data;
  }
};

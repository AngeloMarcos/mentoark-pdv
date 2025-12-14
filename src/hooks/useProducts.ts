import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { ProductInputSchema, validateInput } from "@/lib/validations";
import { getUserFriendlyError, sanitizeSearchTerm } from "@/lib/error-handler";

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

export function useProducts(searchTerm?: string) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["products", currentTenant?.id, searchTerm],
    queryFn: async () => {
      if (!currentTenant) return [];

      let query = supabase
        .from("products")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("name");

      if (searchTerm) {
        // Sanitize search input to prevent SQL wildcard manipulation
        const sanitized = sanitizeSearchTerm(searchTerm);
        query = query.or(
          `name.ilike.%${sanitized}%,internal_code.ilike.%${sanitized}%,barcode.ilike.%${sanitized}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!currentTenant,
  });
}

export function useProduct(id: string | undefined) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      if (!id || !currentTenant) return null;

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      return data as Product | null;
    },
    enabled: !!id && !!currentTenant,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: ProductInput) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      // Validate input
      validateInput(ProductInputSchema, input);

      const { data, error } = await supabase
        .from("products")
        .insert({
          name: input.name,
          sale_price: input.sale_price,
          tenant_id: currentTenant.id,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto criado com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: ProductInput & { id: string }) => {
      // Validate input
      validateInput(ProductInputSchema, input);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto excluído com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useLowStockProducts() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["products", "low-stock", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .eq("active", true)
        .not("min_stock", "is", null)
        .order("name");

      if (error) throw error;
      
      // Filter products where stock_current < min_stock
      return (data as Product[]).filter(
        (p) => p.min_stock !== null && p.stock_current < p.min_stock
      );
    },
    enabled: !!currentTenant,
  });
}
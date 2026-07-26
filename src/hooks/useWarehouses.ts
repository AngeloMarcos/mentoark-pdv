import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface Warehouse {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  address: string | null;
  is_default: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useWarehouses() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["warehouses", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as Warehouse[];
    },
    enabled: !!currentTenant,
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  return useMutation({
    mutationFn: async (input: { code: string; name: string; address?: string; is_default?: boolean }) => {
      if (!currentTenant) throw new Error("Sem empresa selecionada");
      const { data, error } = await supabase
        .from("warehouses")
        .insert({ tenant_id: currentTenant.id, ...input })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Depósito criado");
    },
    onError: (e: any) => toast.error(getUserFriendlyError(e)),
  });
}

export function useUpdateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<Warehouse> & { id: string }) => {
      const { error } = await supabase.from("warehouses").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Depósito atualizado");
    },
    onError: (e: any) => toast.error(getUserFriendlyError(e)),
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warehouses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Depósito removido");
    },
    onError: (e: any) => toast.error(getUserFriendlyError(e)),
  });
}

export function useTransferStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      from_warehouse_id: string;
      to_warehouse_id: string;
      product_id: string;
      quantity: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc("transfer_stock", {
        _from_warehouse: input.from_warehouse_id,
        _to_warehouse: input.to_warehouse_id,
        _product_id: input.product_id,
        _quantity: input.quantity,
        _notes: input.notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock_by_warehouse"] });
      qc.invalidateQueries({ queryKey: ["stock_transfers"] });
      toast.success("Transferência concluída");
    },
    onError: (e: any) => toast.error(getUserFriendlyError(e)),
  });
}

export function useStockByWarehouse(warehouseId?: string) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["stock_by_warehouse", currentTenant?.id, warehouseId],
    queryFn: async () => {
      if (!currentTenant) return [];
      let q = supabase
        .from("stock_by_warehouse")
        .select("*, products:product_id(name, unit), warehouses:warehouse_id(name, code)")
        .eq("tenant_id", currentTenant.id);
      if (warehouseId) q = q.eq("warehouse_id", warehouseId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!currentTenant,
  });
}

export function useStockTransfers() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["stock_transfers", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      const { data, error } = await supabase
        .from("stock_transfers")
        .select("*, products:product_id(name), from:from_warehouse_id(name), to:to_warehouse_id(name)")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!currentTenant,
  });
}

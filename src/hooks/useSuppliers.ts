import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  fantasy_name: string | null;
  document: string | null;
  state_registration: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  pix_key: string | null;
  category: string | null;
  due_days: number;
  payment_terms: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierInput {
  name: string;
  fantasy_name?: string | null;
  document?: string | null;
  state_registration?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  zip_code?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  bank_name?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  pix_key?: string | null;
  category?: string | null;
  due_days?: number;
  payment_terms?: string | null;
  notes?: string | null;
  active?: boolean;
}

/**
 * Basic supplier list (no bank / PIX fields). Accessible to any tenant member
 * via a SECURITY DEFINER RPC. Use this for dropdowns and non-admin views.
 */
export function useSuppliers(includeInactive = false) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["suppliers-basic", currentTenant?.id, includeInactive],
    queryFn: async () => {
      if (!currentTenant) return [];
      const { data, error } = await supabase.rpc("list_suppliers_basic" as any, {
        p_tenant_id: currentTenant.id,
      });
      if (error) throw error;
      const rows = (data ?? []) as Array<Partial<Supplier>>;
      const filtered = includeInactive ? rows : rows.filter((r) => r.active);
      return filtered.sort((a, b) => (a.name || "").localeCompare(b.name || "")) as Supplier[];
    },
    enabled: !!currentTenant,
  });
}

/**
 * Full supplier rows (including bank details). Restricted to admins by RLS.
 * Use this in supplier management screens.
 */
export function useSuppliersFull(includeInactive = false) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["suppliers-full", currentTenant?.id, includeInactive],
    queryFn: async () => {
      if (!currentTenant) return [];
      let query = supabase
        .from("suppliers")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("name");
      if (!includeInactive) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!currentTenant,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: SupplierInput) => {
      if (!currentTenant) throw new Error("Sem empresa selecionada");
      const { data, error } = await supabase
        .from("suppliers")
        .insert({ ...input, tenant_id: currentTenant.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers-basic"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-full"] });
      toast.success("Fornecedor criado com sucesso!");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<SupplierInput> }) => {
      const { data, error } = await supabase
        .from("suppliers")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers-basic"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-full"] });
      toast.success("Fornecedor atualizado!");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers-basic"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-full"] });
      toast.success("Fornecedor excluído");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}

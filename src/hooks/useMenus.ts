import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { getUserFriendlyError } from '@/lib/error-handler';

export interface ProductionStation {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  active: boolean;
  display_order: number;
}

export interface Menu {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  active: boolean;
  available_from: string | null;
  available_to: string | null;
  display_order: number;
}

export interface MenuSection {
  id: string;
  tenant_id: string;
  menu_id: string;
  name: string;
  description: string | null;
  display_order: number;
  active: boolean;
}

export interface MenuItemOptionValue {
  id: string;
  option_id: string;
  name: string;
  price_delta: number;
  available: boolean;
  display_order: number;
}

export interface MenuItemOption {
  id: string;
  menu_item_id: string;
  name: string;
  min_select: number;
  max_select: number;
  required: boolean;
  display_order: number;
  values?: MenuItemOptionValue[];
}

export interface MenuItemRecipeRow {
  id: string;
  menu_item_id: string;
  product_id: string;
  quantity: number;
  product?: { id: string; name: string; cost_price: number | null; unit: string | null } | null;
}

export interface MenuItem {
  id: string;
  tenant_id: string;
  section_id: string;
  station_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  prep_minutes: number;
  available: boolean;
  active: boolean;
  display_order: number;
  options?: MenuItemOption[];
  recipe?: MenuItemRecipeRow[];
}

/* ---------------- Stations ---------------- */

export function useStations() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['production-stations', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('production_stations')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('display_order');
      if (error) throw error;
      return (data ?? []) as ProductionStation[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useSeedStations() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  return useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('Nenhuma empresa selecionada');
      const { error } = await supabase.rpc('seed_default_stations', { p_tenant_id: currentTenant.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-stations'] });
      toast.success('Praças de produção criadas');
    },
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

/* ---------------- Menus ---------------- */

export function useMenus() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['menus', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('menus')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('display_order');
      if (error) throw error;
      return (data ?? []) as Menu[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useSaveMenu() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  return useMutation({
    mutationFn: async (input: Partial<Menu> & { name: string }) => {
      if (!currentTenant?.id) throw new Error('Nenhuma empresa selecionada');
      if (input.id) {
        const { error } = await supabase
          .from('menus')
          .update({ name: input.name, description: input.description ?? null, active: input.active ?? true })
          .eq('id', input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase
        .from('menus')
        .insert({ tenant_id: currentTenant.id, name: input.name, description: input.description ?? null })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menus'] });
      toast.success('Cardápio salvo');
    },
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

export function useDeleteMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menus').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menus'] });
      toast.success('Cardápio excluído');
    },
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

/* ---------------- Sections ---------------- */

export function useMenuSections(menuId?: string) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['menu-sections', menuId],
    queryFn: async () => {
      if (!menuId || !currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('menu_sections')
        .select('*')
        .eq('menu_id', menuId)
        .order('display_order');
      if (error) throw error;
      return (data ?? []) as MenuSection[];
    },
    enabled: !!menuId && !!currentTenant?.id,
  });
}

export function useSaveSection() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  return useMutation({
    mutationFn: async (input: { id?: string; menu_id: string; name: string; display_order?: number }) => {
      if (!currentTenant?.id) throw new Error('Nenhuma empresa selecionada');
      if (input.id) {
        const { error } = await supabase
          .from('menu_sections')
          .update({ name: input.name, display_order: input.display_order ?? 0 })
          .eq('id', input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase
        .from('menu_sections')
        .insert({
          tenant_id: currentTenant.id,
          menu_id: input.menu_id,
          name: input.name,
          display_order: input.display_order ?? 0,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['menu-sections', v.menu_id] });
      toast.success('Seção salva');
    },
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

export function useDeleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_sections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-sections'] });
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      toast.success('Seção excluída');
    },
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

/* ---------------- Items ---------------- */

export function useMenuItems(menuId?: string) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ['menu-items', currentTenant?.id, menuId ?? 'all'],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      let query = supabase
        .from('menu_items')
        .select(
          `*,
           options:menu_item_options(*, values:menu_item_option_values(*)),
           recipe:menu_item_recipe(*, product:products(id, name, cost_price, unit)),
           section:menu_sections!inner(id, name, menu_id, display_order)`
        )
        .eq('tenant_id', currentTenant.id)
        .eq('active', true)
        .order('display_order');

      if (menuId) query = query.eq('menu_sections.menu_id', menuId);

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      return (menuId ? rows.filter((r) => r.section?.menu_id === menuId) : rows) as (MenuItem & {
        section?: { id: string; name: string; menu_id: string; display_order: number };
      })[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useSaveMenuItem() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  return useMutation({
    mutationFn: async (input: Partial<MenuItem> & { section_id: string; name: string; price: number }) => {
      if (!currentTenant?.id) throw new Error('Nenhuma empresa selecionada');
      const payload = {
        section_id: input.section_id,
        station_id: input.station_id || null,
        name: input.name,
        description: input.description ?? null,
        image_url: input.image_url ?? null,
        price: input.price,
        prep_minutes: input.prep_minutes ?? 15,
        available: input.available ?? true,
      };
      if (input.id) {
        const { error } = await supabase.from('menu_items').update(payload).eq('id', input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase
        .from('menu_items')
        .insert({ tenant_id: currentTenant.id, ...payload })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      toast.success('Item salvo');
    },
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

export function useToggleItemAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      const { error } = await supabase.from('menu_items').update({ available }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items'] }),
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

export function useDeleteMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      toast.success('Item excluído');
    },
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

/* ---------------- Options ---------------- */

export function useSaveOption() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  return useMutation({
    mutationFn: async (input: {
      menu_item_id: string;
      name: string;
      required: boolean;
      min_select: number;
      max_select: number;
      values: { name: string; price_delta: number }[];
    }) => {
      if (!currentTenant?.id) throw new Error('Nenhuma empresa selecionada');
      const { data, error } = await supabase
        .from('menu_item_options')
        .insert({
          tenant_id: currentTenant.id,
          menu_item_id: input.menu_item_id,
          name: input.name,
          required: input.required,
          min_select: input.min_select,
          max_select: input.max_select,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (input.values.length) {
        const { error: e2 } = await supabase.from('menu_item_option_values').insert(
          input.values.map((v, i) => ({
            tenant_id: currentTenant.id,
            option_id: data.id,
            name: v.name,
            price_delta: v.price_delta,
            display_order: i,
          }))
        );
        if (e2) throw e2;
      }
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      toast.success('Complemento adicionado');
    },
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

export function useDeleteOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_item_options').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items'] }),
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

/* ---------------- Recipe ---------------- */

export function useSaveRecipeRow() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  return useMutation({
    mutationFn: async (input: { menu_item_id: string; product_id: string; quantity: number }) => {
      if (!currentTenant?.id) throw new Error('Nenhuma empresa selecionada');
      const { error } = await supabase.from('menu_item_recipe').upsert(
        {
          tenant_id: currentTenant.id,
          menu_item_id: input.menu_item_id,
          product_id: input.product_id,
          quantity: input.quantity,
        },
        { onConflict: 'menu_item_id,product_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      toast.success('Ficha técnica atualizada');
    },
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

export function useDeleteRecipeRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_item_recipe').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items'] }),
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

export function recipeCost(item: Pick<MenuItem, 'recipe'>): number {
  return (item.recipe ?? []).reduce(
    (acc, r) => acc + Number(r.quantity) * Number(r.product?.cost_price ?? 0),
    0
  );
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { TableInputSchema, validateInput } from '@/lib/validations';
import { getUserFriendlyError } from '@/lib/error-handler';

export interface Table {
  id: string;
  tenant_id: string;
  number: string;
  name: string | null;
  capacity: number | null;
  status: 'available' | 'occupied' | 'reserved';
  created_at: string;
}

export interface TableInput {
  number: string;
  name?: string | null;
  capacity?: number | null;
}

export function useTables() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['tables', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('number');

      if (error) throw error;
      return data as Table[];
    },
    enabled: !!currentTenant?.id,
    refetchInterval: 15000,
  });
}

export function useCreateTable() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: TableInput) => {
      if (!currentTenant?.id) throw new Error('Nenhum tenant selecionado');

      // Validate input
      validateInput(TableInputSchema, input);

      const { data, error } = await supabase
        .from('tables')
        .insert({
          tenant_id: currentTenant.id,
          number: input.number,
          name: input.name || null,
          capacity: input.capacity || null,
          status: 'available',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Mesa criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useUpdateTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: TableInput & { id: string }) => {
      // Validate input
      validateInput(TableInputSchema, input);

      const { data, error } = await supabase
        .from('tables')
        .update({
          number: input.number,
          name: input.name || null,
          capacity: input.capacity || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Mesa atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useDeleteTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Mesa excluída com sucesso');
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useUpdateTableStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'available' | 'occupied' | 'reserved' }) => {
      const { data, error } = await supabase
        .from('tables')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}
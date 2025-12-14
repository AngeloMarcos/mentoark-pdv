import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

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
  name?: string;
  capacity?: number;
  status?: 'available' | 'occupied' | 'reserved';
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
  });
}

export function useCreateTable() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: TableInput) => {
      if (!currentTenant?.id) throw new Error('Nenhum tenant selecionado');

      const { data, error } = await supabase
        .from('tables')
        .insert({
          tenant_id: currentTenant.id,
          number: input.number,
          name: input.name || null,
          capacity: input.capacity || null,
          status: input.status || 'available',
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
      toast.error('Erro ao criar mesa: ' + error.message);
    },
  });
}

export function useUpdateTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<TableInput>) => {
      const { data, error } = await supabase
        .from('tables')
        .update({
          number: input.number,
          name: input.name,
          capacity: input.capacity,
          status: input.status,
        })
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
      toast.error('Erro ao atualizar mesa: ' + error.message);
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
      toast.error('Erro ao excluir mesa: ' + error.message);
    },
  });
}

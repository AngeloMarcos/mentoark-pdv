import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { ProductInputSchema, validateInput } from "@/lib/validations";
import { getUserFriendlyError } from "@/lib/error-handler";
import { productsService, Product, ProductInput } from "@/services/db/products.service";

import { useMemo } from "react";

export type { Product, ProductInput };

export function useProducts(searchTerm?: string) {
  const { currentTenant } = useTenant();

  const queryInfo = useQuery({
    // Removido searchTerm do queryKey para manter um único cache global da lista inteira
    queryKey: ["products", "list", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      // Busca todos os produtos do tenant, ignorando a busca por rede
      return await productsService.getProducts(currentTenant.id);
    },
    enabled: !!currentTenant,
    staleTime: 5 * 60 * 1000, // 5 minutos de cache (evita chamadas repetitivas no PDV)
  });

  // Função para realizar a filtragem em memória (sem rede)
  const searchProductsLocally = (term: string, list: Product[]): Product[] => {
    if (!term) return list;
    const lower = term.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.internal_code && p.internal_code.toLowerCase().includes(lower)) ||
        (p.barcode && p.barcode.toLowerCase().includes(lower))
    );
  };

  // Memorizamos o resultado para evitar re-renderizações desnecessárias
  const filteredData = useMemo(() => {
    return searchProductsLocally(searchTerm || "", queryInfo.data || []);
  }, [searchTerm, queryInfo.data]);

  return {
    ...queryInfo,
    data: filteredData,
    searchProductsLocally,
  };
}

export function useProduct(id: string | undefined) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      if (!id || !currentTenant) return null;
      return await productsService.getProductById(id, currentTenant.id);
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
      validateInput(ProductInputSchema, input);
      return await productsService.createProduct(currentTenant.id, input);
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
      validateInput(ProductInputSchema, input);
      return await productsService.updateProduct(id, input);
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
      await productsService.deleteProduct(id);
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
      const data = await productsService.getLowStockProducts(currentTenant.id);
      return data.filter((p) => p.min_stock !== null && p.stock_current < p.min_stock);
    },
    enabled: !!currentTenant,
  });
}

export function useBulkUpdateProductActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, active }: { ids: string[]; active: boolean }) => {
      return await productsService.bulkUpdateProductActive(ids, active);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`${variables.ids.length} produto(s) ${variables.active ? "ativado(s)" : "desativado(s)"}`);
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}
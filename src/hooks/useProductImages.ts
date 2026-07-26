import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export function useProductImages(productId?: string) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["product_images", currentTenant?.id, productId],
    queryFn: async () => {
      if (!currentTenant || !productId) return [];
      const { data, error } = await supabase
        .from("product_images")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .eq("product_id", productId)
        .order("position");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!currentTenant && !!productId,
  });
}

export function useUploadProductImage() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  return useMutation({
    mutationFn: async ({ productId, file }: { productId: string; file: File }) => {
      if (!currentTenant) throw new Error("Sem empresa");
      const path = `${currentTenant.id}/${productId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365);
      const { error } = await supabase.from("product_images").insert({
        tenant_id: currentTenant.id,
        product_id: productId,
        storage_path: path,
        public_url: signed?.signedUrl ?? null,
        is_primary: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_images"] });
      toast.success("Imagem enviada");
    },
    onError: (e: any) => toast.error(getUserFriendlyError(e)),
  });
}

export function useDeleteProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, storage_path }: { id: string; storage_path: string }) => {
      await supabase.storage.from("product-images").remove([storage_path]);
      const { error } = await supabase.from("product_images").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_images"] });
      toast.success("Imagem removida");
    },
    onError: (e: any) => toast.error(getUserFriendlyError(e)),
  });
}

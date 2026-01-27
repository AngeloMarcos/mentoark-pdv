import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface ProductBarcode {
  id: string;
  tenant_id: string;
  product_id: string;
  barcode: string;
  barcode_type: "EAN8" | "EAN13" | "INTERNAL";
  is_primary: boolean;
  created_at: string;
}

export interface BarcodeInput {
  product_id: string;
  barcode: string;
  barcode_type: "EAN8" | "EAN13" | "INTERNAL";
  is_primary?: boolean;
}

// Validação de dígito verificador EAN
export function validateEAN(barcode: string): boolean {
  const cleaned = barcode.trim();
  const len = cleaned.length;

  if (len !== 8 && len !== 13) return false;
  if (!/^\d+$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < len - 1; i++) {
    const digit = parseInt(cleaned[i], 10);
    if (len === 13) {
      sum += i % 2 === 0 ? digit : digit * 3;
    } else {
      sum += i % 2 === 0 ? digit * 3 : digit;
    }
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(cleaned[len - 1], 10);
}

// Gerar código interno com dígito verificador
export function generateInternalBarcode(): string {
  const base = Math.floor(Math.random() * 10000000)
    .toString()
    .padStart(7, "0");

  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const digit = parseInt(base[i], 10);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return base + checkDigit;
}

export function useProductBarcodes(productId?: string) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["barcodes", currentTenant?.id, productId],
    queryFn: async () => {
      if (!currentTenant) return [];

      let query = supabase
        .from("product_barcodes")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("is_primary", { ascending: false });

      if (productId) {
        query = query.eq("product_id", productId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProductBarcode[];
    },
    enabled: !!currentTenant,
  });
}

export function useFindByBarcode() {
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (barcode: string) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      // Primeiro tenta buscar na tabela de códigos de barras
      const { data: barcodeData, error: barcodeError } = await supabase
        .from("product_barcodes")
        .select(
          `
          *,
          products:product_id (*)
        `
        )
        .eq("tenant_id", currentTenant.id)
        .eq("barcode", barcode)
        .maybeSingle();

      if (barcodeError) throw barcodeError;

      if (barcodeData?.products) {
        return barcodeData.products;
      }

      // Fallback: busca no campo barcode do produto
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .eq("barcode", barcode)
        .maybeSingle();

      if (productError) throw productError;

      return productData;
    },
  });
}

export function useCreateBarcode() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: BarcodeInput) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      // Validação para EAN
      if (input.barcode_type !== "INTERNAL") {
        if (!validateEAN(input.barcode)) {
          throw new Error("Código de barras EAN inválido (dígito verificador incorreto)");
        }
      }

      // Se for primário, remove o primário anterior
      if (input.is_primary) {
        await supabase
          .from("product_barcodes")
          .update({ is_primary: false })
          .eq("tenant_id", currentTenant.id)
          .eq("product_id", input.product_id);
      }

      const { data, error } = await supabase
        .from("product_barcodes")
        .insert({
          tenant_id: currentTenant.id,
          product_id: input.product_id,
          barcode: input.barcode,
          barcode_type: input.barcode_type,
          is_primary: input.is_primary ?? false,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Este código de barras já está cadastrado");
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barcodes"] });
      toast.success("Código de barras cadastrado!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useDeleteBarcode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_barcodes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["barcodes"] });
      toast.success("Código de barras removido!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useGenerateInternalBarcode() {
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async () => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      // Tenta gerar um código único
      let attempts = 0;
      while (attempts < 10) {
        const code = generateInternalBarcode();

        // Verifica se já existe
        const { data } = await supabase
          .from("product_barcodes")
          .select("id")
          .eq("tenant_id", currentTenant.id)
          .eq("barcode", code)
          .maybeSingle();

        if (!data) {
          return code;
        }
        attempts++;
      }

      throw new Error("Não foi possível gerar um código único");
    },
  });
}

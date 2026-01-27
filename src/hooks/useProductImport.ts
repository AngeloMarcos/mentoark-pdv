import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";
import { Product } from "./useProducts";

export interface ImportProduct {
  name: string;
  internal_code?: string;
  barcode?: string;
  category?: string;
  sale_price: number;
  cost_price?: number;
  stock_current?: number;
  unit?: string;
  min_stock?: number;
  wholesale_price?: number;
  wholesale_min_qty?: number;
}

export interface ImportResult {
  created: number;
  updated: number;
  errors: string[];
}

export function parseCSV(csvText: string): ImportProduct[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(";").map((h) => h.trim().toLowerCase());
  const products: ImportProduct[] = [];

  const headerMap: Record<string, keyof ImportProduct> = {
    nome: "name",
    name: "name",
    codigo: "internal_code",
    internal_code: "internal_code",
    "codigo interno": "internal_code",
    "código interno": "internal_code",
    barcode: "barcode",
    "código de barras": "barcode",
    "codigo de barras": "barcode",
    categoria: "category",
    category: "category",
    "preço venda": "sale_price",
    "preco venda": "sale_price",
    sale_price: "sale_price",
    preco: "sale_price",
    preço: "sale_price",
    "preço custo": "cost_price",
    "preco custo": "cost_price",
    cost_price: "cost_price",
    custo: "cost_price",
    estoque: "stock_current",
    stock: "stock_current",
    stock_current: "stock_current",
    unidade: "unit",
    unit: "unit",
    "estoque mínimo": "min_stock",
    "estoque minimo": "min_stock",
    min_stock: "min_stock",
    "preço atacado": "wholesale_price",
    "preco atacado": "wholesale_price",
    wholesale_price: "wholesale_price",
    "qtd min atacado": "wholesale_min_qty",
    wholesale_min_qty: "wholesale_min_qty",
  };

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(";").map((v) => v.trim());
    if (values.length === 0 || (values.length === 1 && !values[0])) continue;

    const product: Partial<ImportProduct> = {};

    headers.forEach((header, index) => {
      const key = headerMap[header];
      if (!key || !values[index]) return;

      const value = values[index];
      if (key === "name" || key === "internal_code" || key === "barcode" || key === "category" || key === "unit") {
        product[key] = value;
      } else {
        const numValue = parseFloat(value.replace(",", "."));
        if (!isNaN(numValue)) {
          product[key] = numValue;
        }
      }
    });

    if (product.name && product.sale_price !== undefined) {
      products.push(product as ImportProduct);
    }
  }

  return products;
}

export function generateCSV(products: Product[]): string {
  const headers = [
    "Nome",
    "Código Interno",
    "Código de Barras",
    "Categoria",
    "Preço Venda",
    "Preço Custo",
    "Estoque",
    "Unidade",
    "Estoque Mínimo",
  ];

  const rows = products.map((p) => [
    p.name,
    p.internal_code || "",
    p.barcode || "",
    p.category || "",
    p.sale_price.toString().replace(".", ","),
    (p.cost_price || "").toString().replace(".", ","),
    (p.stock_current || 0).toString().replace(".", ","),
    p.unit || "UN",
    (p.min_stock || "").toString().replace(".", ","),
  ]);

  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
}

export function downloadCSV(content: string, filename: string) {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function generateTemplate(): string {
  const headers = [
    "Nome",
    "Código Interno",
    "Código de Barras",
    "Categoria",
    "Preço Venda",
    "Preço Custo",
    "Estoque",
    "Unidade",
    "Estoque Mínimo",
  ];

  const examples = [
    ["Produto Exemplo 1", "001", "7891234567890", "Bebidas", "5,99", "3,50", "100", "UN", "10"],
    ["Produto Exemplo 2", "002", "7891234567891", "Alimentos", "12,50", "8,00", "50", "KG", "5"],
  ];

  return [headers.join(";"), ...examples.map((r) => r.join(";"))].join("\n");
}

export function useImportProducts() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async ({
      products,
      updateExisting = false,
    }: {
      products: ImportProduct[];
      updateExisting?: boolean;
    }): Promise<ImportResult> => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      const result: ImportResult = { created: 0, updated: 0, errors: [] };

      for (const product of products) {
        try {
          // Check if product exists by barcode or internal_code
          let existingProduct = null;
          if (product.barcode) {
            const { data } = await supabase
              .from("products")
              .select("id")
              .eq("tenant_id", currentTenant.id)
              .eq("barcode", product.barcode)
              .maybeSingle();
            existingProduct = data;
          }
          if (!existingProduct && product.internal_code) {
            const { data } = await supabase
              .from("products")
              .select("id")
              .eq("tenant_id", currentTenant.id)
              .eq("internal_code", product.internal_code)
              .maybeSingle();
            existingProduct = data;
          }

          if (existingProduct && updateExisting) {
            const { error } = await supabase
              .from("products")
              .update({
                name: product.name,
                internal_code: product.internal_code || null,
                barcode: product.barcode || null,
                category: product.category || null,
                sale_price: product.sale_price,
                cost_price: product.cost_price || null,
                stock_current: product.stock_current,
                unit: product.unit || "UN",
                min_stock: product.min_stock || null,
                wholesale_price: product.wholesale_price || null,
                wholesale_min_qty: product.wholesale_min_qty || null,
              })
              .eq("id", existingProduct.id);

            if (error) throw error;
            result.updated++;
          } else if (!existingProduct) {
            const { error } = await supabase.from("products").insert({
              tenant_id: currentTenant.id,
              name: product.name,
              internal_code: product.internal_code || null,
              barcode: product.barcode || null,
              category: product.category || null,
              sale_price: product.sale_price,
              cost_price: product.cost_price || null,
              stock_current: product.stock_current || 0,
              unit: product.unit || "UN",
              min_stock: product.min_stock || null,
              wholesale_price: product.wholesale_price || null,
              wholesale_min_qty: product.wholesale_min_qty || null,
              active: true,
            });

            if (error) throw error;
            result.created++;
          }
        } catch (err) {
          result.errors.push(`${product.name}: ${getUserFriendlyError(err)}`);
        }
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      const message = [];
      if (result.created > 0) message.push(`${result.created} criado(s)`);
      if (result.updated > 0) message.push(`${result.updated} atualizado(s)`);
      if (result.errors.length > 0) message.push(`${result.errors.length} erro(s)`);
      toast.success(`Importação concluída: ${message.join(", ")}`);
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

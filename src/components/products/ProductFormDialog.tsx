import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Product, ProductInput } from "@/hooks/useProducts";

interface ExtendedProductInput extends ProductInput {
  controls_lot?: boolean;
  wholesale_price?: number | null;
  wholesale_min_qty?: number | null;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: Product | null;
  onSubmit: (form: ExtendedProductInput) => Promise<void>;
  isPending: boolean;
}

interface FieldError {
  message: string;
}

const INITIAL_FORM: ExtendedProductInput = {
  name: "",
  sale_price: 0,
  internal_code: "",
  barcode: "",
  category: "",
  cost_price: null,
  stock_current: 0,
  unit: "UN",
  min_stock: null,
  active: true,
  controls_lot: false,
  wholesale_price: null,
  wholesale_min_qty: null,
};

function validateField(field: string, value: unknown, form: ExtendedProductInput): FieldError | null {
  switch (field) {
    case "name":
      if (!value || (value as string).trim().length === 0) return { message: "Nome é obrigatório" };
      if ((value as string).length > 200) return { message: "Nome muito longo (máx. 200)" };
      return null;
    case "sale_price":
      if (value === null || value === undefined || (value as number) <= 0) return { message: "Preço deve ser maior que zero" };
      if ((value as number) > 999999.99) return { message: "Preço muito alto (máx. 999.999,99)" };
      return null;
    case "cost_price":
      if (value !== null && value !== undefined && (value as number) < 0) return { message: "Custo não pode ser negativo" };
      if (value !== null && (value as number) > 999999.99) return { message: "Custo muito alto" };
      return null;
    case "wholesale_price":
      if (value !== null && value !== undefined && (value as number) < 0) return { message: "Preço não pode ser negativo" };
      if (value !== null && (value as number) > 999999.99) return { message: "Preço muito alto" };
      return null;
    case "stock_current":
      if (value !== null && value !== undefined && (value as number) < 0) return { message: "Estoque não pode ser negativo" };
      return null;
    case "min_stock":
      if (value !== null && value !== undefined && (value as number) < 0) return { message: "Estoque mínimo não pode ser negativo" };
      return null;
    case "internal_code":
      if (value && (value as string).length > 50) return { message: "Código muito longo (máx. 50)" };
      return null;
    case "barcode":
      if (value && (value as string).length > 50) return { message: "Código muito longo (máx. 50)" };
      return null;
    case "category":
      if (value && (value as string).length > 100) return { message: "Categoria muito longa (máx. 100)" };
      return null;
    case "unit":
      if (value && (value as string).length > 10) return { message: "Unidade muito longa (máx. 10)" };
      return null;
    default:
      return null;
  }
}

function FieldMessage({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) {
    return (
      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
        <AlertCircle className="w-3 h-3" />
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
        <CheckCircle2 className="w-3 h-3" />
        {success}
      </p>
    );
  }
  return null;
}

export function ProductFormDialog({ open, onOpenChange, editingProduct, onSubmit, isPending }: ProductFormDialogProps) {
  const [form, setForm] = useState<ExtendedProductInput>(INITIAL_FORM);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // Reset form when dialog opens
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen && !editingProduct) {
      setForm(INITIAL_FORM);
      setTouched(new Set());
    } else if (isOpen && editingProduct) {
      const ext = editingProduct as Product & { controls_lot?: boolean; wholesale_price?: number | null; wholesale_min_qty?: number | null };
      setForm({
        name: editingProduct.name,
        sale_price: editingProduct.sale_price,
        internal_code: editingProduct.internal_code,
        barcode: editingProduct.barcode,
        category: editingProduct.category,
        cost_price: editingProduct.cost_price,
        stock_current: editingProduct.stock_current,
        unit: editingProduct.unit,
        min_stock: editingProduct.min_stock,
        active: editingProduct.active,
        controls_lot: ext.controls_lot || false,
        wholesale_price: ext.wholesale_price || null,
        wholesale_min_qty: ext.wholesale_min_qty || null,
      });
      setTouched(new Set());
    }
    onOpenChange(isOpen);
  }, [editingProduct, onOpenChange]);

  const errors = useMemo(() => {
    const result: Record<string, FieldError | null> = {};
    const fields = ["name", "sale_price", "cost_price", "wholesale_price", "stock_current", "min_stock", "internal_code", "barcode", "category", "unit"];
    for (const field of fields) {
      result[field] = validateField(field, (form as any)[field], form);
    }
    return result;
  }, [form]);

  const hasErrors = useMemo(() => {
    return Object.values(errors).some((e) => e !== null);
  }, [errors]);

  const isFormValid = useMemo(() => {
    return form.name.trim().length > 0 && form.sale_price > 0 && !hasErrors;
  }, [form.name, form.sale_price, hasErrors]);

  // Margin calculation
  const margin = useMemo(() => {
    if (form.cost_price && form.cost_price > 0 && form.sale_price > 0) {
      const marginPct = ((form.sale_price - form.cost_price) / form.sale_price) * 100;
      return marginPct;
    }
    return null;
  }, [form.sale_price, form.cost_price]);

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => new Set(prev).add(field));
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => new Set(prev).add(field));
  };

  const handleSubmit = async () => {
    // Mark all required as touched
    setTouched(new Set(["name", "sale_price"]));
    if (!isFormValid) return;
    await onSubmit(form);
  };

  const getFieldState = (field: string) => {
    const isTouched = touched.has(field);
    const error = errors[field];
    const value = (form as any)[field];
    const hasValue = value !== null && value !== undefined && value !== "" && value !== 0;
    return {
      error: isTouched ? error?.message : null,
      success: isTouched && !error && hasValue ? "✓" : null,
      borderClass: isTouched
        ? error
          ? "border-destructive focus-visible:ring-destructive"
          : hasValue
          ? "border-emerald-500 focus-visible:ring-emerald-500"
          : ""
        : "",
    };
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Nome */}
            <div className="space-y-1 sm:col-span-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                onBlur={() => handleBlur("name")}
                placeholder="Ex: Coca-Cola 350ml"
                className={cn(getFieldState("name").borderClass)}
              />
              <FieldMessage error={getFieldState("name").error} />
            </div>

            {/* Código Interno */}
            <div className="space-y-1">
              <Label>Código Interno</Label>
              <Input
                value={form.internal_code || ""}
                onChange={(e) => updateField("internal_code", e.target.value)}
                onBlur={() => handleBlur("internal_code")}
                placeholder="SKU ou código"
                className={cn(getFieldState("internal_code").borderClass)}
              />
              <FieldMessage error={getFieldState("internal_code").error} />
            </div>

            {/* Código de Barras */}
            <div className="space-y-1">
              <Label>Código de Barras</Label>
              <Input
                value={form.barcode || ""}
                onChange={(e) => updateField("barcode", e.target.value)}
                onBlur={() => handleBlur("barcode")}
                placeholder="EAN-13 ou EAN-8"
                className={cn(getFieldState("barcode").borderClass)}
              />
              <FieldMessage error={getFieldState("barcode").error} />
            </div>

            {/* Categoria */}
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Input
                value={form.category || ""}
                onChange={(e) => updateField("category", e.target.value)}
                onBlur={() => handleBlur("category")}
                placeholder="Ex: Bebidas"
                className={cn(getFieldState("category").borderClass)}
              />
              <FieldMessage error={getFieldState("category").error} />
            </div>

            {/* Unidade */}
            <div className="space-y-1">
              <Label>Unidade</Label>
              <Input
                value={form.unit || "UN"}
                onChange={(e) => updateField("unit", e.target.value)}
                onBlur={() => handleBlur("unit")}
                placeholder="UN, KG, L..."
                className={cn(getFieldState("unit").borderClass)}
              />
              <FieldMessage error={getFieldState("unit").error} />
            </div>

            {/* Preço de Venda */}
            <div className="space-y-1">
              <Label>Preço de Venda *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.sale_price || ""}
                onChange={(e) => updateField("sale_price", parseFloat(e.target.value) || 0)}
                onBlur={() => handleBlur("sale_price")}
                placeholder="0,00"
                className={cn(getFieldState("sale_price").borderClass)}
              />
              <FieldMessage error={getFieldState("sale_price").error} />
            </div>

            {/* Preço de Custo */}
            <div className="space-y-1">
              <Label>Preço de Custo</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.cost_price || ""}
                onChange={(e) => updateField("cost_price", parseFloat(e.target.value) || null)}
                onBlur={() => handleBlur("cost_price")}
                placeholder="0,00"
                className={cn(getFieldState("cost_price").borderClass)}
              />
              <FieldMessage error={getFieldState("cost_price").error} />
              {margin !== null && (
                <p className={cn("text-xs mt-0.5", margin >= 0 ? "text-emerald-600" : "text-destructive")}>
                  Margem: {margin.toFixed(1)}%
                </p>
              )}
            </div>

            {/* Preço Atacado */}
            <div className="space-y-1">
              <Label>Preço Atacado</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.wholesale_price || ""}
                onChange={(e) => updateField("wholesale_price", parseFloat(e.target.value) || null)}
                onBlur={() => handleBlur("wholesale_price")}
                placeholder="0,00"
                className={cn(getFieldState("wholesale_price").borderClass)}
              />
              <FieldMessage error={getFieldState("wholesale_price").error} />
            </div>

            {/* Qtd Mín Atacado */}
            <div className="space-y-1">
              <Label>Qtd Mín. Atacado</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={form.wholesale_min_qty || ""}
                onChange={(e) => updateField("wholesale_min_qty", parseFloat(e.target.value) || null)}
                placeholder="1"
              />
            </div>

            {/* Estoque Atual */}
            <div className="space-y-1">
              <Label>Estoque Atual</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={form.stock_current || 0}
                onChange={(e) => updateField("stock_current", parseFloat(e.target.value) || 0)}
                onBlur={() => handleBlur("stock_current")}
                className={cn(getFieldState("stock_current").borderClass)}
              />
              <FieldMessage error={getFieldState("stock_current").error} />
            </div>

            {/* Estoque Mínimo */}
            <div className="space-y-1">
              <Label>Estoque Mínimo</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={form.min_stock || ""}
                onChange={(e) => updateField("min_stock", parseFloat(e.target.value) || null)}
                onBlur={() => handleBlur("min_stock")}
                className={cn(getFieldState("min_stock").borderClass)}
              />
              <FieldMessage error={getFieldState("min_stock").error} />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(checked) => updateField("active", checked)} />
              <Label>Produto ativo</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.controls_lot} onCheckedChange={(checked) => updateField("controls_lot", checked)} />
              <Label>Controla lote/validade</Label>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isPending || !isFormValid}
          >
            {isPending ? "Salvando..." : editingProduct ? "Salvar" : "Criar Produto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

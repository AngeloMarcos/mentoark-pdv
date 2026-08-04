import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput, QuantityInput } from "@/components/ui/currency-input";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Product, ProductInput } from "@/hooks/useProducts";
import { FiscalProductTab, FiscalFields } from "@/components/fiscal/FiscalProductTab";

const UNITS = [
  { value: "UN", label: "UN — Unidade" },
  { value: "CX", label: "CX — Caixa" },
  { value: "PC", label: "PC — Pacote" },
  { value: "KG", label: "KG — Quilograma" },
  { value: "G", label: "G — Grama" },
  { value: "L", label: "L — Litro" },
  { value: "ML", label: "ML — Mililitro" },
  { value: "M", label: "M — Metro" },
  { value: "DZ", label: "DZ — Dúzia" },
];

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ExtendedProductInput extends ProductInput, FiscalFields {
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
  categories?: string[];
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
        <AlertTriangle className="w-3 h-3" />
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

export function ProductFormDialog({ open, onOpenChange, editingProduct, onSubmit, isPending, categories = [] }: ProductFormDialogProps) {
  const [form, setForm] = useState<ExtendedProductInput>(INITIAL_FORM);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // Popula/reseta o formulário sempre que o dialog abre ou o produto muda
  const syncForm = useCallback((isOpen: boolean) => {
    if (isOpen && !editingProduct) {
      setForm(INITIAL_FORM);
      setTouched(new Set());
    } else if (isOpen && editingProduct) {
      const ext = editingProduct as Product & FiscalFields & { controls_lot?: boolean; wholesale_price?: number | null; wholesale_min_qty?: number | null };
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
        ncm: ext.ncm || null,
        cfop: ext.cfop || "5102",
        csosn: ext.csosn || "400",
        cst_icms: ext.cst_icms || null,
        cest: ext.cest || null,
        origem: ext.origem ?? 0,
        icms_aliquota: ext.icms_aliquota ?? 0,
        pis_aliquota: ext.pis_aliquota ?? 0.65,
        cofins_aliquota: ext.cofins_aliquota ?? 3.0,
        unidade_medida: ext.unidade_medida || ext.unit || "UN",
        ean: ext.ean || ext.barcode || null,
      });
      setTouched(new Set());
    }
  }, [editingProduct]);

  useEffect(() => {
    syncForm(open);
  }, [open, syncForm]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    syncForm(isOpen);
    onOpenChange(isOpen);
  }, [syncForm, onOpenChange]);

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

  const applyMarkup = (pct: number) => {
    if (!form.cost_price || form.cost_price <= 0) return;
    const price = Math.round(form.cost_price * (1 + pct / 100) * 100) / 100;
    updateField("sale_price", price);
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </section>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-5">
        <DialogHeader className="space-y-0.5">
          <DialogTitle className="text-base">{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Preencha nome e preço de venda. Os demais campos são opcionais.
          </p>
        </DialogHeader>

        <Tabs defaultValue="geral" className="pt-1">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="geral" className="text-xs h-7">Geral</TabsTrigger>
            <TabsTrigger value="fiscal" className="text-xs h-7">Fiscal</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="mt-3 space-y-3">
            <Section title="Identificação">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Nome *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    onBlur={() => handleBlur("name")}
                    placeholder="Ex: Coca-Cola 350ml"
                    className={cn("h-9", getFieldState("name").borderClass)}
                  />
                  <FieldMessage error={getFieldState("name").error} />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Código Interno</Label>
                  <Input
                    value={form.internal_code || ""}
                    onChange={(e) => updateField("internal_code", e.target.value)}
                    onBlur={() => handleBlur("internal_code")}
                    placeholder="SKU"
                    className={cn("h-9", getFieldState("internal_code").borderClass)}
                  />
                  <FieldMessage error={getFieldState("internal_code").error} />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Código de Barras</Label>
                  <Input
                    value={form.barcode || ""}
                    onChange={(e) => updateField("barcode", e.target.value)}
                    onBlur={() => handleBlur("barcode")}
                    placeholder="EAN-13"
                    className={cn("h-9", getFieldState("barcode").borderClass)}
                  />
                  <FieldMessage error={getFieldState("barcode").error} />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Categoria</Label>
                  <Input
                    value={form.category || ""}
                    onChange={(e) => updateField("category", e.target.value)}
                    onBlur={() => handleBlur("category")}
                    placeholder="Ex: Bebidas"
                    list="product-categories"
                    className={cn("h-9", getFieldState("category").borderClass)}
                  />
                  <datalist id="product-categories">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <FieldMessage error={getFieldState("category").error} />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Unidade</Label>
                  <Select value={form.unit || "UN"} onValueChange={(v) => updateField("unit", v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Section>

            <Section title="Preços">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Preço de Custo</Label>
                  <CurrencyInput
                    value={form.cost_price}
                    onChange={(v) => updateField("cost_price", v)}
                    onBlur={() => handleBlur("cost_price")}
                    className={getFieldState("cost_price").borderClass}
                  />
                  <FieldMessage error={getFieldState("cost_price").error} />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Preço de Venda *</Label>
                  <CurrencyInput
                    value={form.sale_price || null}
                    onChange={(v) => updateField("sale_price", v ?? 0)}
                    onBlur={() => handleBlur("sale_price")}
                    className={getFieldState("sale_price").borderClass}
                  />
                  <FieldMessage error={getFieldState("sale_price").error} />
                </div>
              </div>

              {form.cost_price && form.cost_price > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground mr-1">Markup rápido:</span>
                  {[20, 30, 50, 100].map((pct) => (
                    <Button
                      key={pct}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => applyMarkup(pct)}
                    >
                      +{pct}%
                    </Button>
                  ))}
                </div>
              ) : null}

              {margin !== null && (
                <div
                  className={cn(
                    "flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs",
                    margin >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive",
                  )}
                >
                  <span>Margem de lucro</span>
                  <span className="font-semibold tabular-nums">
                    {margin.toFixed(1)}% · {formatCurrency((form.sale_price || 0) - (form.cost_price || 0))}
                  </span>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Preço Atacado</Label>
                  <CurrencyInput
                    value={form.wholesale_price ?? null}
                    onChange={(v) => updateField("wholesale_price", v)}
                    onBlur={() => handleBlur("wholesale_price")}
                    className={getFieldState("wholesale_price").borderClass}
                  />
                  <FieldMessage error={getFieldState("wholesale_price").error} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Qtd. mínima para atacado</Label>
                  <QuantityInput
                    value={form.wholesale_min_qty ?? null}
                    onChange={(v) => updateField("wholesale_min_qty", v)}
                    suffix={form.unit || "UN"}
                    placeholder="1"
                  />
                </div>
              </div>
            </Section>

            <Section title="Estoque">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Estoque Atual</Label>
                  <QuantityInput
                    value={form.stock_current ?? 0}
                    onChange={(v) => updateField("stock_current", v ?? 0)}
                    onBlur={() => handleBlur("stock_current")}
                    suffix={form.unit || "UN"}
                    className={getFieldState("stock_current").borderClass}
                  />
                  <FieldMessage error={getFieldState("stock_current").error} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Estoque Mínimo</Label>
                  <QuantityInput
                    value={form.min_stock ?? null}
                    onChange={(v) => updateField("min_stock", v)}
                    onBlur={() => handleBlur("min_stock")}
                    suffix={form.unit || "UN"}
                    className={getFieldState("min_stock").borderClass}
                  />
                  <FieldMessage error={getFieldState("min_stock").error} />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <Switch checked={form.active} onCheckedChange={(checked) => updateField("active", checked)} />
                  <Label className="text-xs">Produto ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.controls_lot}
                    onCheckedChange={(checked) => updateField("controls_lot", checked)}
                  />
                  <Label className="text-xs">Controla lote/validade</Label>
                </div>
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="fiscal" className="mt-3">
            <FiscalProductTab
              values={form as FiscalFields}
              onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            />
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-0 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 mt-1 flex items-center justify-end gap-2 border-t border-border/60 bg-background/95 backdrop-blur px-4 sm:px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isPending || !isFormValid} className="min-w-[140px]">
            {isPending ? "Salvando..." : editingProduct ? "Salvar alterações" : "Criar produto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreatePromotion } from "@/hooks/usePromotions";
import { useProducts } from "@/hooks/useProducts";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

const schema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  description: z.string().optional(),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.coerce.number().positive("Valor deve ser > 0"),
  scope: z.enum(["all", "category", "products"]),
  category: z.string().optional(),
  product_ids: z.array(z.string()).optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  active: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NewPromotionDialog({ open, onOpenChange }: Props) {
  const create = useCreatePromotion();
  const { data: products = [] } = useProducts("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      discount_type: "percentage",
      discount_value: 10,
      scope: "all",
      category: "",
      product_ids: [],
      starts_at: "",
      ends_at: "",
      active: true,
    },
  });

  const scope = form.watch("scope");
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];

  const onSubmit = async (values: FormValues) => {
    await create.mutateAsync({
      name: values.name,
      description: values.description || null,
      discount_type: values.discount_type,
      discount_value: values.discount_value,
      scope: values.scope,
      category: values.scope === "category" ? values.category || null : null,
      product_ids: values.scope === "products" ? selectedProducts : null,
      starts_at: values.starts_at || null,
      ends_at: values.ends_at || null,
      active: values.active,
    });
    form.reset();
    setSelectedProducts([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Nova Promoção</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl><Input placeholder="Ex: Black Friday 20% OFF" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="discount_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">Percentual (%)</SelectItem>
                        <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discount_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor do desconto</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Escopo</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="all">Todos os produtos</SelectItem>
                      <SelectItem value="category">Por categoria</SelectItem>
                      <SelectItem value="products">Produtos específicos</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {scope === "category" && (
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Escolha…" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            )}

            {scope === "products" && (
              <div>
                <FormLabel>Produtos ({selectedProducts.length} selecionados)</FormLabel>
                <ScrollArea className="h-48 mt-2 rounded-md border p-2">
                  <div className="space-y-1">
                    {products.map((p) => {
                      const checked = selectedProducts.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-2 p-1 rounded hover:bg-secondary cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setSelectedProducts((prev) =>
                                v ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                              );
                            }}
                          />
                          <span className="text-sm">{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="starts_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Início (opcional)</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ends_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fim (opcional)</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <FormLabel>Ativa</FormLabel>
                    <p className="text-xs text-muted-foreground">Promoções ativas aparecem no PDV</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Salvando…" : "Criar promoção"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

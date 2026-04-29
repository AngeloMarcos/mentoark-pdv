import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  useFinancialCategories,
  useCreateFinancialCategory,
  useUpdateFinancialCategory,
  useDeleteFinancialCategory,
  FinancialCategory,
} from "@/hooks/useFinancialCategories";

const COLORS = ["#10B981", "#06B6D4", "#8B5CF6", "#EF4444", "#F59E0B", "#EC4899", "#6366F1", "#84CC16"];

export function CategoriesManager() {
  const { data: categories = [], isLoading } = useFinancialCategories();
  const create = useCreateFinancialCategory();
  const update = useUpdateFinancialCategory();
  const del = useDeleteFinancialCategory();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialCategory | null>(null);
  const [form, setForm] = useState<{ name: string; type: "receita" | "despesa"; color: string }>({
    name: "",
    type: "receita",
    color: COLORS[0],
  });

  const grouped = useMemo(() => {
    return {
      receita: categories.filter((c) => c.type === "receita"),
      despesa: categories.filter((c) => c.type === "despesa"),
    };
  }, [categories]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", type: "receita", color: COLORS[0] });
    setOpen(true);
  };

  const openEdit = (c: FinancialCategory) => {
    setEditing(c);
    setForm({ name: c.name, type: c.type, color: c.color });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name) return;
    if (editing) {
      await update.mutateAsync({ id: editing.id, ...form });
    } else {
      await create.mutateAsync(form);
    }
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nova categoria</Button>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">Carregando...</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {(["receita", "despesa"] as const).map((type) => (
            <div key={type} className="space-y-3">
              <h3 className="font-semibold capitalize">
                {type === "receita" ? "Receitas" : "Despesas"}
              </h3>
              {grouped[type].length === 0 ? (
                <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4">
                  Nenhuma categoria.
                </div>
              ) : (
                grouped[type].map((c) => (
                  <Card key={c.id}>
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className="w-4 h-4 rounded-full" style={{ background: c.color }} />
                      <span className="flex-1 font-medium">{c.name}</span>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Excluir categoria "${c.name}"?`)) del.mutate(c.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={(v: "receita" | "despesa") => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      form.color === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={submit} disabled={!form.name}>
              {editing ? "Salvar alterações" : "Criar categoria"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

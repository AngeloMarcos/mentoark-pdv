import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSuppliers, useDeleteSupplier, type Supplier } from "@/hooks/useSuppliers";
import { SupplierFormDialog } from "@/components/suppliers/SupplierFormDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function SuppliersTab() {
  const [includeInactive, setIncludeInactive] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: suppliers = [], isLoading } = useSuppliers(includeInactive);
  const del = useDeleteSupplier();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      [s.name, s.fantasy_name, s.document, s.city].some((v) =>
        (v ?? "").toLowerCase().includes(q),
      ),
    );
  }, [suppliers, search]);

  const handleEdit = (s: Supplier) => { setEditing(s); setOpen(true); };
  const handleNew = () => { setEditing(null); setOpen(true); };
  const handleConfirmDelete = async () => {
    if (deleteId) { await del.mutateAsync(deleteId); setDeleteId(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            maxLength={120}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="incl" checked={includeInactive} onCheckedChange={setIncludeInactive} />
          <Label htmlFor="incl" className="text-sm">Mostrar inativos</Label>
        </div>
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-2" /> Novo fornecedor
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome / Razão Social</TableHead>
              <TableHead>CNPJ/CPF</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                {search ? "Nenhum fornecedor encontrado." : "Nenhum fornecedor cadastrado."}
              </TableCell></TableRow>
            )}
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-medium">{s.name}</div>
                  {s.fantasy_name && <div className="text-xs text-muted-foreground">{s.fantasy_name}</div>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.document ?? "—"}</TableCell>
                <TableCell className="text-sm">{s.phone ?? "—"}</TableCell>
                <TableCell className="text-sm">{s.email ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  {s.city ? `${s.city}${s.state ? ` / ${s.state}` : ""}` : "—"}
                </TableCell>
                <TableCell>
                  {s.active
                    ? <Badge className="bg-success/15 text-success border border-success/30">Ativo</Badge>
                    : <Badge variant="secondary">Inativo</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(s)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteId(s.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <SupplierFormDialog open={open} onOpenChange={setOpen} supplier={editing} />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não poderá ser desfeita. Pedidos de compra vinculados serão bloqueados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

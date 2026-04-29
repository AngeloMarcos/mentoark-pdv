import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Eye, Copy, Printer, Ban, FileText, Loader2 } from "lucide-react";
import { useFiscalDocuments, useCancelFiscalDocument, FiscalDocument } from "@/hooks/useFiscalDocuments";
import { FISCAL_STATUS_COLORS, FISCAL_STATUS_LABELS } from "@/lib/fiscal-utils";
import { DanfeViewer } from "./DanfeViewer";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function FiscalDocumentsTab() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<FiscalDocument | null>(null);
  const [viewingItems, setViewingItems] = useState<Array<{ product_name: string; quantity: number; unit_price: number; total: number; unit?: string }>>([]);
  const [cancelTarget, setCancelTarget] = useState<FiscalDocument | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const { data: docs = [], isLoading } = useFiscalDocuments({
    status: filterStatus !== "all" ? filterStatus : undefined,
    type: filterType !== "all" ? filterType : undefined,
  });

  const cancelMut = useCancelFiscalDocument();

  const filtered = useMemo(() => {
    if (!search) return docs;
    const s = search.toLowerCase();
    return docs.filter(
      (d) =>
        d.chave_acesso?.toLowerCase().includes(s) ||
        String(d.numero_nota || "").includes(s)
    );
  }, [docs, search]);

  const openView = async (doc: FiscalDocument) => {
    setViewing(doc);
    setViewingItems([]);
    if (!doc.sale_id) return;
    const { data } = await supabase
      .from("sale_items")
      .select("quantity, unit_price, total, products(name, unit)")
      .eq("sale_id", doc.sale_id);
    if (data) {
      setViewingItems(
        data.map((row) => {
          const r = row as unknown as { quantity: number; unit_price: number; total: number; products: { name: string; unit?: string } };
          return {
            product_name: r.products?.name || "Item",
            quantity: Number(r.quantity),
            unit_price: Number(r.unit_price),
            total: Number(r.total),
            unit: r.products?.unit,
          };
        })
      );
    }
  };

  const copyChave = async (doc: FiscalDocument) => {
    if (!doc.chave_acesso) return;
    await navigator.clipboard.writeText(doc.chave_acesso);
    toast.success("Chave copiada!");
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    await cancelMut.mutateAsync({ id: cancelTarget.id, reason: cancelReason });
    setCancelTarget(null);
    setCancelReason("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Buscar por número ou chave..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="simulado">Simulado</SelectItem>
            <SelectItem value="autorizado">Autorizado</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
            <SelectItem value="rejeitado">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="nfce">NFC-e</SelectItem>
            <SelectItem value="sat">SAT</SelectItem>
            <SelectItem value="nf">NF-e</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
              Nenhum documento fiscal encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Série</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Impostos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono">{String(d.numero_nota || 0).padStart(6, "0")}</TableCell>
                    <TableCell>{d.serie}</TableCell>
                    <TableCell className="uppercase text-xs">{d.document_type}</TableCell>
                    <TableCell className="text-sm">{new Date(d.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right">{fmt(d.valor_total)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmt(d.valor_impostos)}</TableCell>
                    <TableCell>
                      <Badge className={FISCAL_STATUS_COLORS[d.status] || ""}>
                        {FISCAL_STATUS_LABELS[d.status] || d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" title="Visualizar" onClick={() => openView(d)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Copiar chave" onClick={() => copyChave(d)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Reimprimir" onClick={() => openView(d)}>
                          <Printer className="w-4 h-4" />
                        </Button>
                        {d.status !== "cancelado" && (
                          <Button size="icon" variant="ghost" title="Cancelar" onClick={() => setCancelTarget(d)}>
                            <Ban className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DanfeViewer
        document={viewing}
        open={!!viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        items={viewingItems}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar documento fiscal?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação marca o documento como cancelado. Informe um motivo (mínimo recomendado: 15 caracteres).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Motivo do cancelamento"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground"
            >
              Cancelar Documento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RotateCcw } from "lucide-react";
import { useReturns } from "@/hooks/useReturns";
import { NewReturnDialog } from "@/components/returns/NewReturnDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const REFUND_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  store_credit: "Crédito em loja",
};

const REASON_LABEL: Record<string, string> = {
  defect: "Defeito",
  regret: "Desistência",
  exchange: "Troca",
  other: "Outro",
};

export default function Returns() {
  const [open, setOpen] = useState(false);
  const { data: returns = [], isLoading } = useReturns();

  return (
    <AppLayout title="Devoluções">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <RotateCcw className="w-6 h-6" /> Devoluções e Trocas
            </h1>
            <p className="text-sm text-muted-foreground">
              Registre devoluções vinculadas a vendas anteriores
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova devolução
          </Button>
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Reembolso</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && returns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma devolução registrada ainda
                  </TableCell>
                </TableRow>
              )}
              {returns.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.sales?.customers?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="mr-1">
                      {REASON_LABEL[r.reason_type] ?? r.reason_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{r.reason}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {REFUND_LABEL[r.refund_method] ?? r.refund_method}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    R$ {Number(r.total_amount).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <NewReturnDialog open={open} onOpenChange={setOpen} />
    </AppLayout>
  );
}

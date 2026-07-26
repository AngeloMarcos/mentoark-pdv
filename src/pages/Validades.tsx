import { AppLayout } from "@/components/layout/AppLayout";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExpiringLots, useWriteOffLot } from "@/hooks/useExpiringLots";
import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

export default function Validades() {
  return (
    <AppLayout>
      <PermissionGuard permission="stock">
        <Content />
      </PermissionGuard>
    </AppLayout>
  );
}

function Content() {
  const [days, setDays] = useState(30);
  const { data = [] } = useExpiringLots(days);
  const writeOff = useWriteOffLot();

  const badge = (d: number) => {
    if (d < 0) return <Badge variant="destructive">Vencido</Badge>;
    if (d <= 7) return <Badge className="bg-orange-500">{d}d</Badge>;
    if (d <= 30) return <Badge className="bg-yellow-500">{d}d</Badge>;
    return <Badge variant="secondary">{d}d</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-orange-500" />
          <div>
            <h1 className="text-2xl font-bold">Validades e Lotes</h1>
            <p className="text-sm text-muted-foreground">Controle FEFO e baixa de perdas</p>
          </div>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Vencendo em 7 dias</SelectItem>
            <SelectItem value="15">Vencendo em 15 dias</SelectItem>
            <SelectItem value="30">Vencendo em 30 dias</SelectItem>
            <SelectItem value="60">Vencendo em 60 dias</SelectItem>
            <SelectItem value="90">Vencendo em 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle>{data.length} lote(s) para atenção</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Produto</TableHead><TableHead>Lote</TableHead><TableHead>Validade</TableHead>
              <TableHead>Dias</TableHead><TableHead>Qtd</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.map((l) => (
                <TableRow key={l.lot_id}>
                  <TableCell>{l.product_name}</TableCell>
                  <TableCell className="font-mono">{l.lot_number}</TableCell>
                  <TableCell>{new Date(l.expiry_date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{badge(l.days_left)}</TableCell>
                  <TableCell>{l.quantity}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="destructive" onClick={() => writeOff.mutate({ lot_id: l.lot_id })}>
                      <Trash2 className="w-4 h-4 mr-1" />Baixar perda
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum lote em atenção.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWarehouses, useCreateWarehouse, useDeleteWarehouse, useTransferStock, useStockTransfers } from "@/hooks/useWarehouses";
import { useProducts } from "@/hooks/useProducts";
import { Warehouse as WarehouseIcon, Plus, ArrowLeftRight, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function Warehouses() {
  return (
    <AppLayout>
      <PermissionGuard permission="stock">
        <WarehousesContent />
      </PermissionGuard>
    </AppLayout>
  );
}

function WarehousesContent() {
  const { data: warehouses = [] } = useWarehouses();
  const { data: products = [] } = useProducts();
  const { data: transfers = [] } = useStockTransfers();
  const createWh = useCreateWarehouse();
  const deleteWh = useDeleteWarehouse();
  const transfer = useTransferStock();

  const [newWh, setNewWh] = useState({ code: "", name: "", address: "" });
  const [openCreate, setOpenCreate] = useState(false);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [transferData, setTransferData] = useState({ from: "", to: "", product_id: "", quantity: 0, notes: "" });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WarehouseIcon className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Depósitos</h1>
            <p className="text-sm text-muted-foreground">Multi-depósito e transferências de estoque</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
            <DialogTrigger asChild>
              <Button variant="outline"><ArrowLeftRight className="w-4 h-4 mr-2" />Transferir</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Transferir estoque</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>De</Label>
                  <Select value={transferData.from} onValueChange={(v) => setTransferData({ ...transferData, from: v })}>
                    <SelectTrigger><SelectValue placeholder="Depósito origem" /></SelectTrigger>
                    <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Para</Label>
                  <Select value={transferData.to} onValueChange={(v) => setTransferData({ ...transferData, to: v })}>
                    <SelectTrigger><SelectValue placeholder="Depósito destino" /></SelectTrigger>
                    <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Produto</Label>
                  <Select value={transferData.product_id} onValueChange={(v) => setTransferData({ ...transferData, product_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
                    <SelectContent>{products.slice(0, 500).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" value={transferData.quantity} onChange={(e) => setTransferData({ ...transferData, quantity: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Input value={transferData.notes} onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })} />
                </div>
                <Button
                  className="w-full"
                  disabled={!transferData.from || !transferData.to || !transferData.product_id || transferData.quantity <= 0}
                  onClick={async () => {
                    await transfer.mutateAsync({
                      from_warehouse_id: transferData.from,
                      to_warehouse_id: transferData.to,
                      product_id: transferData.product_id,
                      quantity: transferData.quantity,
                      notes: transferData.notes,
                    });
                    setOpenTransfer(false);
                    setTransferData({ from: "", to: "", product_id: "", quantity: 0, notes: "" });
                  }}
                >
                  Confirmar transferência
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Novo depósito</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo depósito</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Código</Label><Input value={newWh.code} onChange={(e) => setNewWh({ ...newWh, code: e.target.value })} /></div>
                <div><Label>Nome</Label><Input value={newWh.name} onChange={(e) => setNewWh({ ...newWh, name: e.target.value })} /></div>
                <div><Label>Endereço</Label><Input value={newWh.address} onChange={(e) => setNewWh({ ...newWh, address: e.target.value })} /></div>
                <Button
                  className="w-full"
                  disabled={!newWh.code || !newWh.name}
                  onClick={async () => {
                    await createWh.mutateAsync(newWh);
                    setNewWh({ code: "", name: "", address: "" });
                    setOpenCreate(false);
                  }}
                >
                  Criar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Depósitos</TabsTrigger>
          <TabsTrigger value="transfers">Transferências</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <Card>
            <CardHeader><CardTitle>Depósitos cadastrados</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Endereço</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {warehouses.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono">{w.code}</TableCell>
                      <TableCell>{w.name} {w.is_default && <Badge variant="secondary">padrão</Badge>}</TableCell>
                      <TableCell>{w.address}</TableCell>
                      <TableCell>{w.active ? <Badge className="bg-green-500">Ativo</Badge> : <Badge variant="destructive">Inativo</Badge>}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => deleteWh.mutate(w.id)}><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {warehouses.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum depósito. Crie o primeiro.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="transfers">
          <Card>
            <CardHeader><CardTitle>Histórico de transferências</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Produto</TableHead><TableHead>De</TableHead><TableHead>Para</TableHead><TableHead>Qtd</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {transfers.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell>{format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>{t.products?.name}</TableCell>
                      <TableCell>{t.from?.name}</TableCell>
                      <TableCell>{t.to?.name}</TableCell>
                      <TableCell>{t.quantity}</TableCell>
                      <TableCell><Badge variant={t.status === "completed" ? "default" : "secondary"}>{t.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {transfers.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma transferência realizada.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

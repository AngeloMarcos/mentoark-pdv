import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, CustomerInput } from "@/hooks/useCustomers";
import { CustomerHistoryDialog } from "@/components/customers/CustomerHistoryDialog";
import { useCustomerPoints, useLoyaltySettings, calculatePointsValue } from "@/hooks/useLoyalty";
import { Plus, Search, Pencil, Trash2, Users, History, Gift } from "lucide-react";
import { toast } from "sonner";

// Componente inline para mostrar pontos de cada cliente
function CustomerPointsBadge({ customerId }: { customerId: string }) {
  const { data: points = 0, isLoading } = useCustomerPoints(customerId);
  const { data: settings } = useLoyaltySettings();

  if (!settings?.loyalty_enabled) return null;
  if (isLoading) return <Skeleton className="h-5 w-16 inline-block" />;
  if (points === 0) return <span className="text-muted-foreground text-sm">-</span>;

  return (
    <Badge variant="secondary" className="gap-1">
      <Gift className="w-3 h-3" />
      {points.toLocaleString("pt-BR")}
    </Badge>
  );
}

const Customers = () => {
  const [historyCustomer, setHistoryCustomer] = useState<{ id: string; name: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<{ id: string } & CustomerInput | null>(null);
  const [formData, setFormData] = useState<CustomerInput>({
    name: "",
    phone: "",
    document: "",
    email: "",
    notes: "",
  });

  const { data: customers = [], isLoading } = useCustomers(searchTerm);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const resetForm = () => {
    setFormData({ name: "", phone: "", document: "", email: "", notes: "" });
    setEditingCustomer(null);
  };

  const handleOpenDialog = (customer?: { id: string } & CustomerInput) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone || "",
        document: customer.document || "",
        email: customer.email || "",
        notes: customer.notes || "",
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      if (editingCustomer) {
        await updateCustomer.mutateAsync({ id: editingCustomer.id, data: formData });
      } else {
        await createCustomer.mutateAsync(formData);
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Deseja excluir o cliente "${name}"?`)) {
      await deleteCustomer.mutateAsync(id);
    }
  };

  return (
    <AppLayout title="Clientes">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou documento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="touch-target">
                <Plus className="w-4 h-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer ? "Editar Cliente" : "Novo Cliente"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={formData.phone || ""}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="document">Documento</Label>
                    <Input
                      id="document"
                      value={formData.document || ""}
                      onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                      placeholder="CPF ou CNPJ"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Observações sobre o cliente..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createCustomer.isPending || updateCustomer.isPending}>
                    {editingCustomer ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Customer List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Lista de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                      <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                      <TableHead className="hidden sm:table-cell"><Skeleton className="h-4 w-24" /></TableHead>
                      <TableHead className="hidden md:table-cell"><Skeleton className="h-4 w-32" /></TableHead>
                      <TableHead className="w-24"><Skeleton className="h-4 w-16" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Skeleton className="w-8 h-8" />
                            <Skeleton className="w-8 h-8" />
                            <Skeleton className="w-8 h-8" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="hidden sm:table-cell">Pontos</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.phone || "-"}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <CustomerPointsBadge customerId={customer.id} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{customer.email || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Histórico de compras"
                              onClick={() => setHistoryCustomer({ id: customer.id, name: customer.name })}
                            >
                              <History className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog({
                                id: customer.id,
                                name: customer.name,
                                phone: customer.phone,
                                document: customer.document,
                                email: customer.email,
                                notes: customer.notes,
                              })}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(customer.id, customer.name)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* History Dialog */}
        <CustomerHistoryDialog
          open={!!historyCustomer}
          onOpenChange={(open) => !open && setHistoryCustomer(null)}
          customer={historyCustomer}
        />
      </div>
    </AppLayout>
  );
};

export default Customers;

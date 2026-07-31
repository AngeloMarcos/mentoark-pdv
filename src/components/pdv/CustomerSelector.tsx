import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { User, X, Plus, Loader2, Search } from "lucide-react";
import { useCustomers, useCreateCustomer, Customer } from "@/hooks/useCustomers";

interface CustomerSelectorProps {
  customer: Customer | null;
  onSelect: (customer: Customer | null) => void;
  required?: boolean;
}

export function CustomerSelector({ customer, onSelect, required }: CustomerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const { data: customers = [], isLoading } = useCustomers(search || undefined);
  const createCustomer = useCreateCustomer();

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const created = await createCustomer.mutateAsync({
      name: newName.trim(),
      phone: newPhone.trim() || null,
    });
    onSelect(created as Customer);
    setNewName("");
    setNewPhone("");
    setShowAddForm(false);
    setOpen(false);
  };

  return (
    <>
      {customer ? (
        <div className="flex items-center gap-2 p-2 bg-accent/40 rounded-lg text-sm">
          <User className="w-4 h-4 text-primary" />
          <span>Cliente:</span>
          <Badge variant="secondary" className="font-medium">{customer.name}</Badge>
          <button onClick={() => setOpen(true)} className="text-xs text-primary hover:underline ml-1">
            trocar
          </button>
          <button onClick={() => onSelect(null)} className="ml-auto" aria-label="Remover cliente">
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ) : (
        <Button
          variant={required ? "default" : "outline"}
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => setOpen(true)}
        >
          <User className="w-4 h-4" />
          {required ? "Selecionar cliente (obrigatório no fiado)" : "Selecionar Cliente (opcional)"}
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); setShowAddForm(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cliente da venda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {!showAddForm ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, telefone ou documento"
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>

                {isLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : customers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum cliente encontrado
                  </p>
                ) : (
                  <div className="space-y-1 max-h-[280px] overflow-y-auto">
                    {customers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { onSelect(c); setOpen(false); }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{c.name}</p>
                          {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                        </div>
                        {customer?.id === c.id && <Badge className="text-xs">Atual</Badge>}
                      </button>
                    ))}
                  </div>
                )}

                <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAddForm(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Novo cliente
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    placeholder="Ex: Maria Souza"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone (opcional)</Label>
                  <Input
                    placeholder="(11) 99999-0000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setShowAddForm(false)}>
                    Voltar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleAdd}
                    disabled={!newName.trim() || createCustomer.isPending}
                  >
                    {createCustomer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cadastrar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

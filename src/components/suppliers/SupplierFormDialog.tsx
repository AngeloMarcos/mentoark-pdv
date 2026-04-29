import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateSupplier, useUpdateSupplier, type Supplier } from "@/hooks/useSuppliers";
import { maskCpfCnpj, maskPhone, maskCEP, fetchCep, BR_STATES } from "@/lib/br-masks";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supplier?: Supplier | null;
}

const CATEGORIES = ["Produtos", "Serviços", "Matéria Prima", "Utilidades", "Outros"];

const EMPTY = {
  name: "", fantasy_name: "", document: "", state_registration: "",
  phone: "", email: "",
  zip_code: "", street: "", number: "", complement: "",
  neighborhood: "", city: "", state: "",
  bank_name: "", bank_agency: "", bank_account: "", pix_key: "",
  category: "", due_days: 30,
  payment_terms: "", notes: "", active: true,
};

export function SupplierFormDialog({ open, onOpenChange, supplier }: Props) {
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const [form, setForm] = useState(EMPTY);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (supplier) {
      setForm({
        name: supplier.name,
        fantasy_name: supplier.fantasy_name ?? "",
        document: supplier.document ?? "",
        state_registration: supplier.state_registration ?? "",
        phone: supplier.phone ?? "",
        email: supplier.email ?? "",
        zip_code: supplier.zip_code ?? "",
        street: supplier.street ?? "",
        number: supplier.number ?? "",
        complement: supplier.complement ?? "",
        neighborhood: supplier.neighborhood ?? "",
        city: supplier.city ?? "",
        state: supplier.state ?? "",
        bank_name: supplier.bank_name ?? "",
        bank_agency: supplier.bank_agency ?? "",
        bank_account: supplier.bank_account ?? "",
        pix_key: supplier.pix_key ?? "",
        category: supplier.category ?? "",
        due_days: supplier.due_days ?? 30,
        payment_terms: supplier.payment_terms ?? "",
        notes: supplier.notes ?? "",
        active: supplier.active,
      });
    } else {
      setForm(EMPTY);
    }
  }, [supplier, open]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleCepBlur = async () => {
    if (!form.zip_code) return;
    setCepLoading(true);
    const data = await fetchCep(form.zip_code);
    setCepLoading(false);
    if (!data) {
      toast.error("CEP não encontrado.");
      return;
    }
    setForm((f) => ({
      ...f,
      street: data.street ?? f.street,
      neighborhood: data.neighborhood ?? f.neighborhood,
      city: data.city ?? f.city,
      state: data.state ?? f.state,
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Razão social/nome é obrigatório.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      fantasy_name: form.fantasy_name || null,
      document: form.document || null,
      state_registration: form.state_registration || null,
      phone: form.phone || null,
      email: form.email || null,
      zip_code: form.zip_code || null,
      street: form.street || null,
      number: form.number || null,
      complement: form.complement || null,
      neighborhood: form.neighborhood || null,
      city: form.city || null,
      state: form.state || null,
      bank_name: form.bank_name || null,
      bank_agency: form.bank_agency || null,
      bank_account: form.bank_account || null,
      pix_key: form.pix_key || null,
      category: form.category || null,
      due_days: Number(form.due_days) || 30,
      payment_terms: form.payment_terms || null,
      notes: form.notes || null,
      active: form.active,
    };
    if (supplier) {
      await update.mutateAsync({ id: supplier.id, input: payload });
    } else {
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="endereco">Endereço</TabsTrigger>
            <TabsTrigger value="banco">Bancário</TabsTrigger>
            <TabsTrigger value="extras">Extras</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Razão social / Nome *</Label>
                <Input maxLength={120} value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div>
                <Label>Nome fantasia</Label>
                <Input maxLength={120} value={form.fantasy_name} onChange={(e) => set("fantasy_name", e.target.value)} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category || undefined} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>CNPJ / CPF</Label>
                <Input
                  value={form.document}
                  onChange={(e) => set("document", maskCpfCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
              </div>
              <div>
                <Label>Inscrição estadual</Label>
                <Input maxLength={20} value={form.state_registration} onChange={(e) => set("state_registration", e.target.value)} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", maskPhone(e.target.value))}
                  placeholder="(11) 90000-0000"
                  maxLength={15}
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" maxLength={120} value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
              <Label>Fornecedor ativo</Label>
            </div>
          </TabsContent>

          <TabsContent value="endereco" className="space-y-3 pt-4">
            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-2">
                <Label>CEP</Label>
                <Input
                  value={form.zip_code}
                  onChange={(e) => set("zip_code", maskCEP(e.target.value))}
                  onBlur={handleCepBlur}
                  placeholder={cepLoading ? "Buscando..." : "00000-000"}
                  maxLength={9}
                />
              </div>
              <div className="col-span-3">
                <Label>Rua</Label>
                <Input maxLength={150} value={form.street} onChange={(e) => set("street", e.target.value)} />
              </div>
              <div>
                <Label>Número</Label>
                <Input maxLength={10} value={form.number} onChange={(e) => set("number", e.target.value)} />
              </div>
              <div className="col-span-3">
                <Label>Complemento</Label>
                <Input maxLength={80} value={form.complement} onChange={(e) => set("complement", e.target.value)} />
              </div>
              <div className="col-span-3">
                <Label>Bairro</Label>
                <Input maxLength={80} value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} />
              </div>
              <div className="col-span-4">
                <Label>Cidade</Label>
                <Input maxLength={80} value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>UF</Label>
                <Select value={form.state || undefined} onValueChange={(v) => set("state", v)}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {BR_STATES.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="banco" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Banco</Label>
                <Input maxLength={80} value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} />
              </div>
              <div>
                <Label>Agência</Label>
                <Input maxLength={10} value={form.bank_agency} onChange={(e) => set("bank_agency", e.target.value)} />
              </div>
              <div>
                <Label>Conta</Label>
                <Input maxLength={20} value={form.bank_account} onChange={(e) => set("bank_account", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Chave PIX</Label>
                <Input maxLength={120} value={form.pix_key} onChange={(e) => set("pix_key", e.target.value)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="extras" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prazo padrão (dias)</Label>
                <Input
                  type="number" min={0} max={365}
                  value={form.due_days}
                  onChange={(e) => set("due_days", Number(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground mt-1">Vencimento default das contas a pagar geradas no recebimento.</p>
              </div>
              <div>
                <Label>Condição de pagamento (texto livre)</Label>
                <Input
                  maxLength={80}
                  placeholder="Ex: 30/60/90"
                  value={form.payment_terms}
                  onChange={(e) => set("payment_terms", e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea rows={3} maxLength={500} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.name.trim() || isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

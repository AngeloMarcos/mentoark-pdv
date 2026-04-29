import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCreateTenantWithAdmin } from "@/hooks/useSuperAdmin";
import { maskCpfCnpj, maskPhone } from "@/lib/br-masks";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NewTenantDialog({ open, onOpenChange }: Props) {
  const create = useCreateTenantWithAdmin();
  const [form, setForm] = useState({
    name: "",
    document: "",
    phone: "",
    segment: "",
    admin_email: "",
  });

  const reset = () => setForm({ name: "", document: "", phone: "", segment: "", admin_email: "" });

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.admin_email.trim()) return;
    await create.mutateAsync(form);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome da empresa *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={120}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>CNPJ</Label>
              <Input
                value={form.document}
                onChange={(e) => setForm({ ...form, document: maskCpfCnpj(e.target.value) })}
                maxLength={18}
              />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                maxLength={15}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Segmento</Label>
            <Input
              value={form.segment}
              onChange={(e) => setForm({ ...form, segment: e.target.value })}
              placeholder="Ex: Mercado, Restaurante, Loja..."
              maxLength={60}
            />
          </div>
          <div className="space-y-1">
            <Label>E-mail do administrador *</Label>
            <Input
              type="email"
              value={form.admin_email}
              onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
              placeholder="admin@empresa.com"
              maxLength={255}
            />
            <p className="text-xs text-muted-foreground">
              Um link de convite será gerado e copiado para sua área de transferência.
            </p>
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={create.isPending || !form.name.trim() || !form.admin_email.trim()}
          >
            {create.isPending ? "Criando..." : "Criar empresa e gerar convite"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

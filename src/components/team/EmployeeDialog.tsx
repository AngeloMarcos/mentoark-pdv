import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Employee, useCreateEmployee, useUpdateEmployee } from "@/hooks/useEmployees";
import { DEPARTMENTS, CONTRACT_TYPES, ALL_ROLES, ROLE_LABELS, AppRole } from "@/lib/permissions";
import { maskCPF, maskPhone } from "@/lib/br-masks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
}

export function EmployeeDialog({ open, onOpenChange, employee }: Props) {
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const isEdit = !!employee;

  const [form, setForm] = useState({
    name: "",
    cpf: "",
    rg: "",
    birth_date: "",
    phone: "",
    email: "",
    role: "",
    department: "",
    hire_date: "",
    salary: "",
    contract_type: "",
    notes: "",
    active: true,
    has_access: false,
    access_role: "operator" as AppRole,
  });

  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name || "",
        cpf: employee.cpf || "",
        rg: employee.rg || "",
        birth_date: employee.birth_date || "",
        phone: employee.phone || "",
        email: employee.email || "",
        role: employee.role || "",
        department: employee.department || "",
        hire_date: employee.hire_date || "",
        salary: employee.salary?.toString() || "",
        contract_type: employee.contract_type || "",
        notes: employee.notes || "",
        active: employee.active,
        has_access: !!employee.user_id,
        access_role: "operator",
      });
    } else {
      setForm({
        name: "", cpf: "", rg: "", birth_date: "", phone: "", email: "",
        role: "", department: "", hire_date: "", salary: "", contract_type: "",
        notes: "", active: true, has_access: false, access_role: "operator",
      });
    }
  }, [employee, open]);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      cpf: form.cpf || null,
      rg: form.rg || null,
      birth_date: form.birth_date || null,
      phone: form.phone || null,
      email: form.email || null,
      role: form.role || null,
      department: form.department || null,
      hire_date: form.hire_date || null,
      salary: form.salary ? Number(form.salary) : null,
      contract_type: form.contract_type || null,
      notes: form.notes || null,
      active: form.active,
    };

    if (isEdit && employee) {
      await update.mutateAsync({ id: employee.id, data: payload });
    } else {
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="personal">Pessoais</TabsTrigger>
            <TabsTrigger value="professional">Profissionais</TabsTrigger>
            <TabsTrigger value="access">Acesso</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4 pt-4">
            <div>
              <Label>Nome*</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })} maxLength={14} />
              </div>
              <div>
                <Label>RG</Label>
                <Input value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de Nascimento</Label>
                <Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} maxLength={15} />
              </div>
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </TabsContent>

          <TabsContent value="professional" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cargo*</Label>
                <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Ex: Vendedor" />
              </div>
              <div>
                <Label>Departamento</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data de Admissão</Label>
                <Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
              </div>
              <div>
                <Label>Salário (R$)</Label>
                <Input type="number" step="0.01" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Tipo de Contrato</Label>
              <Select value={form.contract_type} onValueChange={(v) => setForm({ ...form, contract_type: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Funcionário ativo</Label>
            </div>
          </TabsContent>

          <TabsContent value="access" className="space-y-4 pt-4">
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-sm text-muted-foreground">
                Para conceder acesso ao sistema, vá até a aba <strong>Acessos</strong> do módulo Equipe e envie um convite por e-mail.
                Quando o usuário aceitar, ele será vinculado a uma conta no sistema.
              </p>
              {employee?.user_id && (
                <p className="mt-3 text-sm text-success">✓ Este funcionário já possui acesso vinculado.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.name.trim() || create.isPending || update.isPending}>
            {isEdit ? "Salvar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

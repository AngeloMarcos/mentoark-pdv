import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useCreateTenant } from "@/hooks/useTenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, LogOut } from "lucide-react";
import { TenantSelectionSkeleton } from "@/components/ui/skeletons";

const SEGMENTS = [
  { value: "farmacia", label: "Farmácia" },
  { value: "mercado", label: "Mercado" },
  { value: "bar", label: "Bar" },
  { value: "restaurante", label: "Restaurante" },
  { value: "loja", label: "Loja" },
  { value: "outro", label: "Outro" },
];

const SelectTenant = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { tenants, setCurrentTenant, isLoading: tenantsLoading, refetchTenants } = useTenant();
  const createTenant = useCreateTenant();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: "", document: "", phone: "", segment: "" });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const handleSelectTenant = (tenant: typeof tenants[0]) => {
    setCurrentTenant(tenant);
    navigate("/dashboard");
  };

  const handleCreateTenant = async () => {
    if (!newTenant.name.trim()) return;

    await createTenant.mutateAsync({
      name: newTenant.name,
      document: newTenant.document || null,
      phone: newTenant.phone || null,
      segment: newTenant.segment || null,
    });

    setDialogOpen(false);
    setNewTenant({ name: "", document: "", phone: "", segment: "" });
    refetchTenants();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (authLoading || tenantsLoading) {
    return <TenantSelectionSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Selecione a Empresa</h1>
            <p className="text-muted-foreground">Escolha qual estabelecimento deseja acessar</p>
          </div>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>

        <div className="grid gap-4">
          {tenants.map((tenant) => (
            <Card
              key={tenant.id}
              className="cursor-pointer hover:border-primary/50 transition-all stat-card"
              onClick={() => handleSelectTenant(tenant)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{tenant.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {tenant.segment && SEGMENTS.find((s) => s.value === tenant.segment)?.label}
                    {tenant.role === "admin" && " • Admin"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer border-dashed hover:border-primary/50 transition-all">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center">
                    <Plus className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Nova Empresa</h3>
                    <p className="text-sm text-muted-foreground">Cadastrar novo estabelecimento</p>
                  </div>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Empresa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nome da Empresa *</Label>
                  <Input
                    placeholder="Nome do estabelecimento"
                    value={newTenant.name}
                    onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ / Documento</Label>
                  <Input
                    placeholder="00.000.000/0000-00"
                    value={newTenant.document}
                    onChange={(e) => setNewTenant({ ...newTenant, document: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={newTenant.phone}
                    onChange={(e) => setNewTenant({ ...newTenant, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Segmento</Label>
                  <Select
                    value={newTenant.segment}
                    onValueChange={(value) => setNewTenant({ ...newTenant, segment: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEGMENTS.map((seg) => (
                        <SelectItem key={seg.value} value={seg.value}>
                          {seg.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreateTenant}
                  disabled={!newTenant.name.trim() || createTenant.isPending}
                >
                  {createTenant.isPending ? "Criando..." : "Criar Empresa"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default SelectTenant;

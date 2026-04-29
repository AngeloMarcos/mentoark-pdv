import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useIsSuperAdmin, useSuperMetrics, useSuperTenants } from "@/hooks/useSuperAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Building2, Users, ShoppingCart, TrendingUp } from "lucide-react";
import { NewTenantDialog } from "@/components/admin/NewTenantDialog";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export default function SuperAdmin() {
  const { data: isSuper, isLoading: checking } = useIsSuperAdmin();
  const { data: metrics } = useSuperMetrics();
  const { data: tenants = [], isLoading } = useSuperTenants();
  const [newOpen, setNewOpen] = useState(false);

  if (checking) {
    return (
      <AppLayout title="Super Admin">
        <Skeleton className="h-32 w-full" />
      </AppLayout>
    );
  }

  if (!isSuper) {
    return <Navigate to="/dashboard" replace />;
  }

  const fmtBRL = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

  return (
    <AppLayout title="Super Admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Painel Global</h2>
            <p className="text-sm text-muted-foreground">
              Gerencie todas as empresas da plataforma.
            </p>
          </div>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Novo Cliente
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            icon={<Building2 className="w-5 h-5" />}
            label="Empresas"
            value={metrics?.total_tenants ?? "—"}
          />
          <MetricCard
            icon={<Users className="w-5 h-5" />}
            label="Usuários"
            value={metrics?.total_users ?? "—"}
          />
          <MetricCard
            icon={<ShoppingCart className="w-5 h-5" />}
            label="Vendas (30d)"
            value={metrics?.sales_last_30d ?? "—"}
          />
          <MetricCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Receita (30d)"
            value={metrics ? fmtBRL(Number(metrics.revenue_last_30d)) : "—"}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Empresas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead className="text-right">Usuários</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Receita 30d</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nenhuma empresa cadastrada.
                      </TableCell>
                    </TableRow>
                  )}
                  {tenants.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.document || "—"}</TableCell>
                      <TableCell>{t.segment || "—"}</TableCell>
                      <TableCell className="text-right">{t.user_count}</TableCell>
                      <TableCell className="text-right">{t.sales_count}</TableCell>
                      <TableCell className="text-right">{fmtBRL(Number(t.revenue_30d))}</TableCell>
                      <TableCell>
                        {new Date(t.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <NewTenantDialog open={newOpen} onOpenChange={setNewOpen} />
    </AppLayout>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

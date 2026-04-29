import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Shield } from "lucide-react";
import { EmployeesList } from "@/components/team/EmployeesList";
import { AccessList } from "@/components/team/AccessList";
import { PermissionGuard } from "@/components/auth/PermissionGuard";

export default function Team() {
  return (
    <AppLayout title="Equipe">
      <PermissionGuard permission="team">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Equipe</h2>
            <p className="text-sm text-muted-foreground">
              Gerencie funcionários e usuários com acesso ao sistema.
            </p>
          </div>

          <Tabs defaultValue="employees" className="w-full">
            <TabsList>
              <TabsTrigger value="employees" className="gap-2">
                <Users className="w-4 h-4" /> Funcionários
              </TabsTrigger>
              <TabsTrigger value="access" className="gap-2">
                <Shield className="w-4 h-4" /> Acessos
              </TabsTrigger>
            </TabsList>
            <TabsContent value="employees" className="pt-4"><EmployeesList /></TabsContent>
            <TabsContent value="access" className="pt-4"><AccessList /></TabsContent>
          </Tabs>
        </div>
      </PermissionGuard>
    </AppLayout>
  );
}

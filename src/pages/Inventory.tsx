import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList, Plus, Play, Eye } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useInventoryCounts,
  getInventoryStatusLabel,
  getInventoryStatusColor,
} from "@/hooks/useInventory";
import { InventoryWizard } from "@/components/stock/InventoryWizard";

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const inventoryId = searchParams.get("id");
  const [showWizard, setShowWizard] = useState(!!inventoryId);
  const [selectedId, setSelectedId] = useState<string | undefined>(inventoryId || undefined);

  const { data: inventories = [], isLoading } = useInventoryCounts();

  const handleNewInventory = () => {
    setSelectedId(undefined);
    setShowWizard(true);
  };

  const handleViewInventory = (id: string) => {
    setSelectedId(id);
    setSearchParams({ id });
    setShowWizard(true);
  };

  const handleCloseWizard = () => {
    setShowWizard(false);
    setSelectedId(undefined);
    setSearchParams({});
  };

  const inProgressCount = inventories.filter((i) => i.status === "in_progress").length;
  const completedCount = inventories.filter((i) => i.status === "completed").length;

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <ClipboardList className="h-8 w-8" />
              Inventário
            </h1>
            <p className="text-muted-foreground">
              Gerencie contagens de estoque e ajustes
            </p>
          </div>
          <Button onClick={handleNewInventory}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Inventário
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inventories.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Em Andamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{inProgressCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Finalizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{completedCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Inventory List */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Inventários</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Carregando...</p>
            ) : inventories.length === 0 ? (
              <div className="text-center py-8">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Nenhum inventário realizado ainda.</p>
                <Button className="mt-4" onClick={handleNewInventory}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Inventário
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Produtos</TableHead>
                    <TableHead>Diferença</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventories.map((inventory) => (
                    <TableRow key={inventory.id}>
                      <TableCell className="font-medium">{inventory.name}</TableCell>
                      <TableCell>
                        <Badge variant={getInventoryStatusColor(inventory.status)}>
                          {getInventoryStatusLabel(inventory.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{inventory.total_products}</TableCell>
                      <TableCell>
                        <span
                          className={
                            inventory.total_difference_value < 0
                              ? "text-destructive"
                              : inventory.total_difference_value > 0
                              ? "text-green-500"
                              : ""
                          }
                        >
                          {inventory.total_difference_value.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(inventory.created_at), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewInventory(inventory.id)}
                        >
                          {inventory.status === "in_progress" ? (
                            <>
                              <Play className="h-4 w-4 mr-1" />
                              Continuar
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {showWizard && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50">
          <div className="container mx-auto p-4 md:p-6 max-w-4xl h-full overflow-y-auto">
            <InventoryWizard inventoryId={selectedId} onClose={handleCloseWizard} />
          </div>
        </div>
      )}
    </AppLayout>
  );
}

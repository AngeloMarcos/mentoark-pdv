import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Users, Clock, Settings, UtensilsCrossed, Receipt } from 'lucide-react';
import { useTables, useCreateTable, useUpdateTable, useUpdateTableStatus, type Table } from '@/hooks/useTables';
import { useOpenTabs, useCreateTab, type Tab } from '@/hooks/useTabs';
import { useOpenTabTotals } from '@/hooks/useTabBilling';
import { CloseTabDialog } from '@/components/restaurant/CloseTabDialog';
import { NewTabDialog } from '@/components/restaurant/NewTabDialog';

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TableGridSkeleton } from '@/components/ui/skeletons';


export default function Tables() {
  const navigate = useNavigate();
  const { data: tables = [], isLoading: tablesLoading } = useTables();
  const { data: openTabs = [] } = useOpenTabs();
  const { data: tabTotals = {} } = useOpenTabTotals();
  const createTable = useCreateTable();
  const updateTable = useUpdateTable();
  const updateTableStatus = useUpdateTableStatus();
  

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [closingTab, setClosingTab] = useState<{ id: string; label: string; people?: number | null } | null>(null);
  const [newTab, setNewTab] = useState<{ open: boolean; tableId?: string | null; label?: string | null }>({ open: false });
  const [formData, setFormData] = useState({ number: '', name: '', capacity: '' });



  // Map tables to their active tabs
  const tabsByTable = openTabs.reduce((acc, tab) => {
    if (tab.table_id) {
      acc[tab.table_id] = tab;
    }
    return acc;
  }, {} as Record<string, Tab>);

  // Tabs without tables (avulsas)
  const looseTabs = openTabs.filter(tab => !tab.table_id);

  const handleCreateTable = async () => {
    if (!formData.number) return;

    await createTable.mutateAsync({
      number: formData.number,
      name: formData.name || undefined,
      capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
    });

    setFormData({ number: '', name: '', capacity: '' });
    setIsCreateOpen(false);
  };

  const handleTableClick = async (table: Table) => {
    const activeTab = tabsByTable[table.id];

    if (activeTab) {
      navigate(`/tabs/${activeTab.id}`);
    } else {
      setNewTab({ open: true, tableId: table.id, label: `Mesa ${table.number}` });
    }
  };

  const handleLooseTabClick = (tab: Tab) => {
    navigate(`/tabs/${tab.id}`);
  };

  const handleCreateLooseTab = () => {
    setNewTab({ open: true, tableId: null });
  };


  const getStatusColor = (status: string, hasActiveTab: boolean) => {
    if (hasActiveTab || status === 'occupied') return 'bg-destructive/10 border-destructive text-destructive';
    if (status === 'reserved') return 'bg-warning/10 border-warning text-warning';
    return 'bg-primary/10 border-primary text-primary';
  };

  const getStatusLabel = (status: string, hasActiveTab: boolean) => {
    if (hasActiveTab || status === 'occupied') return 'Ocupada';
    if (status === 'reserved') return 'Reservada';
    return 'Livre';
  };

  return (
    <AppLayout title="Mesas & Comandas">
      <div className="space-y-6">
        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Mesa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Mesa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="number">Número *</Label>
                  <Input
                    id="number"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    placeholder="Ex: 01, A1, Balcão"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome (opcional)</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Mesa do Canto"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacidade</Label>
                  <Input
                    id="capacity"
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    placeholder="Ex: 4"
                  />
                </div>
                <Button onClick={handleCreateTable} className="w-full" disabled={createTable.isPending}>
                  {createTable.isPending ? 'Criando...' : 'Criar Mesa'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleCreateLooseTab}>
            <UtensilsCrossed className="h-4 w-4 mr-2" />
            Comanda Avulsa
          </Button>

          <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost">
                <Settings className="h-4 w-4 mr-2" />
                Gerenciar Mesas
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Gerenciar Mesas</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-4 max-h-96 overflow-auto">
                {tables.map((table) => (
                  <div key={table.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">Mesa {table.number}</p>
                      {table.name && <p className="text-sm text-muted-foreground">{table.name}</p>}
                    </div>
                    <Select
                      value={table.status}
                      onValueChange={(value) =>
                        updateTableStatus.mutate({ id: table.id, status: value as Table['status'] })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Livre</SelectItem>
                        <SelectItem value="occupied">Ocupada</SelectItem>
                        <SelectItem value="reserved">Reservada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {tables.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma mesa cadastrada
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tables Grid */}
        {tablesLoading ? (
          <TableGridSkeleton count={6} />
        ) : tables.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {tables.map((table) => {
              const activeTab = tabsByTable[table.id];
              const hasActiveTab = !!activeTab;

              return (
                <Card
                  key={table.id}
                  className={`cursor-pointer transition-all hover:scale-105 border-2 ${getStatusColor(table.status, hasActiveTab)}`}
                  onClick={() => handleTableClick(table)}
                >
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold mb-1">{table.number}</p>
                    {table.name && (
                      <p className="text-xs opacity-70 truncate">{table.name}</p>
                    )}
                    <p className="text-sm font-medium mt-2">
                      {getStatusLabel(table.status, hasActiveTab)}
                    </p>
                    {table.capacity && (
                      <div className="flex items-center justify-center gap-1 mt-1 text-xs opacity-70">
                        <Users className="h-3 w-3" />
                        <span>{table.capacity}</span>
                      </div>
                    )}
                    {activeTab && (
                      <>
                        <div className="flex items-center justify-center gap-1 mt-2 text-xs">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatDistanceToNow(new Date(activeTab.opened_at), {
                              addSuffix: false,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold">
                          {(tabTotals[activeTab.id] ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <Button
                          size="sm"
                          className="w-full mt-2 h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setClosingTab({
                              id: activeTab.id,
                              label: `Mesa ${table.number}`,
                              people: activeTab.people_count,
                            });
                          }}
                        >
                          <Receipt className="h-3 w-3 mr-1" />
                          Fechar conta
                        </Button>
                      </>
                    )}

                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma mesa cadastrada</h3>
            <p className="text-muted-foreground mb-4">
              Crie mesas para começar a usar o sistema de comandas
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Mesa
            </Button>
          </Card>
        )}

        {/* Loose Tabs Section */}
        {looseTabs.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Comandas Avulsas</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {looseTabs.map((tab) => (
                <Card
                  key={tab.id}
                  className="cursor-pointer transition-all hover:scale-105 border-2 bg-secondary/10 border-secondary"
                  onClick={() => handleLooseTabClick(tab)}
                >
                  <CardContent className="p-4 text-center">
                    <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 text-secondary-foreground" />
                    <p className="font-medium truncate">
                      {tab.customer_name || `#${tab.id.slice(0, 6)}`}
                    </p>
                    <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(new Date(tab.opened_at), {
                          addSuffix: false,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold">
                      {(tabTotals[tab.id] ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    <Button
                      size="sm"
                      className="w-full mt-2 h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClosingTab({
                          id: tab.id,
                          label: tab.customer_name || `#${tab.id.slice(0, 6)}`,
                          people: tab.people_count,
                        });
                      }}
                    >
                      <Receipt className="h-3 w-3 mr-1" />
                      Fechar conta
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {closingTab && (
          <CloseTabDialog
            open={!!closingTab}
            onOpenChange={(o) => !o && setClosingTab(null)}
            tabId={closingTab.id}
            tabLabel={closingTab.label}
            peopleCount={closingTab.people}
            onClosed={() => setClosingTab(null)}
          />
        )}
      </div>

    </AppLayout>
  );
}

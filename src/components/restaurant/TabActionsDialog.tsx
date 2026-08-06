import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeftRight, Merge, Users } from 'lucide-react';
import { useTables } from '@/hooks/useTables';
import { useOpenTabs, useUpdateTab } from '@/hooks/useTabs';
import { useMergeTabs, useTransferTab } from '@/hooks/useOrders';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabId: string;
  currentTableId?: string | null;
  peopleCount?: number | null;
  onDone?: () => void;
}

export function TabActionsDialog({ open, onOpenChange, tabId, currentTableId, peopleCount, onDone }: Props) {
  const { data: tables = [] } = useTables();
  const { data: tabs = [] } = useOpenTabs();
  const transferTab = useTransferTab();
  const mergeTabs = useMergeTabs();
  const updateTab = useUpdateTab();

  const [targetTable, setTargetTable] = useState<string>('');
  const [targetTab, setTargetTab] = useState<string>('');
  const [people, setPeople] = useState(peopleCount && peopleCount > 0 ? peopleCount : 1);

  const otherTabs = tabs.filter((t) => t.id !== tabId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ações da comanda</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4" /> Número de pessoas
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                value={people}
                onChange={(e) => setPeople(Math.max(1, Number(e.target.value) || 1))}
                className="h-11"
              />
              <Button
                variant="secondary"
                className="h-11"
                onClick={async () => {
                  await updateTab.mutateAsync({ tabId, people_count: people });
                  onDone?.();
                }}
              >
                Salvar
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <ArrowLeftRight className="w-4 h-4" /> Transferir de mesa
            </Label>
            <Select value={targetTable} onValueChange={setTargetTable}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Escolha a mesa destino" />
              </SelectTrigger>
              <SelectContent>
                {tables
                  .filter((t) => t.id !== currentTableId)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      Mesa {t.number} {t.name ? `· ${t.name}` : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full h-11"
              variant="secondary"
              disabled={!targetTable || transferTab.isPending}
              onClick={async () => {
                await transferTab.mutateAsync({ tabId, tableId: targetTable });
                setTargetTable('');
                onOpenChange(false);
                onDone?.();
              }}
            >
              Transferir
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Merge className="w-4 h-4" /> Juntar com outra comanda
            </Label>
            <Select value={targetTab} onValueChange={setTargetTab}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Comanda destino" />
              </SelectTrigger>
              <SelectContent>
                {otherTabs.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.table ? `Mesa ${t.table.number}` : t.customer_name || `Comanda ${t.id.slice(0, 6)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full h-11"
              variant="secondary"
              disabled={!targetTab || mergeTabs.isPending}
              onClick={async () => {
                await mergeTabs.mutateAsync({ sourceTabId: tabId, targetTabId: targetTab });
                setTargetTab('');
                onOpenChange(false);
                onDone?.();
              }}
            >
              Juntar comandas
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Os itens desta comanda serão movidos para a comanda escolhida.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

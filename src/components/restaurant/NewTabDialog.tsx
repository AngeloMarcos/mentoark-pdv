import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, Plus } from 'lucide-react';
import { useCreateTab, useUpdateTab } from '@/hooks/useTabs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mesa vinculada (opcional). Sem mesa => comanda avulsa/balcão. */
  tableId?: string | null;
  tableLabel?: string | null;
  onCreated?: (tabId: string) => void;
}

/** Abertura de comanda com nome do cliente, pessoas e observações. */
export function NewTabDialog({ open, onOpenChange, tableId, tableLabel, onCreated }: Props) {
  const createTab = useCreateTab();
  const updateTab = useUpdateTab();
  const [customerName, setCustomerName] = useState('');
  const [people, setPeople] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setCustomerName('');
      setPeople(1);
      setNotes('');
    }
  }, [open]);

  const submit = async () => {
    const tab = await createTab.mutateAsync({
      table_id: tableId || undefined,
      customer_name: customerName.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    const id = (tab as { id?: string } | null)?.id;
    if (id && people > 1) {
      await updateTab.mutateAsync({ tabId: id, people_count: people });
    }
    onOpenChange(false);
    if (id) onCreated?.(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {tableId ? `Abrir comanda · ${tableLabel ?? 'Mesa'}` : 'Abrir comanda avulsa'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do cliente (opcional)</Label>
            <Input
              autoFocus
              className="h-11"
              placeholder="Ex: João, Aniversário Ana..."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Número de pessoas
            </Label>
            <Input
              type="number"
              min={1}
              className="h-11"
              value={people}
              onChange={(e) => setPeople(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              rows={2}
              placeholder="Ex: cliente com reserva, alergia a camarão..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button className="w-full h-11" disabled={createTab.isPending} onClick={submit}>
            <Plus className="h-4 w-4 mr-2" /> Abrir comanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

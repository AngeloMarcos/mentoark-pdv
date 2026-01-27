import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCashRegisters, useOpenCash, useCreateCashRegister } from "@/hooks/useCashRegister";
import { DollarSign, Plus } from "lucide-react";

interface OpenCashDialogProps {
  onSuccess?: () => void;
}

export function OpenCashDialog({ onSuccess }: OpenCashDialogProps) {
  const [registerId, setRegisterId] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [showNewRegister, setShowNewRegister] = useState(false);
  const [newRegisterName, setNewRegisterName] = useState("");
  const [newRegisterCode, setNewRegisterCode] = useState("");

  const { data: registers = [], isLoading } = useCashRegisters();
  const openCash = useOpenCash();
  const createRegister = useCreateCashRegister();

  const handleOpenCash = async () => {
    if (!registerId || !openingBalance) return;

    await openCash.mutateAsync({
      register_id: registerId,
      opening_balance: parseFloat(openingBalance),
      notes: notes || undefined,
    });

    onSuccess?.();
  };

  const handleCreateRegister = async () => {
    if (!newRegisterName || !newRegisterCode) return;

    const register = await createRegister.mutateAsync({
      name: newRegisterName,
      code: newRegisterCode,
    });

    setRegisterId(register.id);
    setShowNewRegister(false);
    setNewRegisterName("");
    setNewRegisterCode("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg">
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
          <DollarSign className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">Abertura de Caixa</h3>
          <p className="text-sm text-muted-foreground">Informe o caixa e o fundo inicial</p>
        </div>
      </div>

      {!showNewRegister ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Caixa/PDV *</Label>
            {isLoading ? (
              <div className="h-10 bg-muted animate-pulse rounded-md" />
            ) : registers.length === 0 ? (
              <Button variant="outline" className="w-full" onClick={() => setShowNewRegister(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Configurar primeiro caixa
              </Button>
            ) : (
              <div className="flex gap-2">
                <Select value={registerId} onValueChange={setRegisterId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione o caixa" />
                  </SelectTrigger>
                  <SelectContent>
                    {registers.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => setShowNewRegister(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Fundo de Caixa (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Valor em dinheiro disponível no caixa para troco
            </p>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações opcionais..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleOpenCash}
            disabled={!registerId || !openingBalance || openCash.isPending}
          >
            {openCash.isPending ? "Abrindo..." : "Abrir Caixa"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-medium">Novo Caixa/PDV</h4>
          
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              placeholder="Ex: Caixa 1, PDV Principal"
              value={newRegisterName}
              onChange={(e) => setNewRegisterName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Código *</Label>
            <Input
              placeholder="Ex: CX01, PDV01"
              value={newRegisterCode}
              onChange={(e) => setNewRegisterCode(e.target.value.toUpperCase())}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowNewRegister(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleCreateRegister}
              disabled={!newRegisterName || !newRegisterCode || createRegister.isPending}
              className="flex-1"
            >
              {createRegister.isPending ? "Criando..." : "Criar Caixa"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

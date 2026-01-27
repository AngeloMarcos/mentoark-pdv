import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateCashMovement } from "@/hooks/useCashRegister";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

interface CashMovementDialogProps {
  sessionId: string;
  onSuccess?: () => void;
}

export function CashMovementDialog({ sessionId, onSuccess }: CashMovementDialogProps) {
  const [type, setType] = useState<"supply" | "withdrawal">("supply");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const createMovement = useCreateCashMovement();

  const handleSubmit = async () => {
    if (!amount || !description) return;

    await createMovement.mutateAsync({
      session_id: sessionId,
      movement_type: type,
      amount: parseFloat(amount),
      description,
    });

    setAmount("");
    setDescription("");
    onSuccess?.();
  };

  return (
    <div className="space-y-4">
      <Tabs value={type} onValueChange={(v) => setType(v as "supply" | "withdrawal")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="supply" className="flex items-center gap-2">
            <ArrowDownCircle className="w-4 h-4 text-success" />
            Suprimento
          </TabsTrigger>
          <TabsTrigger value="withdrawal" className="flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4 text-destructive" />
            Sangria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="supply" className="mt-4">
          <div className="p-4 bg-success/10 rounded-lg mb-4">
            <h4 className="font-medium text-success">Suprimento de Caixa</h4>
            <p className="text-sm text-muted-foreground">
              Adicione dinheiro ao caixa (ex: troco adicional, devolução)
            </p>
          </div>
        </TabsContent>

        <TabsContent value="withdrawal" className="mt-4">
          <div className="p-4 bg-destructive/10 rounded-lg mb-4">
            <h4 className="font-medium text-destructive">Sangria de Caixa</h4>
            <p className="text-sm text-muted-foreground">
              Retire dinheiro do caixa (ex: pagamento de despesa, retirada para cofre)
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Valor (R$) *</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Descrição/Motivo *</Label>
          <Textarea
            placeholder={
              type === "supply"
                ? "Ex: Troco adicional, devolução de cliente..."
                : "Ex: Pagamento de entrega, retirada para cofre..."
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <Button
          className="w-full"
          variant={type === "supply" ? "default" : "destructive"}
          onClick={handleSubmit}
          disabled={!amount || !description || createMovement.isPending}
        >
          {createMovement.isPending
            ? "Registrando..."
            : type === "supply"
            ? "Registrar Suprimento"
            : "Registrar Sangria"
          }
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/utils";
import { lineGross } from "@/lib/money";
import { formatQty, parseQty } from "@/lib/weighing";

export interface WeightTarget {
  product_id: string;
  product_name: string;
  unit: string;
  unit_price: number;
  /** Quantidade atual, quando é correção de um item já no carrinho. */
  current?: number;
}

interface Props {
  target: WeightTarget | null;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}

const UNIT_LABEL: Record<string, string> = { KG: "Peso (kg)", L: "Volume (litros)", M: "Medida (metros)" };

/** Pede o peso/medida de um produto vendido a granel. */
export function WeightDialog({ target, onClose, onConfirm }: Props) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (target) setText(target.current ? String(target.current).replace(".", ",") : "");
  }, [target]);

  const qty = parseQty(text);
  const unit = target?.unit.toUpperCase() ?? "KG";

  const submit = () => {
    if (qty) onConfirm(qty);
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{target?.product_name}</DialogTitle>
          <DialogDescription>
            {target && `${formatBRL(target.unit_price)} por ${unit.toLowerCase()}`}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <Label htmlFor="weight-input">{UNIT_LABEL[unit] ?? "Quantidade"}</Label>
            <Input
              id="weight-input"
              autoFocus
              inputMode="decimal"
              placeholder="0,000"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="h-14 text-2xl text-right font-semibold"
              aria-invalid={text !== "" && !qty}
            />
            {text !== "" && !qty && (
              <p className="text-sm text-destructive">Digite um valor maior que zero, ex.: 0,375</p>
            )}
          </div>

          <div className="flex justify-between rounded-lg bg-muted p-3">
            <span className="text-muted-foreground">{qty ? formatQty(qty, unit) : "—"}</span>
            <span className="text-lg font-bold">
              {qty && target ? formatBRL(lineGross(qty, target.unit_price)) : formatBRL(0)}
            </span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!qty}>
              {target?.current ? "Corrigir" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

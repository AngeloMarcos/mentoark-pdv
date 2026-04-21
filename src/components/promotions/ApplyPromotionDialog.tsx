import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag, Percent, DollarSign, X } from "lucide-react";
import { useApplicablePromotions, calcPromotionDiscount, Promotion } from "@/hooks/usePromotions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  onApply: (promo: Promotion, discountAmount: number) => void;
  onClear: () => void;
  hasDiscount: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export function ApplyPromotionDialog({
  open, onOpenChange, productId, productName, unitPrice, quantity,
  onApply, onClear, hasDiscount,
}: Props) {
  const { data: promotions = [], isLoading } = useApplicablePromotions(open ? productId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" /> Aplicar promoção
          </DialogTitle>
          <DialogDescription>
            <strong>{productName}</strong> — {quantity} × {fmt(unitPrice)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando…</p>
          ) : promotions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma promoção ativa aplicável a este produto.
            </p>
          ) : (
            promotions.map((p) => {
              const discount = calcPromotionDiscount(p, unitPrice, quantity);
              const finalTotal = unitPrice * quantity - discount;
              return (
                <button
                  key={p.id}
                  className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  onClick={() => {
                    onApply(p, discount);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{p.name}</div>
                      {p.description && (
                        <div className="text-xs text-muted-foreground">{p.description}</div>
                      )}
                    </div>
                    <Badge className="gap-1 shrink-0">
                      {p.discount_type === "percentage" ? (
                        <><Percent className="w-3 h-3" />{p.discount_value}%</>
                      ) : (
                        <><DollarSign className="w-3 h-3" />{fmt(p.discount_value)}</>
                      )}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-success">- {fmt(discount)}</span>
                    <span className="font-semibold">Total: {fmt(finalTotal)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {hasDiscount && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onClear();
              onOpenChange(false);
            }}
          >
            <X className="w-4 h-4 mr-2" /> Remover desconto atual
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

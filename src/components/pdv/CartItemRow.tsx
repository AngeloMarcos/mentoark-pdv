import { memo } from "react";
import { Minus, Plus, Scale, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import { formatQty, sellsFractional } from "@/lib/weighing";

export interface CartRowItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  promotion_id?: string | null;
  promotion_name?: string | null;
  unit?: string | null;
}

interface Props {
  item: CartRowItem;
  onQuantity: (productId: string, delta: number) => void;
  onRemove: (productId: string) => void;
  onPromotion: (productId: string) => void;
  /** Item a granel: abre a janela de peso para corrigir. */
  onEditWeight: (productId: string) => void;
}

/** Linha do carrinho. Memoizada: só re-renderiza quando o próprio item muda. */
export const CartItemRow = memo(function CartItemRow({ item, onQuantity, onRemove, onPromotion, onEditWeight }: Props) {
  const fractional = sellsFractional(item.unit);
  return (
    <li className="pdv-item flex-wrap">
      <div className="flex-1 min-w-[8rem]">
        <div className="font-medium truncate">{item.product_name}</div>
        <div className="text-sm text-muted-foreground">
          {formatBRL(item.unit_price)}{fractional ? `/${String(item.unit).toLowerCase()}` : ""} × {formatQty(item.quantity, item.unit)}
        </div>
        {item.promotion_name && (
          <Badge className="mt-1 gap-1 text-[10px]">
            <Tag className="w-3 h-3" aria-hidden="true" /> {item.promotion_name} (-{formatBRL(item.discount)})
          </Badge>
        )}
      </div>
      <div className="font-semibold w-24 text-right">{formatBRL(item.total)}</div>
      <div className="flex items-center gap-1 ml-auto">
        {fractional ? (
          <Button
            variant="outline"
            className="h-12 min-w-[7.5rem] font-medium"
            aria-label={`Corrigir peso de ${item.product_name}: ${formatQty(item.quantity, item.unit)}`}
            onClick={() => onEditWeight(item.product_id)}
          >
            <Scale className="mr-1" aria-hidden="true" />
            {formatQty(item.quantity, item.unit)}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12"
              aria-label={`Diminuir quantidade de ${item.product_name}`}
              onClick={() => onQuantity(item.product_id, -1)}
            >
              <Minus aria-hidden="true" />
            </Button>
            <span className="w-8 text-center font-medium" aria-label={`Quantidade: ${item.quantity}`}>
              {item.quantity}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12"
              aria-label={`Aumentar quantidade de ${item.product_name}`}
              onClick={() => onQuantity(item.product_id, 1)}
            >
              <Plus aria-hidden="true" />
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12"
          aria-label={`Aplicar promoção em ${item.product_name}`}
          aria-pressed={!!item.promotion_id}
          onClick={() => onPromotion(item.product_id)}
        >
          <Tag className={item.promotion_id ? "text-primary" : ""} aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12"
          aria-label={`Remover ${item.product_name} do carrinho`}
          onClick={() => onRemove(item.product_id)}
        >
          <Trash2 className="text-destructive" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
});

import { memo } from "react";
import type { TaxPriceMode, TaxResult } from "@/lib/tax/engine";
import { formatBRL } from "@/lib/utils";

const MODE_LABEL: Record<TaxPriceMode, string> = {
  informativo: "destaque informativo",
  por_dentro: "já incluídos no preço",
  por_fora: "somados ao total",
};

interface Props {
  result: TaxResult | null;
  modo: TaxPriceMode;
}

/** Detalhamento de IBS, CBS e IS do carrinho (calculado no Web Worker). */
export const CartTaxSummary = memo(function CartTaxSummary({ result, modo }: Props) {
  if (!result) return null;
  const t = result.totals;
  return (
    <div className="text-xs text-muted-foreground space-y-0.5" aria-live="polite">
      <div className="flex justify-between">
        <span>IBS</span>
        <span>{formatBRL(t.vIBS)}</span>
      </div>
      <div className="flex justify-between">
        <span>CBS</span>
        <span>{formatBRL(t.vCBS)}</span>
      </div>
      {t.vIS > 0 && (
        <div className="flex justify-between">
          <span>Imposto Seletivo</span>
          <span>{formatBRL(t.vIS)}</span>
        </div>
      )}
      <div className="flex justify-between font-medium">
        <span>Tributos ({MODE_LABEL[modo]})</span>
        <span>{formatBRL(t.vTributos)}</span>
      </div>
    </div>
  );
});

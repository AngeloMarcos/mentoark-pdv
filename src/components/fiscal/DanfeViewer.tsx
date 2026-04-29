import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Copy } from "lucide-react";
import { FiscalDocument } from "@/hooks/useFiscalDocuments";
import { formatChave } from "@/lib/fiscal-utils";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";

interface Props {
  document: FiscalDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional sale items to render the body */
  items?: Array<{ product_name: string; quantity: number; unit_price: number; total: number; unit?: string }>;
  paymentLabel?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function DanfeViewer({ document, open, onOpenChange, items = [], paymentLabel }: Props) {
  const { currentTenant } = useTenant();

  useEffect(() => {
    // Auto-focus print on Ctrl+P helper not needed
  }, []);

  if (!document) return null;
  const isProd = document.ambiente === "producao";
  const date = new Date(document.created_at);

  const copyChave = async () => {
    if (!document.chave_acesso) return;
    await navigator.clipboard.writeText(document.chave_acesso);
    toast.success("Chave copiada!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="px-4 pt-4 no-print">
          <DialogTitle className="flex items-center justify-between">
            <span>Cupom Fiscal {document.document_type.toUpperCase()}</span>
            {!isProd && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                HOMOLOGAÇÃO
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Receipt */}
        <div id="danfe-print-area" className="px-6 py-4 font-mono text-xs bg-background text-foreground">
          <div className="text-center space-y-0.5">
            <div className="font-bold text-sm uppercase">{currentTenant?.name || "EMPRESA"}</div>
            {currentTenant?.document && <div>CNPJ: {currentTenant.document}</div>}
          </div>
          <div className="my-2 border-t border-dashed" />

          <div className="text-center space-y-0.5">
            <div className="font-bold">
              {document.document_type.toUpperCase()} Nº {String(document.numero_nota || 0).padStart(6, "0")} Série {document.serie}
            </div>
            <div>Data: {date.toLocaleString("pt-BR")}</div>
            <div className="font-bold">Ambiente: {isProd ? "PRODUÇÃO" : "HOMOLOGAÇÃO"}</div>
          </div>
          <div className="my-2 border-t border-dashed" />

          <div className="grid grid-cols-[20px_1fr_50px_70px] gap-1 font-bold">
            <div>#</div><div>Descrição</div><div className="text-right">Qtd</div><div className="text-right">Valor</div>
          </div>
          <div className="my-1 border-t border-dashed" />
          {items.length === 0 ? (
            <div className="text-center text-muted-foreground py-2">— sem itens —</div>
          ) : (
            items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-[20px_1fr_50px_70px] gap-1 py-0.5">
                <div>{String(idx + 1).padStart(3, "0")}</div>
                <div className="truncate">{it.product_name}</div>
                <div className="text-right">{it.quantity} {it.unit || "UN"}</div>
                <div className="text-right">{fmt(it.total)}</div>
              </div>
            ))
          )}

          <div className="my-2 border-t border-dashed" />
          <div className="space-y-0.5">
            <div className="flex justify-between"><span>SUBTOTAL</span><span>{fmt(document.valor_total)}</span></div>
            <div className="flex justify-between"><span>IMPOSTOS APROX. (Lei 12.741)</span><span>{fmt(document.valor_impostos)}</span></div>
            <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>{fmt(document.valor_total)}</span></div>
          </div>

          {paymentLabel && (
            <>
              <div className="my-2 border-t border-dashed" />
              <div className="font-bold">PAGAMENTO</div>
              <div className="flex justify-between"><span>{paymentLabel}</span><span>{fmt(document.valor_total)}</span></div>
            </>
          )}

          <div className="my-2 border-t border-dashed" />
          <div className="text-center font-bold mb-1">Chave de Acesso</div>
          <div className="text-center break-all">
            {document.chave_acesso ? formatChave(document.chave_acesso) : "—"}
          </div>

          <div className="my-2 border-t border-dashed" />
          <div className="text-center bg-muted py-1 px-2 rounded">
            QR Code disponível após integração com SEFAZ
          </div>

          <div className="my-2 border-t border-dashed" />
          <div className="text-center font-bold text-amber-700 dark:text-amber-400">
            *** DOCUMENTO SEM VALIDADE FISCAL ***
            <br />
            *** AMBIENTE DE {isProd ? "PRODUÇÃO" : "HOMOLOGAÇÃO"} ***
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t no-print">
          <Button variant="outline" className="flex-1" onClick={copyChave}>
            <Copy className="w-4 h-4 mr-2" /> Copiar chave
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

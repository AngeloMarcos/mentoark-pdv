import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { PixQRCode } from "./PixQRCode";

interface SaleItem {
  product_name?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
}

interface ReceiptData {
  saleId: string;
  datetime: Date;
  items: SaleItem[];
  grossTotal: number;
  discountTotal: number;
  netTotal: number;
  paymentMethod: string;
  customerName?: string;
  tenantName: string;
  tenantDocument?: string;
  tenantPhone?: string;
  cashierName?: string;
  pixKey?: string;
}

interface ReceiptPreviewProps {
  data: ReceiptData;
  paperWidth?: 58 | 80;
  onPrint?: () => void;
}

export function ReceiptPreview({ data, paperWidth = 80, onPrint }: ReceiptPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);

  const charWidth = paperWidth === 58 ? 32 : 48;
  const separator = "-".repeat(charWidth);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cupom - Venda #${data.saleId.slice(0, 8)}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Courier New', monospace;
              font-size: ${paperWidth === 58 ? "10pt" : "11pt"};
              width: ${paperWidth}mm;
              padding: 2mm;
            }
            .receipt { text-align: center; }
            .header { margin-bottom: 4mm; }
            .header h1 { font-size: ${paperWidth === 58 ? "12pt" : "14pt"}; }
            .separator { margin: 2mm 0; }
            .item { text-align: left; margin: 1mm 0; }
            .item-name { font-weight: normal; }
            .item-details { display: flex; justify-content: space-between; font-size: 9pt; }
            .totals { text-align: right; margin-top: 4mm; }
            .totals-line { display: flex; justify-content: space-between; }
            .total-final { font-weight: bold; font-size: 12pt; margin-top: 2mm; }
            .footer { margin-top: 4mm; font-size: 9pt; text-align: center; }
            .qr-container { margin: 4mm auto; text-align: center; }
            .qr-container img, .qr-container svg { max-width: 40mm; }
            @media print {
              body { width: ${paperWidth}mm !important; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      onPrint?.();
    }, 250);
  };

  return (
    <div className="space-y-4">
      <div
        ref={printRef}
        className="receipt bg-white text-black p-4 rounded border font-mono text-sm mx-auto"
        style={{ width: `${paperWidth}mm`, minWidth: "200px" }}
      >
        {/* Header */}
        <div className="header text-center">
          <h1 className="font-bold text-base">{data.tenantName}</h1>
          {data.tenantDocument && (
            <p className="text-xs">CNPJ: {data.tenantDocument}</p>
          )}
          {data.tenantPhone && <p className="text-xs">Tel: {data.tenantPhone}</p>}
        </div>

        <p className="separator text-center">{separator}</p>

        {/* Info da venda */}
        <div className="text-xs">
          <p>Venda: #{data.saleId.slice(0, 8)}</p>
          <p>Data: {formatDate(data.datetime)}</p>
          {data.customerName && <p>Cliente: {data.customerName}</p>}
          {data.cashierName && <p>Operador: {data.cashierName}</p>}
        </div>

        <p className="separator text-center">{separator}</p>

        {/* Itens */}
        <div className="items">
          {data.items.map((item, index) => (
            <div key={index} className="item py-1">
              <p className="item-name text-xs">{item.product_name || "Produto"}</p>
              <div className="item-details text-xs flex justify-between">
                <span>
                  {item.quantity} x {formatCurrency(item.unit_price)}
                  {item.discount > 0 && ` (-${formatCurrency(item.discount)})`}
                </span>
                <span>{formatCurrency(item.total)}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="separator text-center">{separator}</p>

        {/* Totais */}
        <div className="totals space-y-1">
          <div className="totals-line flex justify-between text-xs">
            <span>Subtotal:</span>
            <span>{formatCurrency(data.grossTotal)}</span>
          </div>
          {data.discountTotal > 0 && (
            <div className="totals-line flex justify-between text-xs">
              <span>Desconto:</span>
              <span>-{formatCurrency(data.discountTotal)}</span>
            </div>
          )}
          <div className="total-final totals-line flex justify-between font-bold text-sm pt-1 border-t border-dashed">
            <span>TOTAL:</span>
            <span>{formatCurrency(data.netTotal)}</span>
          </div>
        </div>

        <p className="separator text-center">{separator}</p>

        {/* Forma de pagamento */}
        <div className="text-xs text-center">
          <p>Forma de pagamento: {data.paymentMethod}</p>
        </div>

        {/* QR Code PIX */}
        {data.pixKey && data.paymentMethod.toLowerCase().includes("pix") && (
          <div className="qr-container my-4">
            <p className="text-xs mb-2">Escaneie para pagar via PIX:</p>
            <PixQRCode
              pixKey={data.pixKey}
              merchantName={data.tenantName}
              amount={data.netTotal}
              size={120}
            />
          </div>
        )}

        {/* Footer */}
        <div className="footer text-center text-xs mt-4">
          <p>Obrigado pela preferência!</p>
          <p className="mt-1 text-[8pt] text-gray-600">
            Documento não fiscal
          </p>
        </div>
      </div>

      <div className="flex justify-center">
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir Cupom
        </Button>
      </div>
    </div>
  );
}

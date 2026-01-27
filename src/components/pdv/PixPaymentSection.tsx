import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PixQRCode } from "@/components/print/PixQRCode";

interface PixPaymentSectionProps {
  amount: number;
  pixKey: string;
  merchantName: string;
  merchantCity?: string;
  onAmountChange: (amount: number) => void;
}

export function PixPaymentSection({
  amount,
  pixKey,
  merchantName,
  merchantCity = "SAO PAULO",
  onAmountChange,
}: PixPaymentSectionProps) {
  const [inputValue, setInputValue] = useState(amount > 0 ? amount.toFixed(2) : "");
  const [copied, setCopied] = useState(false);
  const [pixCode, setPixCode] = useState("");

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handleAmountChange = (value: string) => {
    setInputValue(value);
    const numValue = parseFloat(value.replace(",", ".")) || 0;
    onAmountChange(numValue);
  };

  // Gera o código PIX EMV
  useEffect(() => {
    if (amount > 0 && pixKey) {
      const code = generatePixCode(pixKey, merchantName, merchantCity, amount);
      setPixCode(code);
    }
  }, [amount, pixKey, merchantName, merchantCity]);

  const handleCopy = async () => {
    if (pixCode) {
      await navigator.clipboard.writeText(pixCode);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Valor do PIX</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={inputValue}
          onChange={(e) => handleAmountChange(e.target.value)}
          placeholder="0,00"
          className="h-10"
          autoFocus
        />
      </div>

      {amount > 0 && pixKey && (
        <div className="space-y-3">
          {/* QR Code */}
          <div className="flex justify-center p-4 bg-white rounded-lg">
            <PixQRCode
              pixKey={pixKey}
              merchantName={merchantName}
              merchantCity={merchantCity}
              amount={amount}
              size={180}
            />
          </div>

          {/* Valor */}
          <div className="text-center">
            <p className="text-2xl font-bold">{formatCurrency(amount)}</p>
            <p className="text-sm text-muted-foreground">Escaneie o QR Code ou copie o código</p>
          </div>

          {/* Botão de copiar */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4 text-success" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copiar Código PIX
              </>
            )}
          </Button>

          {/* Código resumido */}
          <div className="p-2 bg-muted rounded text-xs font-mono break-all max-h-20 overflow-auto">
            {pixCode.slice(0, 100)}...
          </div>
        </div>
      )}

      {!pixKey && (
        <div className="p-4 text-center text-muted-foreground border border-dashed rounded-lg">
          <p>Configure a chave PIX nas configurações para gerar QR Code</p>
        </div>
      )}
    </div>
  );
}

// Função para gerar código PIX EMV
function generatePixCode(
  pixKey: string,
  merchantName: string,
  merchantCity: string,
  amount: number
): string {
  const formatField = (id: string, value: string) => {
    const len = value.length.toString().padStart(2, "0");
    return `${id}${len}${value}`;
  };

  // Merchant Account Information (26)
  const gui = formatField("00", "BR.GOV.BCB.PIX");
  const key = formatField("01", pixKey);
  const merchantAccountInfo = formatField("26", gui + key);

  // Payload Format Indicator
  const payloadFormat = formatField("00", "01");

  // Point of Initiation Method (12 = QR dinâmico ou estático)
  const initiationMethod = formatField("01", "12");

  // Merchant Category Code
  const mcc = formatField("52", "0000");

  // Transaction Currency (986 = BRL)
  const currency = formatField("53", "986");

  // Transaction Amount
  const amountStr = formatField("54", amount.toFixed(2));

  // Country Code
  const country = formatField("58", "BR");

  // Merchant Name (max 25 chars)
  const name = formatField("59", merchantName.slice(0, 25).toUpperCase());

  // Merchant City (max 15 chars)
  const city = formatField("60", merchantCity.slice(0, 15).toUpperCase());

  // Assemble payload without CRC
  let payload =
    payloadFormat +
    initiationMethod +
    merchantAccountInfo +
    mcc +
    currency +
    amountStr +
    country +
    name +
    city;

  // Add CRC placeholder
  payload += "6304";

  // Calculate CRC-16 CCITT
  const crc = calculateCRC16(payload);
  payload = payload.slice(0, -4) + formatField("63", crc);

  return payload;
}

// CRC-16 CCITT calculation
function calculateCRC16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

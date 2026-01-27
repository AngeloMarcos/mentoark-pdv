import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

interface PixQRCodeProps {
  pixKey: string;
  merchantName: string;
  merchantCity?: string;
  amount: number;
  txId?: string;
  size?: number;
  className?: string;
}

// Gera payload PIX no padrão EMV (simplificado)
function generatePixPayload(
  pixKey: string,
  merchantName: string,
  merchantCity: string = "BRASIL",
  amount: number,
  txId: string = "***"
): string {
  const formatField = (id: string, value: string): string => {
    const len = value.length.toString().padStart(2, "0");
    return `${id}${len}${value}`;
  };

  // Merchant Account Information
  const gui = formatField("00", "br.gov.bcb.pix");
  const key = formatField("01", pixKey);
  const merchantAccount = formatField("26", gui + key);

  // Transaction Amount
  const transactionAmount = formatField("54", amount.toFixed(2));

  // Merchant Info
  const mcc = formatField("52", "0000");
  const currency = formatField("53", "986"); // BRL
  const countryCode = formatField("58", "BR");
  const name = formatField("59", merchantName.substring(0, 25).toUpperCase());
  const city = formatField("60", merchantCity.substring(0, 15).toUpperCase());

  // Additional Data
  const txIdField = formatField("05", txId.substring(0, 25));
  const additionalData = formatField("62", txIdField);

  // Payload without CRC
  const payloadWithoutCRC =
    formatField("00", "01") + // Payload Format Indicator
    merchantAccount +
    mcc +
    currency +
    transactionAmount +
    countryCode +
    name +
    city +
    additionalData +
    "6304"; // CRC placeholder

  // Calculate CRC16-CCITT
  const crc = calculateCRC16(payloadWithoutCRC);

  return payloadWithoutCRC + crc;
}

// CRC16-CCITT para validação do payload PIX
function calculateCRC16(str: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ polynomial;
      } else {
        crc <<= 1;
      }
    }
  }

  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

export function PixQRCode({
  pixKey,
  merchantName,
  merchantCity = "BRASIL",
  amount,
  txId,
  size = 200,
  className,
}: PixQRCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [payload, setPayload] = useState("");

  useEffect(() => {
    if (!pixKey || !merchantName || amount <= 0) return;

    const pixPayload = generatePixPayload(
      pixKey,
      merchantName,
      merchantCity,
      amount,
      txId
    );

    setPayload(pixPayload);

    QRCode.toDataURL(pixPayload, {
      width: size,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [pixKey, merchantName, merchantCity, amount, txId, size]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Erro ao copiar");
    }
  };

  if (!qrDataUrl) {
    return null;
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <img
        src={qrDataUrl}
        alt="QR Code PIX"
        width={size}
        height={size}
        className="rounded"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="text-xs"
      >
        {copied ? (
          <>
            <Check className="mr-1 h-3 w-3" />
            Copiado!
          </>
        ) : (
          <>
            <Copy className="mr-1 h-3 w-3" />
            Copiar código PIX
          </>
        )}
      </Button>
    </div>
  );
}

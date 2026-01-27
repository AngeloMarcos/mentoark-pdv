import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeGeneratorProps {
  value: string;
  format?: "EAN8" | "EAN13" | "CODE128";
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  className?: string;
}

export function BarcodeGenerator({
  value,
  format = "CODE128",
  width = 2,
  height = 50,
  displayValue = true,
  fontSize = 14,
  className,
}: BarcodeGeneratorProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format,
          width,
          height,
          displayValue,
          fontSize,
          margin: 10,
          background: "#ffffff",
          lineColor: "#000000",
        });
      } catch {
        // Fallback para CODE128 se formato falhar
        try {
          JsBarcode(svgRef.current, value, {
            format: "CODE128",
            width,
            height,
            displayValue,
            fontSize,
            margin: 10,
            background: "#ffffff",
            lineColor: "#000000",
          });
        } catch {
          console.error("Erro ao gerar código de barras");
        }
      }
    }
  }, [value, format, width, height, displayValue, fontSize]);

  if (!value) {
    return null;
  }

  return <svg ref={svgRef} className={className} />;
}

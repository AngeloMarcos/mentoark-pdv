import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Barcode } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}

export function BarcodeScanner({
  onScan,
  placeholder = "Leia ou digite o código de barras...",
  autoFocus = false,
  disabled = false,
  className,
}: BarcodeScannerProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef("");
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Detecta leitura rápida (típica de leitor de código de barras)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignora se não está focado no input ou se tem modificadores
      if (
        document.activeElement !== inputRef.current ||
        e.ctrlKey ||
        e.altKey ||
        e.metaKey
      ) {
        return;
      }

      // Enter submete o código
      if (e.key === "Enter" && bufferRef.current.length >= 3) {
        e.preventDefault();
        onScan(bufferRef.current);
        bufferRef.current = "";
        setValue("");
        return;
      }

      // Apenas caracteres válidos para código de barras
      if (e.key.length === 1 && /^[\d\w]$/.test(e.key)) {
        bufferRef.current += e.key;

        // Reset do timeout para detectar fim da leitura
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Se parou de digitar por 50ms, considera fim da leitura
        timeoutRef.current = setTimeout(() => {
          if (bufferRef.current.length >= 8) {
            // Mínimo para código de barras
            onScan(bufferRef.current);
            bufferRef.current = "";
            setValue("");
          }
        }, 100);
      }
    },
    [onScan]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleKeyDown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    bufferRef.current = newValue;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim().length >= 3) {
      onScan(value.trim());
      setValue("");
      bufferRef.current = "";
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="relative">
        <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          className="pl-10"
        />
      </div>
    </form>
  );
}

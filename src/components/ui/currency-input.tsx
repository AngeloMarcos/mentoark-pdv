import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface CurrencyInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
}

/** Campo monetário em BRL: digita-se apenas números e o valor preenche da direita para a esquerda. */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, placeholder = "0,00", ...rest }, ref) => {
    const [draft, setDraft] = React.useState<string | null>(null);

    const formatted =
      value === null || value === undefined || Number.isNaN(value)
        ? ""
        : formatBRL(Math.round(value * 100));
    const display = draft !== null ? draft : formatted;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
      if (!digits) {
        setDraft("");
        return onChange(null);
      }
      setDraft(formatBRL(parseInt(digits, 10)));
      onChange(parseInt(digits, 10) / 100);
    };

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          R$
        </span>
        <Input
          ref={ref}
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          onBlur={(e) => {
            setDraft(null);
            rest.onBlur?.(e);
          }}
          placeholder={placeholder}
          className={cn("h-9 pl-8 text-right tabular-nums", className)}
          {...rest}
        />
      </div>
    );
  },
);

CurrencyInput.displayName = "CurrencyInput";

interface QuantityInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  suffix?: string;
}

/** Campo numérico que aceita vírgula ou ponto como separador decimal. */
export const QuantityInput = React.forwardRef<HTMLInputElement, QuantityInputProps>(
  ({ value, onChange, className, suffix, placeholder = "0", ...rest }, ref) => {
    const [draft, setDraft] = React.useState<string | null>(null);

    const display =
      draft !== null
        ? draft
        : value === null || value === undefined || Number.isNaN(value)
        ? ""
        : String(value).replace(".", ",");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^\d.,]/g, "").replace(/\./g, ",");
      setDraft(raw);
      if (raw === "" || raw === ",") return onChange(null);
      const parsed = parseFloat(raw.replace(",", "."));
      onChange(Number.isNaN(parsed) ? null : parsed);
    };

    return (
      <div className="relative">
        <Input
          ref={ref}
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          onBlur={(e) => {
            setDraft(null);
            rest.onBlur?.(e);
          }}
          placeholder={placeholder}
          className={cn("h-9 text-right tabular-nums", suffix && "pr-10", className)}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    );
  },
);
QuantityInput.displayName = "QuantityInput";

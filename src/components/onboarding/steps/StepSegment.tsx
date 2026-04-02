import { cn } from "@/lib/utils";
import { Check, Wrench, PawPrint, Wine, UtensilsCrossed, ShoppingCart, Pill, Shirt, Store } from "lucide-react";
import { SEGMENT_OPTIONS } from "../SegmentFeatures";

const ICON_MAP: Record<string, React.ElementType> = {
  Wrench,
  PawPrint,
  Wine,
  UtensilsCrossed,
  ShoppingCart,
  Pill,
  Shirt,
  Store,
};

interface StepSegmentProps {
  selected: string;
  onSelect: (segment: string) => void;
}

export function StepSegment({ selected, onSelect }: StepSegmentProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-foreground">
          Qual é o seu segmento?
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Isso nos ajuda a pré-configurar o sistema ideal para você
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {SEGMENT_OPTIONS.map((seg) => {
          const Icon = ICON_MAP[seg.icon] || Store;
          const isSelected = selected === seg.value;

          return (
            <button
              key={seg.value}
              type="button"
              onClick={() => onSelect(seg.value)}
              className={cn(
                "relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all text-center hover:border-primary/50 hover:bg-accent/50",
                isSelected
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                  : "border-border bg-card"
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  isSelected ? "bg-primary/15" : "bg-muted"
                )}
              >
                <Icon
                  className={cn(
                    "w-6 h-6",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )}
                />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {seg.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {seg.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

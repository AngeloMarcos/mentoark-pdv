import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function KpiCard({ label, value, icon: Icon, hint, trend, className }: Props) {
  return (
    <Card className={cn("p-4 hover:shadow-md transition-shadow", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
          <p className="mt-2 text-2xl font-bold truncate">{value}</p>
          {hint && (
            <p
              className={cn(
                "mt-1 text-xs",
                trend === "up" && "text-success",
                trend === "down" && "text-destructive",
                trend !== "up" && trend !== "down" && "text-muted-foreground"
              )}
            >
              {hint}
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </Card>
  );
}

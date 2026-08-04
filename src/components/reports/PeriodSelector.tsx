import { useState } from "react";
import { format, startOfWeek, startOfMonth, startOfQuarter, startOfYear } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PeriodPreset = "today" | "week" | "month" | "quarter" | "year" | "custom";

const PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "quarter", label: "Trimestre" },
  { key: "year", label: "Ano" },
  { key: "custom", label: "Personalizado" },
];

export function getPresetRange(preset: PeriodPreset): { start: Date; end: Date } {
  const today = new Date();
  switch (preset) {
    case "today":
      return { start: today, end: today };
    case "week":
      return { start: startOfWeek(today, { weekStartsOn: 1 }), end: today };
    case "month":
      return { start: startOfMonth(today), end: today };
    case "quarter":
      return { start: startOfQuarter(today), end: today };
    case "year":
      return { start: startOfYear(today), end: today };
    default:
      return { start: today, end: today };
  }
}

interface Props {
  preset: PeriodPreset;
  start: Date;
  end: Date;
  onPresetChange: (p: PeriodPreset) => void;
  onCustomChange: (start: Date, end: Date) => void;
}

export function PeriodSelector({ preset, start, end, onPresetChange, onCustomChange }: Props) {
  const [openStart, setOpenStart] = useState(false);
  const [openEnd, setOpenEnd] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap rounded-lg border overflow-hidden">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPresetChange(p.key)}
            className={cn(
              "px-3 py-1.5 text-sm transition-colors",
              preset === p.key
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <Popover open={openStart} onOpenChange={setOpenStart}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                {format(start, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={start}
                onSelect={(d) => { if (d) { onCustomChange(d, end); setOpenStart(false); } }}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">até</span>
          <Popover open={openEnd} onOpenChange={setOpenEnd}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                {format(end, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={end}
                onSelect={(d) => { if (d) { onCustomChange(start, d); setOpenEnd(false); } }}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

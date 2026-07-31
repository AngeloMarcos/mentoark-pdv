import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getPeriodPresets } from "@/lib/export-utils";
import { Badge } from "@/components/ui/badge";

interface ReportFiltersProps {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  categories?: string[];
  selectedCategory?: string;
  onCategoryChange?: (category: string | undefined) => void;
  paymentMethods?: { code: string; label: string }[];
  selectedPaymentMethod?: string;
  onPaymentMethodChange?: (method: string | undefined) => void;
  showCategoryFilter?: boolean;
  showPaymentMethodFilter?: boolean;
}

export function ReportFilters({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  categories = [],
  selectedCategory,
  onCategoryChange,
  paymentMethods = [],
  selectedPaymentMethod,
  onPaymentMethodChange,
  showCategoryFilter = false,
  showPaymentMethodFilter = false,
}: ReportFiltersProps) {
  const [showPresets, setShowPresets] = useState(false);
  const presets = getPeriodPresets();
  
  const activeFiltersCount = [
    selectedCategory,
    selectedPaymentMethod,
  ].filter(Boolean).length;
  
  const handlePresetClick = (preset: { start: Date; end: Date }) => {
    onStartDateChange(preset.start);
    onEndDateChange(preset.end);
    setShowPresets(false);
  };
  
  const clearFilters = () => {
    onCategoryChange?.(undefined);
    onPaymentMethodChange?.(undefined);
  };

  return (
    <div className="space-y-4">
      {/* Date filters and presets */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period presets */}
        <Popover open={showPresets} onOpenChange={setShowPresets}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Filter className="w-4 h-4 mr-2" />
              Período
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="grid gap-1">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start h-8 text-sm"
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        
        {/* Start date */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">De:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 w-36 justify-start">
                <Calendar className="w-4 h-4 mr-2" />
                {format(startDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => date && onStartDateChange(date)}
                locale={ptBR}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        
        {/* End date */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Até:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 w-36 justify-start">
                <Calendar className="w-4 h-4 mr-2" />
                {format(endDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => date && onEndDateChange(date)}
                locale={ptBR}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {/* Additional filters */}
      {(showCategoryFilter || showPaymentMethodFilter) && (
        <div className="flex flex-wrap items-center gap-3">
          {showCategoryFilter && categories.length > 0 && (
            <Select
              value={selectedCategory || "all"}
              onValueChange={(v) => onCategoryChange?.(v === "all" ? undefined : v)}
            >
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {showPaymentMethodFilter && paymentMethods.length > 0 && (
            <Select
              value={selectedPaymentMethod || "all"}
              onValueChange={(v) => onPaymentMethodChange?.(v === "all" ? undefined : v)}
            >
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="Forma de Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Formas</SelectItem>
                {paymentMethods.map((pm) => (
                  <SelectItem key={pm.code} value={pm.code}>
                    {pm.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground"
              onClick={clearFilters}
            >
              <X className="w-4 h-4 mr-1" />
              Limpar filtros
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount}
              </Badge>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

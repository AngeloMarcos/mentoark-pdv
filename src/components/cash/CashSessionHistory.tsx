import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { CashSession, CashRegister } from "@/hooks/useCashRegister";
import {
  Search,
  CalendarIcon,
  Filter,
  DollarSign,
  CheckCircle,
  X,
  User,
} from "lucide-react";

interface CashSessionHistoryProps {
  sessions: (CashSession & { register: CashRegister })[];
  isLoading: boolean;
  onSelectSession: (session: CashSession & { register: CashRegister }) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDateTime = (dateStr: string) =>
  new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDateFull = (dateStr: string) =>
  format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });

// Presets de período
const PERIOD_PRESETS = [
  { label: "Hoje", getDates: () => ({ start: new Date(), end: new Date() }) },
  { label: "Últimos 7 dias", getDates: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { label: "Últimos 30 dias", getDates: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
  { label: "Este mês", getDates: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
];

export function CashSessionHistory({
  sessions,
  isLoading,
  onSelectSession,
}: CashSessionHistoryProps) {
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedOperator, setSelectedOperator] = useState<string | undefined>(undefined);
  const [selectedRegister, setSelectedRegister] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [showPresets, setShowPresets] = useState(false);

  // Extrair operadores únicos (user_id) das sessões
  const operators = useMemo(() => {
    const uniqueOperators = new Map<string, string>();
    sessions.forEach((s) => {
      if (s.user_id) {
        uniqueOperators.set(s.user_id, s.user_id);
      }
    });
    return Array.from(uniqueOperators.keys());
  }, [sessions]);

  // Extrair registradoras únicas
  const registers = useMemo(() => {
    const uniqueRegisters = new Map<string, { id: string; name: string }>();
    sessions.forEach((s) => {
      if (s.register) {
        uniqueRegisters.set(s.register.id, { id: s.register.id, name: s.register.name });
      }
    });
    return Array.from(uniqueRegisters.values());
  }, [sessions]);

  // Aplicar filtros
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      // Filtro de busca (nome do caixa)
      if (search) {
        const searchLower = search.toLowerCase();
        const matchName = session.register?.name?.toLowerCase().includes(searchLower);
        if (!matchName) return false;
      }

      // Filtro de data início
      if (startDate) {
        const sessionDate = new Date(session.opened_at);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (sessionDate < start) return false;
      }

      // Filtro de data fim
      if (endDate) {
        const sessionDate = new Date(session.opened_at);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (sessionDate > end) return false;
      }

      // Filtro de operador
      if (selectedOperator && session.user_id !== selectedOperator) {
        return false;
      }

      // Filtro de caixa/registradora
      if (selectedRegister && session.register_id !== selectedRegister) {
        return false;
      }

      // Filtro de status
      if (statusFilter !== "all" && session.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [sessions, search, startDate, endDate, selectedOperator, selectedRegister, statusFilter]);

  // Estatísticas do período filtrado
  const stats = useMemo(() => {
    const closedSessions = filteredSessions.filter((s) => s.status === "closed");
    return {
      total: filteredSessions.length,
      closed: closedSessions.length,
      open: filteredSessions.filter((s) => s.status === "open").length,
      totalClosingBalance: closedSessions.reduce((sum, s) => sum + (s.closing_balance || 0), 0),
      totalDifference: closedSessions.reduce((sum, s) => sum + (s.difference || 0), 0),
    };
  }, [filteredSessions]);

  // Preparar dados para exportação
  const exportData = useMemo(() => {
    return filteredSessions.map((s) => ({
      data_abertura: s.opened_at,
      data_fechamento: s.closed_at,
      caixa: s.register?.name || "",
      status: s.status === "open" ? "Aberto" : "Fechado",
      saldo_inicial: s.opening_balance,
      saldo_final: s.closing_balance || 0,
      saldo_esperado: s.expected_balance || 0,
      diferenca: s.difference || 0,
      motivo_diferenca: s.difference_reason || "",
      observacoes: s.notes || "",
    }));
  }, [filteredSessions]);

  const exportColumns = [
    { key: "data_abertura", label: "Abertura", format: "datetime" as const },
    { key: "data_fechamento", label: "Fechamento", format: "datetime" as const },
    { key: "caixa", label: "Caixa" },
    { key: "status", label: "Status" },
    { key: "saldo_inicial", label: "Saldo Inicial", format: "currency" as const },
    { key: "saldo_final", label: "Saldo Final", format: "currency" as const },
    { key: "saldo_esperado", label: "Saldo Esperado", format: "currency" as const },
    { key: "diferenca", label: "Diferença", format: "currency" as const },
    { key: "motivo_diferenca", label: "Motivo Diferença" },
    { key: "observacoes", label: "Observações" },
  ];

  const handlePresetClick = (preset: typeof PERIOD_PRESETS[0]) => {
    const { start, end } = preset.getDates();
    setStartDate(start);
    setEndDate(end);
    setShowPresets(false);
  };

  const clearFilters = () => {
    setSearch("");
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedOperator(undefined);
    setSelectedRegister(undefined);
    setStatusFilter("all");
  };

  const hasActiveFilters =
    search || startDate || endDate || selectedOperator || selectedRegister || statusFilter !== "all";

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="py-4">
              <div className="animate-pulse h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Linha 1: Busca + Export */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome do caixa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <ExportButtons
              data={exportData}
              columns={exportColumns}
              pdfOptions={{
                title: "Histórico de Sessões de Caixa",
                subtitle: startDate && endDate
                  ? `Período: ${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`
                  : "Todos os períodos",
                orientation: "landscape",
                summary: [
                  { label: "Total de Sessões", value: stats.total.toString() },
                  { label: "Sessões Fechadas", value: stats.closed.toString() },
                  { label: "Total Diferença", value: formatCurrency(stats.totalDifference) },
                ],
              }}
              filenamePrefix="historico-caixa"
              disabled={filteredSessions.length === 0}
            />
          </div>

          {/* Linha 2: Filtros de data */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Presets */}
            <Popover open={showPresets} onOpenChange={setShowPresets}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Filter className="w-4 h-4 mr-2" />
                  Período
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="grid gap-1">
                  {PERIOD_PRESETS.map((preset) => (
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

            {/* Data início */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">De:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-36 justify-start">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Data fim */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Até:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-36 justify-start">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Linha 3: Filtros adicionais */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filtro de status */}
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as "all" | "open" | "closed")}
            >
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abertos</SelectItem>
                <SelectItem value="closed">Fechados</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro de caixa/PDV */}
            {registers.length > 1 && (
              <Select
                value={selectedRegister || "all"}
                onValueChange={(v) => setSelectedRegister(v === "all" ? undefined : v)}
              >
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="Caixa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Caixas</SelectItem>
                  {registers.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Botão limpar filtros */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground"
                onClick={clearFilters}
              >
                <X className="w-4 h-4 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Resumo do período */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-3 pt-2 border-t">
              <Badge variant="secondary" className="gap-1">
                {stats.total} sessões
              </Badge>
              <Badge variant="outline" className="gap-1 text-green-600">
                {stats.closed} fechadas
              </Badge>
              {stats.open > 0 && (
                <Badge variant="outline" className="gap-1 text-orange-500">
                  {stats.open} abertas
                </Badge>
              )}
              {stats.totalDifference !== 0 && (
                <Badge
                  variant="outline"
                  className={stats.totalDifference > 0 ? "text-green-600" : "text-red-600"}
                >
                  Diferença total: {formatCurrency(stats.totalDifference)}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de sessões */}
      {filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {hasActiveFilters
              ? "Nenhuma sessão encontrada com os filtros aplicados"
              : "Nenhum histórico de caixa"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => (
            <Card
              key={session.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => onSelectSession(session)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      session.status === "open" ? "bg-success/20" : "bg-muted"
                    }`}
                  >
                    {session.status === "open" ? (
                      <DollarSign className="w-5 h-5 text-success" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{session.register.name}</h4>
                      <Badge variant={session.status === "open" ? "default" : "secondary"}>
                        {session.status === "open" ? "Aberto" : "Fechado"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(session.opened_at)}
                      {session.closed_at && ` - ${formatDateTime(session.closed_at)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    {session.closing_balance !== null ? (
                      <>
                        <p className="font-semibold">{formatCurrency(session.closing_balance)}</p>
                        {session.difference !== null && Math.abs(session.difference) >= 0.01 && (
                          <p
                            className={`text-xs ${
                              session.difference > 0 ? "text-success" : "text-destructive"
                            }`}
                          >
                            {session.difference > 0 ? "+" : ""}
                            {formatCurrency(session.difference)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="font-semibold">{formatCurrency(session.opening_balance)}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

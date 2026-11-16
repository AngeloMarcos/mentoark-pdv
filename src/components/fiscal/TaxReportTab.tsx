import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useTaxConfig, useTaxReport } from "@/hooks/useTaxes";
import { exportToCSV, type ExportColumn } from "@/lib/export-utils";
import { formatBRL } from "@/lib/utils";

const toInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const formatPeriodo = (key: string) => {
  const [y, m, d] = key.split("-");
  if (!m) return key;
  return d ? `${d}/${m}/${y}` : `${m}/${y}`;
};

const COLUMNS: Array<ExportColumn & { money?: boolean }> = [
  { key: "periodo", label: "Período" },
  { key: "vendas", label: "Vendas" },
  { key: "itens", label: "Itens" },
  { key: "vProd", label: "Valor bruto", format: "number", money: true },
  { key: "vDesc", label: "Descontos", format: "number", money: true },
  { key: "vLiquido", label: "Valor líquido", format: "number", money: true },
  { key: "vBCIBSCBS", label: "Base IBS/CBS", format: "number", money: true },
  { key: "vIBSUF", label: "IBS estadual", format: "number", money: true },
  { key: "vIBSMun", label: "IBS municipal", format: "number", money: true },
  { key: "vIBS", label: "IBS total", format: "number", money: true },
  { key: "vCBS", label: "CBS", format: "number", money: true },
  { key: "vBCIS", label: "Base IS", format: "number", money: true },
  { key: "vIS", label: "Imposto Seletivo", format: "number", money: true },
  { key: "vTributos", label: "Total de tributos", format: "number", money: true },
];

/** Relatório diário/mensal de IBS, CBS e IS, com exportação para ERP/contabilidade. */
export function TaxReportTab() {
  const today = new Date();
  const [start, setStart] = useState(toInput(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [end, setEnd] = useState(toInput(today));
  const [groupBy, setGroupBy] = useState<"day" | "month">("day");
  const [exporting, setExporting] = useState(false);

  const config = useTaxConfig();
  const { data, isLoading, isFetching, error } = useTaxReport({ start, end, groupBy });

  const rows = useMemo(
    () => (data?.rows || []).map((r) => ({ ...r, periodo: formatPeriodo(r.periodo) })),
    [data]
  );
  const filename = `tributos-ibs-cbs-is_${start}_a_${end}`;

  const handleCSV = () => exportToCSV(rows, COLUMNS, filename);

  const handleXLSX = async () => {
    if (!data) return;
    setExporting(true);
    try {
      // xlsx é pesado: só é baixado quando o usuário pede a planilha.
      const { exportToXLSX } = await import("@/lib/xlsx-utils");
      exportToXLSX(filename, [
        {
          name: groupBy === "day" ? "Tributos por dia" : "Tributos por mês",
          columns: COLUMNS.map((c) => ({
            key: c.key,
            label: c.label,
            format: c.money ? ("currency" as const) : c.key === "periodo" ? ("text" as const) : ("integer" as const),
          })),
          data: rows,
        },
        {
          name: "Por classificação",
          columns: [
            { key: "cst", label: "CST IBS/CBS", format: "text" },
            { key: "cClassTrib", label: "cClassTrib", format: "text" },
            { key: "itens", label: "Itens", format: "integer" },
            { key: "vBCIBSCBS", label: "Base IBS/CBS", format: "currency" },
            { key: "vIBS", label: "IBS", format: "currency" },
            { key: "vCBS", label: "CBS", format: "currency" },
            { key: "vIS", label: "Imposto Seletivo", format: "currency" },
          ],
          data: data.byClass,
        },
      ]);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {!config.enabled && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-3 flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            <span>
              O destaque de IBS/CBS está desligado em <strong>Configuração</strong>. O relatório abaixo é uma simulação
              com as alíquotas cadastradas.
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tributos sobre vendas</CardTitle>
          <CardDescription>
            Calculado a partir das vendas do período com as alíquotas e os cadastros de produto atuais (CBS{" "}
            {config.cbs}% · IBS {config.ibs_uf + config.ibs_mun}%).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="tax-start">De</Label>
              <Input id="tax-start" type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tax-end">Até</Label>
              <Input id="tax-end" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Agrupar por</Label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "day" | "month")}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dia</SelectItem>
                  <SelectItem value="month">Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={handleCSV} disabled={rows.length === 0}>
                <Download aria-hidden="true" /> CSV
              </Button>
              <Button variant="outline" onClick={handleXLSX} disabled={rows.length === 0 || exporting}>
                {exporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />} Excel
              </Button>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">Não foi possível carregar o relatório.</p>
          ) : isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center" role="status">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Calculando tributos...
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma venda no período.</p>
          ) : (
            <div className={`overflow-x-auto ${isFetching ? "opacity-60" : ""}`}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead className="text-right">Base IBS/CBS</TableHead>
                    <TableHead className="text-right">IBS</TableHead>
                    <TableHead className="text-right">CBS</TableHead>
                    <TableHead className="text-right">IS</TableHead>
                    <TableHead className="text-right">Tributos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.periodo}>
                      <TableCell>{r.periodo}</TableCell>
                      <TableCell className="text-right">{r.vendas}</TableCell>
                      <TableCell className="text-right">{formatBRL(r.vLiquido)}</TableCell>
                      <TableCell className="text-right">{formatBRL(r.vBCIBSCBS)}</TableCell>
                      <TableCell className="text-right">{formatBRL(r.vIBS)}</TableCell>
                      <TableCell className="text-right">{formatBRL(r.vCBS)}</TableCell>
                      <TableCell className="text-right">{formatBRL(r.vIS)}</TableCell>
                      <TableCell className="text-right font-medium">{formatBRL(r.vTributos)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {data && (
                  <TableFooter>
                    <TableRow>
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{data.totals.vendas}</TableCell>
                      <TableCell className="text-right">{formatBRL(data.totals.vLiquido)}</TableCell>
                      <TableCell className="text-right">{formatBRL(data.totals.vBCIBSCBS)}</TableCell>
                      <TableCell className="text-right">{formatBRL(data.totals.vIBS)}</TableCell>
                      <TableCell className="text-right">{formatBRL(data.totals.vCBS)}</TableCell>
                      <TableCell className="text-right">{formatBRL(data.totals.vIS)}</TableCell>
                      <TableCell className="text-right">{formatBRL(data.totals.vTributos)}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

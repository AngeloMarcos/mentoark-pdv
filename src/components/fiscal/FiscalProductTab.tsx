import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, HelpCircle, ScanLine, Loader2 } from "lucide-react";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { toast } from "sonner";

export interface FiscalFields {
  ncm?: string | null;
  cfop?: string | null;
  csosn?: string | null;
  cst_icms?: string | null;
  cest?: string | null;
  origem?: number | null;
  icms_aliquota?: number | null;
  pis_aliquota?: number | null;
  cofins_aliquota?: number | null;
  unidade_medida?: string | null;
  ean?: string | null;
}

interface Props {
  values: FiscalFields;
  onChange: (patch: Partial<FiscalFields>) => void;
  /** "simples" or "normal" — decides between CSOSN and CST */
  regime?: "simples" | "normal";
}

const ORIGEM_OPTS = [
  { value: 0, label: "0 - Nacional" },
  { value: 1, label: "1 - Estrangeira (importação direta)" },
  { value: 2, label: "2 - Estrangeira (mercado interno)" },
  { value: 3, label: "3 - Nacional > 40% importado" },
  { value: 4, label: "4 - Nacional - PPB" },
  { value: 5, label: "5 - Nacional <= 40% importado" },
  { value: 6, label: "6 - Estrangeira (sem similar)" },
  { value: 7, label: "7 - Estrangeira merc. interno (sem similar)" },
  { value: 8, label: "8 - Nacional com Conteúdo Importação > 70%" },
];

const CSOSN_OPTS = ["101", "102", "103", "201", "202", "203", "300", "400", "500", "900"];
const CST_OPTS = ["00", "10", "20", "30", "40", "41", "50", "51", "60", "70", "90"];
const UNIT_OPTS = ["UN", "KG", "LT", "MT", "M2", "M3", "CX", "PC", "PCT", "DZ", "GR"];

function FieldTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="w-3 h-3 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

function maskNcm(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
}

export function FiscalProductTab({ values, onChange, regime = "simples" }: Props) {
  const [scanActive, setScanActive] = useState(false);
  const { pause, resume } = useBarcodeScanner(
    (code) => {
      onChange({ ean: code.slice(0, 14) });
      toast.success(`EAN capturado: ${code}`);
      setScanActive(false);
      pause();
    },
    { ignoreInputs: false, minLength: 6 }
  );
  // Start paused — only activates when user clicks scan
  if (typeof window !== "undefined" && !scanActive) {
    // idempotent
    pause();
  }
  const startScan = () => {
    setScanActive(true);
    resume();
    toast.info("Aguardando leitura... (5s)");
    setTimeout(() => {
      pause();
      setScanActive(false);
    }, 5000);
  };
  return (
    <div className="space-y-4 pt-2">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="flex items-center gap-1">
            NCM <FieldTip text="Nomenclatura Comum do Mercosul — 8 dígitos. Identifica a classificação fiscal do produto." />
          </Label>
          <div className="flex gap-2">
            <Input
              value={values.ncm || ""}
              onChange={(e) => onChange({ ncm: maskNcm(e.target.value) })}
              placeholder="0000.00.00"
            />
            <a
              href="https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-xs text-primary underline gap-1 self-center"
            >
              <ExternalLink className="w-3 h-3" /> Consultar
            </a>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="flex items-center gap-1">
            CFOP <FieldTip text="Código Fiscal de Operações e Prestações. 5102 = venda dentro do estado." />
          </Label>
          <Input
            value={values.cfop || ""}
            onChange={(e) => onChange({ cfop: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            placeholder="5102"
          />
        </div>

        {regime === "simples" ? (
          <div className="space-y-1">
            <Label className="flex items-center gap-1">
              CSOSN <FieldTip text="Código de Situação da Operação no Simples Nacional. 102 = sem permissão de crédito; 400 = não tributada." />
            </Label>
            <Select
              value={values.csosn || ""}
              onValueChange={(v) => onChange({ csosn: v })}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {CSOSN_OPTS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="flex items-center gap-1">
              CST ICMS <FieldTip text="Código de Situação Tributária do ICMS para regime normal." />
            </Label>
            <Select
              value={values.cst_icms || ""}
              onValueChange={(v) => onChange({ cst_icms: v })}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {CST_OPTS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <Label className="flex items-center gap-1">
            CEST <FieldTip text="Código Especificador da Substituição Tributária — 7 dígitos. Opcional." />
          </Label>
          <Input
            value={values.cest || ""}
            onChange={(e) => onChange({ cest: e.target.value.replace(/\D/g, "").slice(0, 7) })}
            placeholder="0000000"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>Origem da Mercadoria</Label>
          <Select
            value={String(values.origem ?? 0)}
            onValueChange={(v) => onChange({ origem: parseInt(v) })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ORIGEM_OPTS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {regime === "normal" && (
          <div className="space-y-1">
            <Label>Alíquota ICMS (%)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={values.icms_aliquota ?? ""}
              onChange={(e) => onChange({ icms_aliquota: parseFloat(e.target.value) || 0 })}
              placeholder="18.00"
            />
          </div>
        )}

        <div className="space-y-1">
          <Label>Alíquota PIS (%)</Label>
          <Input
            type="number" step="0.01" min="0"
            value={values.pis_aliquota ?? ""}
            onChange={(e) => onChange({ pis_aliquota: parseFloat(e.target.value) || 0 })}
            placeholder="0.65"
          />
        </div>

        <div className="space-y-1">
          <Label>Alíquota COFINS (%)</Label>
          <Input
            type="number" step="0.01" min="0"
            value={values.cofins_aliquota ?? ""}
            onChange={(e) => onChange({ cofins_aliquota: parseFloat(e.target.value) || 0 })}
            placeholder="3.00"
          />
        </div>

        <div className="space-y-1">
          <Label>Unidade de Medida</Label>
          <Select
            value={values.unidade_medida || "UN"}
            onValueChange={(v) => onChange({ unidade_medida: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNIT_OPTS.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label className="flex items-center gap-1">
            EAN / GTIN <FieldTip text="Código de barras de 8, 12, 13 ou 14 dígitos. Use 'SEM GTIN' se não houver." />
          </Label>
          <div className="flex gap-2">
            <Input
              value={values.ean || ""}
              onChange={(e) => onChange({ ean: e.target.value.slice(0, 14) })}
              placeholder="7891234567890"
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={startScan} disabled={scanActive} title="Ler com leitor de código de barras">
              {scanActive ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

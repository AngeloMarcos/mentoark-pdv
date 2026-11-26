import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Percent, Upload, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useIbptVersion, useImportIbpt } from "@/hooks/useIbpt";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { ibptExpired, parseIbptCsv, type IbptParseResult } from "@/lib/ibpt";

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR") : "—";

/** Importação da tabela "De Olho no Imposto" (Lei 12.741/2012). */
export function IbptCard() {
  const { data: version, isLoading } = useIbptVersion();
  const importIbpt = useImportIbpt();
  const { settings } = useCompanySettings();
  const fiscalUf = String((settings.fiscal as { uf?: string } | undefined)?.uf || "").toUpperCase();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<(IbptParseResult & { fileName: string }) | null>(null);

  const expired = version ? ibptExpired(version.vigencia_fim) : false;

  const onFile = async (file: File) => {
    try {
      // O IBPT publica em ISO-8859-1; os campos usados são só números e códigos.
      const text = new TextDecoder("iso-8859-1").decode(await file.arrayBuffer());
      const parsed = parseIbptCsv(text, file.name);
      if (parsed.rates.length === 0) throw new Error("Nenhum NCM encontrado no arquivo.");
      setPreview({ ...parsed, fileName: file.name });
    } catch (e) {
      setPreview(null);
      toast.error((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirm = async () => {
    if (!preview) return;
    try {
      const n = await importIbpt.mutateAsync({ rates: preview.rates, meta: preview.meta });
      toast.success(`Tabela IBPT importada: ${n.toLocaleString("pt-BR")} NCMs`);
      setPreview(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="w-5 h-5" /> Imposto aproximado no cupom (IBPT)
        </CardTitle>
        <CardDescription>
          A Lei 12.741 obriga mostrar no cupom o valor aproximado dos tributos. O valor vem da tabela do IBPT,
          gerada para o CNPJ da sua empresa e renovada a cada poucos meses.{" "}
          <a
            href="https://deolhonoimposto.ibpt.org.br"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline"
          >
            Baixar no site do IBPT <ExternalLink className="w-3 h-3" />
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : version ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={expired ? "destructive" : "secondary"}>{expired ? "Vencida" : "Em vigor"}</Badge>
            <span>
              {version.uf ?? "UF ?"} · versão {version.versao ?? "?"} · {version.total_rows.toLocaleString("pt-BR")} NCMs ·
              vale até <strong>{fmtDate(version.vigencia_fim)}</strong>
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma tabela importada. Sem ela, o imposto aproximado sai zerado.</p>
        )}

        {version && fiscalUf && version.uf && version.uf !== fiscalUf && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              A tabela importada é de {version.uf}, mas a empresa está em {fiscalUf}. Baixe a tabela de {fiscalUf}.
            </AlertDescription>
          </Alert>
        )}

        {preview && (
          <Alert>
            <AlertDescription className="space-y-2">
              <p>
                <strong>{preview.fileName}</strong>: {preview.rates.length.toLocaleString("pt-BR")} NCMs,{" "}
                {preview.meta.uf ?? "UF não identificada"}, versão {preview.meta.versao ?? "?"}, vale de{" "}
                {fmtDate(preview.meta.vigencia_inicio)} a {fmtDate(preview.meta.vigencia_fim)}.
                {preview.invalidLines.length > 0 && ` ${preview.invalidLines.length} linha(s) com erro foram ignoradas.`}
              </p>
              {fiscalUf && preview.meta.uf && preview.meta.uf !== fiscalUf && (
                <p className="text-destructive">Atenção: o arquivo é de {preview.meta.uf} e a empresa está em {fiscalUf}.</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={confirm} disabled={importIbpt.isPending}>
                  {importIbpt.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Importar e substituir a atual
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPreview(null)} disabled={importIbpt.isPending}>
                  Cancelar
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importIbpt.isPending}>
          <Upload className="w-4 h-4 mr-2" /> {version ? "Atualizar tabela (CSV)" : "Importar tabela (CSV)"}
        </Button>
      </CardContent>
    </Card>
  );
}

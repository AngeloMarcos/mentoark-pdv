import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileArchive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";
import { fiscalApi } from "@/services/fiscal/fiscalApi";

/** Mês anterior no formato AAAA-MM: é o que o contador costuma pedir. */
function previousMonth(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Baixa o .zip com os XMLs das NFC-e do mês (autorizadas e cancelamentos) e o resumo para o contador. */
export function MonthlyXmlExport() {
  const { currentTenant } = useTenant();
  const [open, setOpen] = useState(false);
  const [mes, setMes] = useState(previousMonth);
  const [loading, setLoading] = useState(false);

  const download = async () => {
    if (!currentTenant || !mes) return;
    setLoading(true);
    try {
      const pkg = await fiscalApi.downloadMonthlyXml(currentTenant.id, mes);
      if (pkg.total === 0) {
        toast.info("Nenhuma NFC-e autorizada ou cancelada nesse mês.");
        return;
      }
      const url = URL.createObjectURL(pkg.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pkg.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (pkg.faltando > 0) {
        toast.warning(`${pkg.total} notas no pacote, mas ${pkg.faltando} sem XML. O resumo.csv mostra quais. Tente baixar de novo mais tarde.`, { duration: 10000 });
      } else {
        toast.success(`${pkg.total} notas no pacote. Envie o arquivo para o contador.`);
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar o pacote.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="ml-auto">
          <FileArchive className="w-4 h-4 mr-2" /> XML do mês
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="space-y-1">
          <Label htmlFor="xml-mes">Mês</Label>
          <Input id="xml-mes" type="month" value={mes} max={previousMonth(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1))} onChange={(e) => setMes(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Arquivo .zip com os XMLs das notas autorizadas, os cancelamentos e um resumo para o contador.
          </p>
        </div>
        <Button className="w-full" onClick={download} disabled={loading || !mes}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileArchive className="w-4 h-4 mr-2" />}
          {loading ? "Gerando pacote..." : "Baixar .zip"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

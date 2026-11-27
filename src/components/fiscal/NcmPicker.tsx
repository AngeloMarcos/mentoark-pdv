import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search } from "lucide-react";
import { buildNcmIndex, formatNcm, searchNcm, type NcmEntry, type NcmIndex } from "@/lib/ncm-search";

/** Tabela oficial (public/data/ncm.json), baixada só quando alguém precisa dela. */
export function useNcmIndex(enabled = true) {
  return useQuery({
    queryKey: ["ncm-index"],
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async (): Promise<NcmIndex> => {
      const res = await fetch("/data/ncm.json");
      if (!res.ok) throw new Error("Não foi possível carregar a tabela de NCM");
      return buildNcmIndex(await res.json());
    },
  });
}

function maskNcm(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
}

interface Props {
  value: string | null | undefined;
  onChange: (ncm: string) => void;
  /** Sugestão inicial da busca (ex.: nome do produto). */
  productName?: string;
}

/** Campo de NCM com busca na tabela oficial e descrição do código escolhido. */
export function NcmPicker({ value, onChange, productName }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const digits = String(value || "").replace(/\D/g, "");
  // Carrega a tabela ao abrir a busca ou quando já há um código completo para descrever.
  const { data: index, isLoading, isError } = useNcmIndex(open || digits.length === 8);

  const current = useMemo(
    () => (index && digits.length === 8 ? index.entries.find(([c]) => c === digits) : undefined),
    [index, digits],
  );
  const results = useMemo<NcmEntry[]>(() => (index ? searchNcm(index, deferred, 50) : []), [index, deferred]);

  const openSearch = () => {
    setQuery(productName?.split(/\s+/).slice(0, 2).join(" ") || "");
    setOpen(true);
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          value={value || ""}
          onChange={(e) => onChange(maskNcm(e.target.value))}
          placeholder="0000.00.00"
          inputMode="numeric"
          aria-invalid={digits.length === 8 && !!index && !current}
        />
        <Button type="button" variant="outline" onClick={openSearch}>
          <Search className="w-4 h-4 mr-1" /> Buscar
        </Button>
      </div>

      {digits.length === 8 && index && (
        <p className={current ? "text-xs text-muted-foreground line-clamp-2" : "text-xs text-destructive"} title={current?.[1]}>
          {current ? current[1] : "Este NCM não existe na tabela vigente. A SEFAZ vai recusar a nota."}
        </p>
      )}
      {digits.length > 0 && digits.length < 8 && (
        <p className="text-xs text-muted-foreground">O NCM tem 8 dígitos.</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Buscar NCM</DialogTitle>
            <DialogDescription>
              Digite o que é o produto (ex.: "carne bovina desossada", "pão", "refrigerante") ou o começo do código.
              Na dúvida, confirme com o contador.
            </DialogDescription>
          </DialogHeader>
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou código" />
          {isLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">Não foi possível carregar a tabela de NCM.</p>
          ) : (
            <ScrollArea className="h-[50vh]">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">
                  {query.trim().length < 2 ? "Digite pelo menos 2 letras ou números." : "Nada encontrado. Tente outra palavra."}
                </p>
              ) : (
                <ul className="divide-y">
                  {results.map(([code, desc]) => (
                    <li key={code}>
                      <button
                        type="button"
                        className="w-full text-left p-3 hover:bg-muted focus:bg-muted focus:outline-none"
                        onClick={() => {
                          onChange(formatNcm(code));
                          setOpen(false);
                        }}
                      >
                        <span className="font-mono font-semibold">{formatNcm(code)}</span>
                        <span className="block text-sm text-muted-foreground">{desc}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          )}
          {index && <p className="text-xs text-muted-foreground">Tabela oficial do Siscomex: {index.versao}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

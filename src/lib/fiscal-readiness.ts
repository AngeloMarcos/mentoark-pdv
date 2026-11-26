/**
 * Checklist "o que falta para emitir NFC-e de verdade". Função pura: recebe o
 * que a tela já buscou e devolve cada item com situação e o que fazer.
 */
import { ibptExpired } from "./ibpt";

export type ReadinessStatus = "ok" | "pendente" | "atencao" | "manual";

export interface ReadinessItem {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
  /** Aba da tela Fiscal ou link externo para resolver. */
  action?: { label: string; tab?: string; href?: string };
}

export interface ReadinessInput {
  fiscal: {
    provider?: string;
    ambiente?: string;
    emite_nfce?: boolean;
    cnpj?: string;
    emitter_cnpj?: string;
    ie?: string;
    state_registration?: string;
    uf?: string;
    municipio_ibge?: string;
    crt?: string;
  };
  /** null = não consultado (provedor não é Focus); Error = serviço fora do ar. */
  credentials: { homologacao: string | null; producao: string | null } | null | Error;
  products: { active: number; withValidNcm: number } | null;
  ibpt: { uf: string | null; vigencia_fim: string | null; total_rows: number } | null;
  today?: Date;
}

const digits = (v?: string) => String(v ?? "").replace(/\D/g, "");

export function validCnpj(value?: string): boolean {
  const c = digits(value);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = w.reduce((acc, wi, i) => acc + Number(c[i]) * wi, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

export function fiscalReadiness(input: ReadinessInput): ReadinessItem[] {
  const f = input.fiscal;
  const items: ReadinessItem[] = [];
  const config = { label: "Abrir configuração", tab: "config" };

  const cnpj = f.cnpj || f.emitter_cnpj;
  const ie = f.ie || f.state_registration;
  const faltando = [
    !validCnpj(cnpj) && "CNPJ válido",
    !digits(ie) && "Inscrição Estadual",
    !f.uf && "UF",
    digits(f.municipio_ibge).length !== 7 && "município (código IBGE, 7 dígitos)",
    !f.crt && "regime (CRT)",
  ].filter(Boolean) as string[];
  items.push({
    id: "empresa",
    label: "Dados fiscais da empresa",
    status: faltando.length ? "pendente" : "ok",
    detail: faltando.length ? `Falta: ${faltando.join(", ")}.` : "CNPJ, IE, UF, município e regime preenchidos.",
    action: faltando.length ? config : undefined,
  });

  const isFocus = f.provider === "focus_nfe";
  items.push({
    id: "provedor",
    label: "Provedor de emissão",
    status: isFocus ? "ok" : "pendente",
    detail: isFocus
      ? "Focus NFe (emissão real na SEFAZ)."
      : "Está no Simulado: as notas não têm validade. Escolha Focus NFe quando tiver o certificado.",
    action: isFocus ? undefined : config,
  });

  items.push({
    id: "certificado",
    label: "Certificado A1 e CSC cadastrados na Focus",
    status: "manual",
    detail:
      "O PDV não guarda o certificado nem o CSC: eles ficam no painel da Focus. Confira lá a validade do certificado e o CSC de homologação e de produção.",
    action: { label: "Guia da Focus", href: "https://focusnfe.com.br/guides/criacao-empresa-emitente/" },
  });

  const prod = f.ambiente === "producao";
  if (isFocus) {
    const c = input.credentials;
    if (c instanceof Error) {
      items.push({
        id: "tokens",
        label: "Tokens da Focus",
        status: "atencao",
        detail: "Não foi possível falar com o serviço fiscal para conferir os tokens.",
      });
    } else {
      const needed = prod ? c?.producao : c?.homologacao;
      items.push({
        id: "tokens",
        label: `Token da Focus (${prod ? "produção" : "homologação"})`,
        status: needed ? "ok" : "pendente",
        detail: needed
          ? `Cadastrado (${needed}).`
          : `Cole o token de ${prod ? "produção" : "homologação"} da empresa em Credenciais Focus NFe.`,
        action: needed ? undefined : config,
      });
    }
  }

  items.push({
    id: "ambiente",
    label: "Ambiente",
    status: prod ? "ok" : "atencao",
    detail: prod
      ? "Produção: as notas valem de verdade."
      : "Homologação: notas de teste, sem valor fiscal. Mude para Produção só depois de testar.",
  });

  items.push({
    id: "emite",
    label: "Emitir NFC-e ao finalizar a venda",
    status: f.emite_nfce ? "ok" : "pendente",
    detail: f.emite_nfce ? "Ligado." : "Desligado: o PDV só imprime o cupom não fiscal.",
    action: f.emite_nfce ? undefined : config,
  });

  const p = input.products;
  if (p) {
    const sem = p.active - p.withValidNcm;
    items.push({
      id: "ncm",
      label: "Produtos com NCM",
      status: sem === 0 ? "ok" : "pendente",
      detail:
        sem === 0
          ? `Todos os ${p.active} produtos ativos têm NCM.`
          : `${sem} de ${p.active} produtos ativos estão sem NCM válido (8 dígitos). A nota desses produtos é recusada.`,
      action: sem === 0 ? undefined : { label: "Abrir produtos", href: "/products" },
    });
  }

  const t = input.ibpt;
  const ibptOk = !!t && !ibptExpired(t.vigencia_fim, input.today);
  const ufErrada = !!t?.uf && !!f.uf && t.uf !== f.uf.toUpperCase();
  items.push({
    id: "ibpt",
    label: "Tabela IBPT (imposto aproximado)",
    status: !t ? "pendente" : !ibptOk || ufErrada ? "atencao" : "ok",
    detail: !t
      ? "Não importada: o imposto aproximado sai zerado no cupom."
      : ufErrada
        ? `A tabela é de ${t.uf}, mas a empresa está em ${f.uf}.`
        : ibptOk
          ? `${t.total_rows} NCMs, válida até ${t.vigencia_fim?.split("-").reverse().join("/")}.`
          : "Vencida: baixe a nova no site do IBPT e importe.",
    action: ibptOk && !ufErrada ? undefined : { label: "Importar tabela", tab: "prontidao" },
  });

  return items;
}

/** Pronto para emitir de verdade = nada pendente (atenção e manual não bloqueiam). */
export const isReady = (items: ReadinessItem[]) => items.every((i) => i.status !== "pendente");

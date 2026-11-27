// Pacote mensal de XMLs para o contador: regras puras (sem rede).
// O servidor busca os XMLs na Focus e usa estas funções para montar o .zip.

/** "2026-11" -> intervalo [início, fim) no horário de Brasília (sem horário de verão desde 2019). */
function monthRange(mes) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(mes || ""));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12 || y < 2000) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`;
  return { inicio: `${y}-${pad(mo)}-01T00:00:00-03:00`, fim: `${next}-01T00:00:00-03:00` };
}

/** Nome do arquivo no .zip. A chave de acesso é o nome que o contador e os sistemas contábeis esperam. */
function xmlFileName(doc, tipo) {
  const base = doc.chave_acesso || `${doc.serie || "1"}-${String(doc.numero_nota || 0).padStart(9, "0")}`;
  return tipo === "cancelamento" ? `cancelamentos/${base}-can.xml` : `autorizadas/${base}-nfce.xml`;
}

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const brMoney = (n) => Number(n || 0).toFixed(2).replace(".", ",");

const brDateTime = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour12: false });

/** CSV separado por ";" e com vírgula decimal, que abre direto no Excel em português. */
function buildResumoCsv(docs, faltando = new Set()) {
  const header = ["Numero", "Serie", "Chave de acesso", "Emissao", "Situacao", "Valor total", "Tributos aprox.", "Contingencia", "XML no pacote"];
  const lines = [header.join(";")];
  let totalAut = 0;
  let qtdAut = 0;
  let qtdCanc = 0;
  for (const d of docs) {
    if (d.status === "autorizado") {
      totalAut += Number(d.valor_total || 0);
      qtdAut++;
    } else if (d.status === "cancelado") qtdCanc++;
    lines.push(
      [
        d.numero_nota ?? "",
        d.serie ?? "",
        d.chave_acesso ?? "",
        brDateTime(d.created_at),
        d.status === "cancelado" ? "Cancelada" : "Autorizada",
        brMoney(d.valor_total),
        brMoney(d.valor_impostos),
        d.contingencia ? "Sim" : "Nao",
        faltando.has(d.id) ? "NAO (baixe de novo ou consulte a Focus)" : "Sim",
      ]
        .map(csvCell)
        .join(";")
    );
  }
  lines.push("");
  lines.push(`Autorizadas;${qtdAut};;;;${brMoney(totalAut)}`);
  lines.push(`Canceladas;${qtdCanc}`);
  // BOM para o Excel reconhecer UTF-8
  return "﻿" + lines.join("\r\n") + "\r\n";
}

module.exports = { monthRange, xmlFileName, buildResumoCsv };

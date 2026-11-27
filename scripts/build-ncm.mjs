// Gera public/data/ncm.json (busca de NCM no cadastro de produtos) a partir
// da tabela oficial do Siscomex, que é pública e não pede cadastro.
//
// Uso:
//   curl -L -o ncm-siscomex.json "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json"
//   node scripts/build-ncm.mjs ncm-siscomex.json
//
// A tabela é hierárquica: o item de 8 dígitos muitas vezes diz só "-- Outros".
// A descrição gerada junta a posição (4 dígitos) com os níveis abaixo dela,
// para o comerciante entender o que está escolhendo.
// Saída: { "versao": "...", "itens": [["22021000", "Águas ... › Águas, incluindo ..."], ...] }

import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Informe o arquivo baixado do Siscomex.");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(input, "utf8"));
const today = new Date().toISOString().slice(0, 10);
const toIso = (br) => br.split("/").reverse().join("-");

const byDigits = new Map();
for (const n of raw.Nomenclaturas) {
  if (toIso(n.Data_Fim) < today || toIso(n.Data_Inicio) > today) continue;
  byDigits.set(n.Codigo.replace(/[^0-9]/g, ""), n.Descricao);
}

const clean = (d) =>
  String(d)
    .replace(/<[^>]+>/g, "")
    .replace(/^[-–\s]+/, "")
    .replace(/[:;]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

const generic = /^(outr[oa]s|outros\b.*|outras\b.*)$/i;

const itens = [];
for (const [digits, desc] of byDigits) {
  if (digits.length !== 8) continue;
  const parts = [];
  for (const len of [4, 5, 6, 7]) {
    const d = byDigits.get(digits.slice(0, len));
    if (!d) continue;
    const c = clean(d);
    if (len > 4 && generic.test(c)) continue; // "Outros" no meio não ajuda
    if (parts[parts.length - 1] !== c) parts.push(c);
  }
  const leaf = clean(desc);
  if (parts[parts.length - 1] !== leaf) parts.push(leaf);
  itens.push([digits, parts.join(" › ")]);
}
itens.sort((a, b) => a[0].localeCompare(b[0]));

const out = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "public", "data", "ncm.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ versao: `${raw.Data_Ultima_Atualizacao_NCM} (${raw.Ato})`, itens }));
console.log(`${itens.length} NCMs gravados em ${out}`);

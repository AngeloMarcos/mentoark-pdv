const test = require("node:test");
const assert = require("node:assert");
const zlib = require("zlib");
const { buildZip, crc32 } = require("./zip");
const { monthRange, xmlFileName, buildResumoCsv } = require("./xml-mensal");
const { mapFocusResponse } = require("./focus-nfce");

// Lê o .zip pelo diretório central, como faz qualquer descompactador.
function readZip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    assert.strictEqual(buf.readUInt32LE(p), 0x02014b50);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nlen).toString("utf8");
    const lnlen = buf.readUInt16LE(local + 26);
    const data = zlib.inflateRawSync(buf.slice(local + 30 + lnlen, local + 30 + lnlen + csize));
    assert.strictEqual(crc32(data), crc, `CRC de ${name}`);
    out[name] = data.toString("utf8");
    p += 46 + nlen;
  }
  return out;
}

test("crc32 confere com o valor de referência", () => {
  assert.strictEqual(crc32(Buffer.from("123456789")), 0xcbf43926);
});

test("zip abre e devolve os mesmos arquivos, inclusive nome com acento", () => {
  const xml = "<nfeProc>" + "x".repeat(5000) + "</nfeProc>";
  const zip = buildZip([
    { name: "resumo.csv", data: "﻿Número;Valor\r\n1;10,00\r\n" },
    { name: "autorizadas/3526-nfce.xml", data: Buffer.from(xml) },
  ]);
  const files = readZip(zip);
  assert.deepStrictEqual(Object.keys(files), ["resumo.csv", "autorizadas/3526-nfce.xml"]);
  assert.strictEqual(files["autorizadas/3526-nfce.xml"], xml);
  assert.ok(files["resumo.csv"].includes("Número"));
  assert.ok(zip.length < xml.length, "comprime");
});

test("zip vazio é válido", () => {
  assert.deepStrictEqual(readZip(buildZip([])), {});
});

test("intervalo do mês no horário de Brasília, virada de ano", () => {
  assert.deepStrictEqual(monthRange("2026-11"), { inicio: "2026-11-01T00:00:00-03:00", fim: "2026-12-01T00:00:00-03:00" });
  assert.deepStrictEqual(monthRange("2026-12"), { inicio: "2026-12-01T00:00:00-03:00", fim: "2027-01-01T00:00:00-03:00" });
  for (const bad of ["2026-13", "2026-1", "nov", "", null, "1999-01"]) assert.strictEqual(monthRange(bad), null, String(bad));
});

test("nome do arquivo pela chave de acesso, separado por tipo", () => {
  const chave = "35261112345678000199650010000000421000000420";
  assert.strictEqual(xmlFileName({ chave_acesso: chave }, "nota"), `autorizadas/${chave}-nfce.xml`);
  assert.strictEqual(xmlFileName({ chave_acesso: chave }, "cancelamento"), `cancelamentos/${chave}-can.xml`);
  assert.strictEqual(xmlFileName({ serie: "2", numero_nota: 42 }, "nota"), "autorizadas/2-000000042-nfce.xml");
});

test("resumo CSV: totais só das autorizadas e aviso de XML faltando", () => {
  const docs = [
    { id: "a", numero_nota: 1, serie: "1", chave_acesso: "K1", status: "autorizado", valor_total: 10.5, valor_impostos: 1.2, created_at: "2026-11-02T15:00:00Z" },
    { id: "b", numero_nota: 2, serie: "1", chave_acesso: "K2", status: "cancelado", valor_total: 99, valor_impostos: 0, created_at: "2026-11-03T15:00:00Z" },
    { id: "c", numero_nota: 3, serie: "1", chave_acesso: "K3", status: "autorizado", valor_total: 4.5, valor_impostos: 0.5, contingencia: true, created_at: "2026-11-30T23:30:00-03:00" },
  ];
  const csv = buildResumoCsv(docs, new Set(["c"]));
  assert.ok(csv.startsWith("﻿"));
  const lines = csv.trim().split("\r\n");
  assert.strictEqual(lines.length, 1 + 3 + 3);
  assert.match(lines[1], /^1;1;K1;02\/11\/2026, 12:00:00;Autorizada;10,50;1,20;Nao;Sim$/);
  assert.match(lines[2], /;Cancelada;99,00;/);
  assert.match(lines[3], /30\/11\/2026, 23:30:00;Autorizada;4,50;0,50;Sim;NAO/);
  assert.strictEqual(lines[5], "Autorizadas;2;;;;15,00");
  assert.strictEqual(lines[6], "Canceladas;1");
});

test("retorno da Focus guarda o link do XML de cancelamento", () => {
  const r = mapFocusResponse(200, { status: "cancelado", caminho_xml_cancelamento: "/arquivos/x-can.xml" }, "https://homologacao.focusnfe.com.br");
  assert.strictEqual(r.status, "cancelado");
  assert.strictEqual(r.xml_cancelamento_url, "https://homologacao.focusnfe.com.br/arquivos/x-can.xml");
});

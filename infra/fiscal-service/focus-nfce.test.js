// node --test infra/fiscal-service
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildNfcePayload, mapFocusResponse, validGtin, nowSaoPaulo } = require("./focus-nfce");

const tenant = { name: "Mercadinho Teste", document: "11.222.333/0001-81" };

function sale(overrides = {}) {
  return {
    id: "s1",
    net_total: 25,
    gross_total: 25,
    discount_total: 0,
    payment_method: "Dinheiro",
    sale_items: [
      {
        product_id: "p1",
        quantity: 2,
        unit_price: 5,
        discount: 0,
        total: 10,
        products: { name: "Refrigerante 350ml", ncm: "2202.10.00", ean: "7894900011517", unit: "un", csosn: "500", cfop: "5405", cest: "03.007.00" },
      },
      {
        product_id: "p2",
        quantity: 1,
        unit_price: 15,
        discount: 0,
        total: 15,
        products: { name: "Pão de queijo kg", ncm: "19059090", barcode: "123", unidade_medida: "kg" },
      },
    ],
    sale_payments: [{ amount: 30, change_amount: 5, payment_method_code: "DIN", payment_methods: { type: "money" } }],
    ...overrides,
  };
}

test("monta o JSON básico da NFC-e", () => {
  const p = buildNfcePayload({ tenant, fiscal: {}, sale: sale(), now: new Date("2026-11-17T15:00:00Z") });
  assert.equal(p.cnpj_emitente, "11222333000181");
  assert.equal(p.data_emissao, "2026-11-17T12:00:00-03:00");
  assert.equal(p.presenca_comprador, "1");
  assert.equal(p.consumidor_final, "1");
  assert.equal(p.valor_produtos, "25.00");
  assert.equal(p.valor_total, "25.00");
  assert.equal(p.items.length, 2);

  const [a, b] = p.items;
  assert.equal(a.codigo_ncm, "22021000");
  assert.equal(a.cfop, "5405");
  assert.equal(a.icms_situacao_tributaria, "500");
  assert.equal(a.codigo_barras_comercial, "7894900011517");
  assert.equal(a.cest, "0300700");
  assert.equal(a.quantidade_comercial, "2.0000");
  assert.equal(a.valor_bruto, "10.00");

  // padrões do Simples quando o produto não tem dado fiscal
  assert.equal(b.cfop, "5102");
  assert.equal(b.icms_situacao_tributaria, "102");
  assert.equal(b.codigo_barras_comercial, "SEM GTIN");
  assert.equal(b.unidade_comercial, "KG");
});

test("pagamento em dinheiro com troco", () => {
  const p = buildNfcePayload({ tenant, sale: sale() });
  assert.deepEqual(p.formas_pagamento, [{ forma_pagamento: "01", valor_pagamento: "30.00", troco: "5.00" }]);
});

test("PIX e cartão marcados como não integrados", () => {
  const p = buildNfcePayload({
    tenant,
    sale: sale({
      sale_payments: [
        { amount: 10, payment_methods: { type: "pix" } },
        { amount: 15, payment_methods: { type: "card_debit" } },
      ],
    }),
  });
  assert.deepEqual(p.formas_pagamento, [
    { forma_pagamento: "17", valor_pagamento: "10.00", tipo_integracao: "2" },
    { forma_pagamento: "04", valor_pagamento: "15.00", tipo_integracao: "2" },
  ]);
});

test("venda antiga sem sale_payments usa sales.payment_method", () => {
  const p = buildNfcePayload({ tenant, sale: sale({ sale_payments: [], payment_method: "Cartão de Crédito" }) });
  assert.equal(p.formas_pagamento[0].forma_pagamento, "03");
  assert.equal(p.formas_pagamento[0].valor_pagamento, "25.00");
});

test("desconto no total da venda é rateado entre os itens e fecha o total", () => {
  const p = buildNfcePayload({ tenant, sale: sale({ discount_total: 2.5, net_total: 22.5 }) });
  const soma = p.items.reduce((s, i) => s + Number(i.valor_desconto || 0), 0);
  assert.equal(soma.toFixed(2), "2.50");
  assert.equal(p.items[0].valor_desconto, "1.00"); // 10/25 de 2,50
  assert.equal(p.items[1].valor_desconto, "1.50");
  assert.equal(p.valor_desconto, "2.50");
  assert.equal(p.valor_total, "22.50");
});

test("desconto do item + desconto da venda", () => {
  const s = sale({ discount_total: 3, net_total: 22 });
  s.sale_items[0].discount = 1;
  const p = buildNfcePayload({ tenant, sale: s });
  assert.equal(p.valor_desconto, "3.00");
  assert.equal(p.valor_total, "22.00");
});

test("regime normal usa CST do produto", () => {
  const s = sale();
  s.sale_items[0].products.cst_icms = "60";
  const p = buildNfcePayload({ tenant, fiscal: { crt: "3" }, sale: s });
  assert.equal(p.items[0].icms_situacao_tributaria, "60");
  assert.equal(p.items[1].icms_situacao_tributaria, "00");
});

test("consumidor com CPF vai como destinatário", () => {
  const p = buildNfcePayload({ tenant, sale: sale(), customer: { name: "Maria", document: "123.456.789-09" } });
  assert.equal(p.cpf_destinatario, "12345678909");
  assert.equal(p.nome_destinatario, "Maria");
});

test("bloqueia emissão com produto sem NCM", () => {
  const s = sale();
  s.sale_items[1].products.ncm = null;
  assert.throws(() => buildNfcePayload({ tenant, sale: s }), /sem NCM válido.*Pão de queijo/);
});

test("bloqueia CNPJ inválido", () => {
  assert.throws(() => buildNfcePayload({ tenant: { document: "123" }, sale: sale() }), /CNPJ do emitente/);
});

test("valida GTIN pelo dígito verificador", () => {
  assert.equal(validGtin("7894900011517"), "7894900011517");
  assert.equal(validGtin("7894900011518"), null);
  assert.equal(validGtin("123"), null);
});

test("nowSaoPaulo aplica -03:00", () => {
  assert.equal(nowSaoPaulo(new Date("2026-01-01T02:30:00Z")), "2025-12-31T23:30:00-03:00");
});

test("mapeia nota autorizada", () => {
  const m = mapFocusResponse(
    201,
    {
      status: "autorizado",
      status_sefaz: "100",
      mensagem_sefaz: "Autorizado o uso da NF-e",
      chave_nfe: "NFe35261111222333000181650010000000011000000016",
      numero: "1",
      serie: "1",
      caminho_xml_nota_fiscal: "/arquivos/x.xml",
      caminho_danfe: "/notas_fiscais_consumidor/x.html",
      qrcode_url: "https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode?p=1",
    },
    "https://homologacao.focusnfe.com.br"
  );
  assert.equal(m.status, "autorizado");
  assert.equal(m.chave_acesso, "35261111222333000181650010000000011000000016");
  assert.equal(m.numero_nota, 1);
  assert.equal(m.danfe_url, "https://homologacao.focusnfe.com.br/notas_fiscais_consumidor/x.html");
  assert.equal(m.xml_url, "https://homologacao.focusnfe.com.br/arquivos/x.xml");
});

test("mapeia rejeição da SEFAZ e erro de validação", () => {
  const r = mapFocusResponse(200, { status: "erro_autorizacao", status_sefaz: "778", mensagem_sefaz: "NCM inexistente" }, "");
  assert.equal(r.status, "rejeitado");
  assert.equal(r.mensagem_sefaz, "NCM inexistente");

  const v = mapFocusResponse(422, { codigo: "erro_validacao_schema", mensagem: "Erro de schema", erros: [{ campo: "items[0].cfop", mensagem: "inválido" }] }, "");
  assert.equal(v.status, "rejeitado");
  assert.match(v.mensagem_sefaz, /items\[0\]\.cfop: inválido/);

  const s = mapFocusResponse(503, {}, "");
  assert.equal(s.status, "pendente");
});

test("mapeia contingência offline", () => {
  const m = mapFocusResponse(201, { status: "autorizado", contingencia_offline: true }, "");
  assert.equal(m.contingencia, true);
});

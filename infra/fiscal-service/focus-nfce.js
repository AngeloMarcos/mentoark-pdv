// Montagem do JSON da NFC-e no formato da API v2 da Focus NFe e leitura
// da resposta. Funções puras (sem rede), testadas em focus-nfce.test.js.
//
// Referência de campos: exemplos oficiais da Focus (POST /v2/nfce?ref=REF):
// natureza_operacao, data_emissao, presenca_comprador, consumidor_final,
// cnpj_emitente, items[] (numero_item, codigo_ncm, codigo_produto, descricao,
// cfop, unidade_comercial, quantidade_comercial, valor_unitario_comercial,
// valor_bruto, icms_origem, icms_situacao_tributaria, ...) e
// formas_pagamento[] (forma_pagamento, valor_pagamento).
//
// Regra de ouro: quem decide CST/CSOSN, CFOP e NCM é o contador do cliente.
// Aqui só existem padrões seguros para Simples Nacional, sempre
// sobrescritos pelo cadastro do produto ou pela configuração fiscal.

const onlyDigits = (v) => String(v ?? "").replace(/\D/g, "");
const money = (v) => (Math.round(Number(v || 0) * 100) / 100).toFixed(2);
const qty = (v) => (Math.round(Number(v || 0) * 10000) / 10000).toFixed(4);

// Tipo da forma de pagamento do PDV (payment_methods.type) -> tPag da SEFAZ
const TPAG = {
  money: "01", // dinheiro
  check: "02", // cheque
  card_credit: "03", // cartão de crédito
  card_debit: "04", // cartão de débito
  credit: "05", // crédito loja (fiado)
  voucher: "10", // vale alimentação
  pix: "17", // PIX dinâmico/estático
};

// Fallback para vendas antigas que só têm sales.payment_method (texto livre)
function tpagFromLegacy(method) {
  const m = String(method || "").toLowerCase();
  if (m.includes("pix")) return "17";
  if (m.includes("deb") || m.includes("déb")) return "04";
  if (m.includes("cred") || m.includes("créd") || m.includes("cart")) return "03";
  if (m.includes("fiado") || m.includes("loja")) return "05";
  if (m.includes("dinh") || m.includes("money") || m.includes("cash")) return "01";
  return "99";
}

function validGtin(code) {
  const d = onlyDigits(code);
  if (![8, 12, 13, 14].includes(d.length)) return null;
  const digits = d.split("").map(Number);
  const check = digits.pop();
  let sum = 0;
  digits.reverse().forEach((n, i) => {
    sum += n * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check ? d : null;
}

// Data/hora local de São Paulo no formato ISO com offset (-03:00)
function nowSaoPaulo(date = new Date()) {
  const local = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 19) + "-03:00";
}

/**
 * @param {object} p
 * @param {object} p.tenant   { name, document }
 * @param {object} p.fiscal   tenants.settings.fiscal
 * @param {object} p.sale     linha de sales com sale_items(products) e sale_payments(payment_methods)
 * @param {object|null} p.customer { name, document }
 * @param {Date} [p.now]
 */
function buildNfcePayload({ tenant, fiscal = {}, sale, customer = null, now }) {
  const cnpj = onlyDigits(fiscal.cnpj || fiscal.emitter_cnpj || tenant.document);
  if (cnpj.length !== 14) {
    throw new FiscalInputError("CNPJ do emitente inválido. Confira em Fiscal → Configuração.");
  }

  const defaults = {
    cfop: fiscal.cfop_padrao || "5102",
    csosn: fiscal.csosn_padrao || "102",
    origem: String(fiscal.origem_padrao ?? "0"),
    pisCofins: fiscal.pis_cofins_cst_padrao || "49",
  };
  const regimeNormal = String(fiscal.crt || "1") === "3";

  const rawItems = sale.sale_items || [];
  if (rawItems.length === 0) throw new FiscalInputError("Venda sem itens.");

  const semNcm = [];
  const items = rawItems.map((it, idx) => {
    const p = it.products || {};
    const ncm = onlyDigits(p.ncm);
    if (ncm.length !== 8) semNcm.push(p.name || `item ${idx + 1}`);
    const quantidade = Number(it.quantity || 0);
    const unitario = Number(it.unit_price || 0);
    const bruto = quantidade * unitario;
    const desconto = Number(it.discount || 0);
    const gtin = validGtin(p.ean || p.barcode);
    const unidade = String(p.unidade_medida || p.unit || "UN").toUpperCase().slice(0, 6);

    const item = {
      numero_item: idx + 1,
      codigo_produto: String(p.internal_code || it.product_id || idx + 1).slice(0, 60),
      descricao: String(p.name || "Produto").slice(0, 120),
      codigo_ncm: ncm,
      cfop: onlyDigits(p.cfop) || defaults.cfop,
      unidade_comercial: unidade,
      quantidade_comercial: qty(quantidade),
      valor_unitario_comercial: money(unitario),
      unidade_tributavel: unidade,
      quantidade_tributavel: qty(quantidade),
      valor_unitario_tributavel: money(unitario),
      valor_bruto: money(bruto),
      codigo_barras_comercial: gtin || "SEM GTIN",
      codigo_barras_tributavel: gtin || "SEM GTIN",
      icms_origem: String(p.origem ?? defaults.origem),
      icms_situacao_tributaria: regimeNormal
        ? String(p.cst_icms || "00")
        : String(p.csosn || defaults.csosn),
      pis_situacao_tributaria: defaults.pisCofins,
      cofins_situacao_tributaria: defaults.pisCofins,
    };
    if (desconto > 0) item.valor_desconto = money(desconto);
    if (p.cest) item.cest = onlyDigits(p.cest);
    return item;
  });

  if (semNcm.length) {
    throw new FiscalInputError(
      `Produto(s) sem NCM válido (8 dígitos): ${semNcm.slice(0, 5).join(", ")}. Corrija o cadastro antes de emitir.`
    );
  }

  distributeSaleDiscount(items, Number(sale.discount_total || 0));
  const valorProdutos = items.reduce((s, i) => s + Number(i.valor_bruto), 0);
  const valorDesconto = items.reduce((s, i) => s + Number(i.valor_desconto || 0), 0);
  // vNF = vProd - vDesc. A SEFAZ rejeita se o total não fechar com os itens.
  const total = Math.round((valorProdutos - valorDesconto) * 100) / 100;
  const formas = buildPayments(sale, total);

  const payload = {
    natureza_operacao: fiscal.natureza_operacao || "Venda ao consumidor",
    data_emissao: nowSaoPaulo(now),
    tipo_documento: "1",
    finalidade_emissao: "1",
    presenca_comprador: "1",
    consumidor_final: "1",
    modalidade_frete: "9",
    local_destino: "1",
    cnpj_emitente: cnpj,
    valor_produtos: money(valorProdutos),
    valor_desconto: money(valorDesconto),
    valor_total: money(total),
    items,
    formas_pagamento: formas,
  };

  const doc = onlyDigits(customer && customer.document);
  if (doc.length === 11) payload.cpf_destinatario = doc;
  if (doc.length === 14) payload.cnpj_destinatario = doc;
  if (doc && customer.name) payload.nome_destinatario = String(customer.name).slice(0, 60);

  return payload;
}

// Desconto dado no total da venda (não no item) precisa ser rateado entre os
// itens: na NF-e/NFC-e o desconto total é a soma dos descontos dos itens.
function distributeSaleDiscount(items, saleDiscountTotal) {
  const cents = (v) => Math.round(Number(v || 0) * 100);
  const itemDisc = items.reduce((s, i) => s + cents(i.valor_desconto), 0);
  let extra = cents(saleDiscountTotal) - itemDisc;
  if (extra <= 0) return;
  const bases = items.map((i) => cents(i.valor_bruto) - cents(i.valor_desconto));
  const baseTotal = bases.reduce((s, b) => s + b, 0);
  if (baseTotal <= 0) return;
  extra = Math.min(extra, baseTotal);
  let applied = 0;
  items.forEach((item, idx) => {
    const share = idx === items.length - 1 ? extra - applied : Math.floor((extra * bases[idx]) / baseTotal);
    applied += share;
    const novo = cents(item.valor_desconto) + share;
    if (novo > 0) item.valor_desconto = (novo / 100).toFixed(2);
  });
}

function buildPayments(sale, total) {
  const pays = (sale.sale_payments || []).filter((p) => Number(p.amount) > 0);
  if (pays.length === 0) {
    return [{ forma_pagamento: tpagFromLegacy(sale.payment_method), valor_pagamento: money(total), tipo_integracao: "2" }];
  }
  return pays.map((p) => {
    const type = p.payment_methods && p.payment_methods.type;
    const tPag = TPAG[type] || tpagFromLegacy(p.payment_method_code);
    const forma = { forma_pagamento: tPag, valor_pagamento: money(p.amount) };
    // Cartão/PIX em maquininha separada do sistema = pagamento "não integrado"
    if (["03", "04", "17"].includes(tPag)) forma.tipo_integracao = "2";
    if (Number(p.change_amount) > 0) forma.troco = money(p.change_amount);
    return forma;
  });
}

/**
 * Converte a resposta da Focus nas colunas de fiscal_documents.
 * @param {number} httpStatus
 * @param {object} body
 * @param {string} baseUrl  host da Focus usado na chamada (para montar links)
 */
function mapFocusResponse(httpStatus, body, baseUrl) {
  body = body || {};
  const link = (path) => (path ? (/^https?:/.test(path) ? path : baseUrl + path) : null);

  // Erro de validação antes de chegar na SEFAZ (4xx com { codigo, mensagem, erros })
  if (httpStatus >= 400 && !body.status) {
    const detalhes = Array.isArray(body.erros)
      ? body.erros.map((e) => (e.campo ? `${e.campo}: ${e.mensagem}` : e.mensagem)).join("; ")
      : "";
    return {
      status: httpStatus >= 500 ? "pendente" : "rejeitado",
      mensagem_sefaz: [body.mensagem || body.codigo || `HTTP ${httpStatus}`, detalhes].filter(Boolean).join(" — "),
    };
  }

  const STATUS = {
    autorizado: "autorizado",
    cancelado: "cancelado",
    erro_autorizacao: "rejeitado",
    denegado: "denegado",
    processando_autorizacao: "processando",
  };

  const out = {
    status: STATUS[body.status] || "processando",
    status_sefaz: body.status_sefaz != null ? String(body.status_sefaz) : null,
    mensagem_sefaz: body.mensagem_sefaz || body.mensagem || null,
  };
  if (body.chave_nfe) out.chave_acesso = String(body.chave_nfe).replace(/^NFe/i, "");
  if (body.numero) out.numero_nota = Number(body.numero);
  if (body.serie) out.serie = String(body.serie);
  if (body.protocolo || body.numero_protocolo) out.protocolo = String(body.protocolo || body.numero_protocolo);
  if (body.caminho_danfe) out.danfe_url = link(body.caminho_danfe);
  if (body.caminho_xml_nota_fiscal) out.xml_url = link(body.caminho_xml_nota_fiscal);
  if (body.qrcode_url) out.qrcode_url = body.qrcode_url;
  if (body.contingencia_offline === true || body.contingencia_offline === "true") out.contingencia = true;
  return out;
}

class FiscalInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "FiscalInputError";
  }
}

module.exports = { buildNfcePayload, mapFocusResponse, validGtin, nowSaoPaulo, FiscalInputError, TPAG };

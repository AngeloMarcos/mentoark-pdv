// pdv_fiscal — serviço de emissão fiscal do MentoArk PDV
//
// Fica atrás do gateway em /fiscal/v1 (mesmo domínio da API). O navegador
// manda o JWT do usuário; o serviço confere a assinatura, lê a venda com o
// token do próprio usuário (a RLS garante que ele só enxerga o tenant dele)
// e grava o resultado com a service_role. Os tokens da Focus NFe ficam em
// public.fiscal_credentials, que o navegador não consegue ler.
//
// Rotas (todas exigem Authorization: Bearer <jwt do usuário>):
//   GET  /health
//   GET  /credentials/:tenantId           -> { configured, homologacao, producao }
//   PUT  /credentials/:tenantId           <- { token_homologacao?, token_producao? }   (admin)
//   POST /nfce                            <- { sale_id }                               -> fiscal_documents
//   POST /documents/:id/consultar                                                      -> fiscal_documents
//   POST /documents/:id/cancelar          <- { justificativa }                         (admin)
//   POST /nfce/inutilizar                 <- { tenant_id, serie, numero_inicial, numero_final, justificativa } (admin)
//
// Um worker interno reenvia/consulta notas "pendente"/"processando" a cada
// minuto (queda de internet, timeout da SEFAZ, Focus fora do ar).
//
// Zero dependências além do Node core (mesmo padrão do mini-storage).

const http = require("http");
const crypto = require("crypto");
const { buildNfcePayload, mapFocusResponse, FiscalInputError } = require("./focus-nfce");

const JWT_SECRET = process.env.JWT_SECRET;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
const POSTGREST_URL = process.env.POSTGREST_URL || "http://rest:3000";
const FOCUS_URL = {
  homologacao: process.env.FOCUS_URL_HOMOLOGACAO || "https://homologacao.focusnfe.com.br",
  producao: process.env.FOCUS_URL_PRODUCAO || "https://api.focusnfe.com.br",
};
const PORT = Number(process.env.PORT || 5100);
const RETRY_INTERVAL_MS = Number(process.env.RETRY_INTERVAL_MS || 60_000);
const FOCUS_TIMEOUT_MS = Number(process.env.FOCUS_TIMEOUT_MS || 30_000);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://lojasys.mentoark.com.br")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!JWT_SECRET || !SERVICE_ROLE_KEY) {
  console.error("JWT_SECRET e SERVICE_ROLE_KEY são obrigatórios");
  process.exit(1);
}

// ---------------------------------------------------------------- utilidades

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

function verifyJwt(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest();
  const got = b64urlDecode(s);
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return null;
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(p).toString("utf8"));
  } catch {
    return null;
  }
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}

const isUuid = (v) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

function readJson(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        req.destroy();
        reject(new HttpError(413, "Corpo da requisição muito grande"));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpError(400, "JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, apikey, x-client-info");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
  }
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

// ---------------------------------------------------------------- PostgREST

async function pg(path, { token, method = "GET", body, prefer } = {}) {
  const headers = {
    Authorization: `Bearer ${token || SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${POSTGREST_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.hint)) || `PostgREST ${res.status}`;
    const err = new HttpError(res.status === 409 ? 409 : 502, msg, { code: data && data.code });
    err.pgStatus = res.status;
    throw err;
  }
  return data;
}

async function isTenantAdmin(token, tenantId) {
  const [admin, superAdmin] = await Promise.all([
    pg("/rpc/has_tenant_role", { token, method: "POST", body: { _tenant_id: tenantId, _role: "admin" } }).catch(() => false),
    pg("/rpc/is_super_admin", { token, method: "POST", body: {} }).catch(() => false),
  ]);
  return admin === true || superAdmin === true;
}

async function belongsToTenant(token, tenantId) {
  const rows = await pg(`/tenant_users?tenant_id=eq.${tenantId}&select=id&limit=1`, { token });
  return Array.isArray(rows) && rows.length > 0;
}

async function getCredentials(tenantId) {
  const rows = await pg(`/fiscal_credentials?tenant_id=eq.${tenantId}&select=*`);
  return rows && rows[0] ? rows[0] : null;
}

async function getTenant(tenantId) {
  const rows = await pg(`/tenants?id=eq.${tenantId}&select=id,name,document,settings`);
  if (!rows || !rows[0]) throw new HttpError(404, "Empresa não encontrada");
  return rows[0];
}

async function updateDocument(id, patch) {
  const rows = await pg(`/fiscal_documents?id=eq.${id}`, {
    method: "PATCH",
    body: { ...patch, updated_at: new Date().toISOString() },
    prefer: "return=representation",
  });
  return rows && rows[0];
}

// ---------------------------------------------------------------- Focus NFe

async function focus(ambiente, token, method, path, body) {
  const base = FOCUS_URL[ambiente];
  const auth = Buffer.from(`${token}:`).toString("base64");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FOCUS_TIMEOUT_MS);
  try {
    const res = await fetch(base + path, {
      method,
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { mensagem: text.slice(0, 500) };
    }
    return { status: res.status, body: data, base };
  } finally {
    clearTimeout(timer);
  }
}

function tokenFor(creds, ambiente) {
  const t = creds && (ambiente === "producao" ? creds.token_producao : creds.token_homologacao);
  if (!t) {
    throw new HttpError(
      412,
      `Token da Focus NFe de ${ambiente === "producao" ? "produção" : "homologação"} não configurado. Cadastre em Fiscal → Configuração.`
    );
  }
  return t;
}

// Envia (ou reenvia) a nota e grava o resultado. Falha de rede = "pendente",
// o worker tenta de novo; a Focus é idempotente pela ref.
async function sendToFocus(doc, token, depth = 0) {
  let result;
  try {
    const r = await focus(doc.ambiente, token, "POST", `/v2/nfce?ref=${encodeURIComponent(doc.ref)}`, doc.payload);
    // ref já usada (reenvio após timeout): consulta em vez de reenviar
    if (depth === 0 && r.status === 422 && /j[aá] (foi )?(utilizad|processad|autorizad)|already/i.test(JSON.stringify(r.body))) {
      return await consultFocus(doc, token, 1);
    }
    result = mapFocusResponse(r.status, r.body, r.base);
  } catch (err) {
    result = { status: "pendente", mensagem_sefaz: `Sem resposta da Focus/SEFAZ (${err.name === "AbortError" ? "tempo esgotado" : err.message}). Nova tentativa automática em instantes.` };
  }
  return updateDocument(doc.id, { ...result, tentativas: (doc.tentativas || 0) + 1 });
}

async function consultFocus(doc, token, depth = 0) {
  let result;
  try {
    const r = await focus(doc.ambiente, token, "GET", `/v2/nfce/${encodeURIComponent(doc.ref)}?completa=0`);
    if (r.status === 404 && depth === 0 && doc.payload) {
      // A Focus não recebeu a nota: reenvia
      return await sendToFocus(doc, token, 1);
    }
    result = mapFocusResponse(r.status, r.body, r.base);
  } catch (err) {
    result = { status: doc.status, mensagem_sefaz: `Consulta falhou: ${err.message}` };
  }
  return updateDocument(doc.id, { ...result, tentativas: (doc.tentativas || 0) + 1 });
}

// ---------------------------------------------------------------- handlers

async function handleEmit(token, claims, body) {
  const saleId = body.sale_id;
  if (!isUuid(saleId)) throw new HttpError(400, "sale_id inválido");

  // Lida com o token do usuário: a RLS decide se ele pode ver essa venda
  const sales = await pg(
    `/sales?id=eq.${saleId}&select=id,tenant_id,net_total,gross_total,discount_total,payment_method,customer_id,` +
      `sale_items(product_id,quantity,unit_price,discount,total,products(name,ncm,cfop,csosn,cest,origem,unidade_medida,unit,ean,barcode,internal_code)),` +
      `sale_payments(amount,change_amount,payment_method_code,payment_methods(type))`,
    { token }
  );
  const sale = sales && sales[0];
  if (!sale) throw new HttpError(404, "Venda não encontrada");

  // Já existe nota real viva para essa venda? Devolve a mesma (clique duplo, retry da rede)
  const existing = await pg(
    `/fiscal_documents?sale_id=eq.${saleId}&document_type=eq.nfce&provider=neq.simulado&status=not.in.(cancelado,rejeitado,denegado)&select=*&limit=1`
  );
  if (existing && existing[0]) return existing[0];

  const tenant = await getTenant(sale.tenant_id);
  const fiscal = (tenant.settings && tenant.settings.fiscal) || {};
  const ambiente = fiscal.ambiente === "producao" ? "producao" : "homologacao";
  const creds = await getCredentials(tenant.id);
  const focusToken = tokenFor(creds, ambiente);

  let customer = null;
  if (sale.customer_id) {
    const c = await pg(`/customers?id=eq.${sale.customer_id}&select=name,document`, { token });
    customer = c && c[0] ? c[0] : null;
  }

  let payload;
  try {
    payload = buildNfcePayload({ tenant, fiscal, sale, customer });
  } catch (err) {
    if (err instanceof FiscalInputError) throw new HttpError(422, err.message);
    throw err;
  }

  // Reaproveita a última tentativa rejeitada da mesma venda (mesma ref na
  // Focus = reenvio corrigido, sem gastar número novo)
  const rejected = await pg(
    `/fiscal_documents?sale_id=eq.${saleId}&document_type=eq.nfce&provider=eq.focus_nfe&status=eq.rejeitado&select=*&order=created_at.desc&limit=1`
  );

  let doc;
  if (rejected && rejected[0]) {
    doc = await updateDocument(rejected[0].id, {
      status: "processando",
      payload,
      ambiente,
      valor_total: Number(payload.valor_total),
      mensagem_sefaz: null,
    });
  } else {
    const ref = `nfce-${saleId}`;
    try {
      const rows = await pg("/fiscal_documents", {
        method: "POST",
        prefer: "return=representation",
        body: {
          tenant_id: tenant.id,
          sale_id: saleId,
          document_type: "nfce",
          provider: "focus_nfe",
          ref,
          status: "processando",
          ambiente,
          serie: String(fiscal.serie || fiscal.serie_nfce || "1"),
          valor_total: Number(payload.valor_total),
          payload,
          created_by: claims.sub || null,
        },
      });
      doc = rows[0];
    } catch (err) {
      if (err.pgStatus === 409) {
        const again = await pg(`/fiscal_documents?ref=eq.${ref}&select=*`);
        if (again && again[0]) return again[0];
      }
      throw err;
    }
  }

  return sendToFocus(doc, focusToken);
}

async function loadDocForUser(token, id) {
  if (!isUuid(id)) throw new HttpError(400, "id inválido");
  // Leitura com o token do usuário = checagem de tenant pela RLS
  const rows = await pg(`/fiscal_documents?id=eq.${id}&select=id,tenant_id`, { token });
  if (!rows || !rows[0]) throw new HttpError(404, "Documento não encontrado");
  const full = await pg(`/fiscal_documents?id=eq.${id}&select=*`);
  const doc = full[0];
  if (doc.provider === "simulado") throw new HttpError(400, "Documento simulado não passa pela SEFAZ");
  return doc;
}

async function handleConsult(token, id) {
  const doc = await loadDocForUser(token, id);
  const creds = await getCredentials(doc.tenant_id);
  return consultFocus(doc, tokenFor(creds, doc.ambiente));
}

async function handleCancel(token, id, body) {
  const doc = await loadDocForUser(token, id);
  if (!(await isTenantAdmin(token, doc.tenant_id))) throw new HttpError(403, "Apenas administradores podem cancelar notas");
  const justificativa = String(body.justificativa || "").trim();
  if (justificativa.length < 15 || justificativa.length > 255) {
    throw new HttpError(400, "A justificativa deve ter entre 15 e 255 caracteres (regra da SEFAZ).");
  }
  if (doc.status !== "autorizado") throw new HttpError(400, "Só notas autorizadas podem ser canceladas");

  const creds = await getCredentials(doc.tenant_id);
  const r = await focus(doc.ambiente, tokenFor(creds, doc.ambiente), "DELETE", `/v2/nfce/${encodeURIComponent(doc.ref)}`, { justificativa });
  const mapped = mapFocusResponse(r.status, r.body, r.base);
  if (mapped.status !== "cancelado") {
    throw new HttpError(422, `SEFAZ não cancelou: ${mapped.mensagem_sefaz || "erro desconhecido"}`);
  }
  return updateDocument(doc.id, {
    status: "cancelado",
    status_sefaz: mapped.status_sefaz,
    mensagem_sefaz: mapped.mensagem_sefaz,
    obs: `Cancelada: ${justificativa}`,
  });
}

async function handleInutilizar(token, body) {
  const tenantId = body.tenant_id;
  if (!isUuid(tenantId)) throw new HttpError(400, "tenant_id inválido");
  if (!(await isTenantAdmin(token, tenantId))) throw new HttpError(403, "Apenas administradores");
  const justificativa = String(body.justificativa || "").trim();
  if (justificativa.length < 15) throw new HttpError(400, "Justificativa com no mínimo 15 caracteres");
  const ini = Number(body.numero_inicial);
  const fim = Number(body.numero_final || body.numero_inicial);
  if (!Number.isInteger(ini) || !Number.isInteger(fim) || ini < 1 || fim < ini) throw new HttpError(400, "Faixa de números inválida");

  const tenant = await getTenant(tenantId);
  const fiscal = (tenant.settings && tenant.settings.fiscal) || {};
  const ambiente = fiscal.ambiente === "producao" ? "producao" : "homologacao";
  const creds = await getCredentials(tenantId);
  const cnpj = String(fiscal.cnpj || tenant.document || "").replace(/\D/g, "");
  const r = await focus(ambiente, tokenFor(creds, ambiente), "POST", "/v2/nfce/inutilizacao", {
    cnpj,
    serie: String(body.serie || fiscal.serie || "1"),
    numero_inicial: String(ini),
    numero_final: String(fim),
    justificativa,
  });
  if (r.status >= 400) throw new HttpError(422, r.body.mensagem || r.body.mensagem_sefaz || "Falha na inutilização");
  return r.body;
}

async function handleGetCredentials(token, tenantId) {
  if (!isUuid(tenantId)) throw new HttpError(400, "tenant_id inválido");
  if (!(await belongsToTenant(token, tenantId))) throw new HttpError(403, "Sem acesso a esta empresa");
  const c = await getCredentials(tenantId);
  const mask = (t) => (t ? `••••${String(t).slice(-4)}` : null);
  return {
    configured: !!(c && (c.token_homologacao || c.token_producao)),
    homologacao: mask(c && c.token_homologacao),
    producao: mask(c && c.token_producao),
    updated_at: c ? c.updated_at : null,
  };
}

async function handlePutCredentials(token, claims, tenantId, body) {
  if (!isUuid(tenantId)) throw new HttpError(400, "tenant_id inválido");
  if (!(await isTenantAdmin(token, tenantId))) throw new HttpError(403, "Apenas administradores");
  const clean = (v) => (typeof v === "string" ? v.trim() : undefined);
  const patch = { tenant_id: tenantId, provider: "focus_nfe", updated_by: claims.sub || null };
  const h = clean(body.token_homologacao);
  const p = clean(body.token_producao);
  if (h !== undefined) patch.token_homologacao = h || null;
  if (p !== undefined) patch.token_producao = p || null;
  await pg("/fiscal_credentials?on_conflict=tenant_id", {
    method: "POST",
    body: patch,
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  return handleGetCredentials(token, tenantId);
}

// O payload completo da nota fica só no servidor (para reenvio)
function publicDoc(doc) {
  if (!doc || typeof doc !== "object") return doc;
  // eslint-disable-next-line no-unused-vars
  const { payload, ...rest } = doc;
  return rest;
}

// ---------------------------------------------------------------- servidor

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  try {
    const url = new URL(req.url, "http://localhost");
    const seg = url.pathname.split("/").filter(Boolean);

    if (req.method === "GET" && seg[0] === "health") return json(res, 200, { ok: true });

    const auth = req.headers.authorization || "";
    const token = (auth.match(/^Bearer\s+(.+)$/i) || [])[1];
    const claims = verifyJwt(token);
    if (!claims || claims.role !== "authenticated") return json(res, 401, { error: "unauthorized", message: "Sessão inválida ou expirada" });

    if (seg[0] === "credentials" && seg[1]) {
      if (req.method === "GET") return json(res, 200, await handleGetCredentials(token, seg[1]));
      if (req.method === "PUT") return json(res, 200, await handlePutCredentials(token, claims, seg[1], await readJson(req)));
    }
    if (req.method === "POST" && seg[0] === "nfce" && seg.length === 1) {
      return json(res, 200, publicDoc(await handleEmit(token, claims, await readJson(req))));
    }
    if (req.method === "POST" && seg[0] === "nfce" && seg[1] === "inutilizar") {
      return json(res, 200, await handleInutilizar(token, await readJson(req)));
    }
    if (req.method === "POST" && seg[0] === "documents" && seg[2] === "consultar") {
      return json(res, 200, publicDoc(await handleConsult(token, seg[1])));
    }
    if (req.method === "POST" && seg[0] === "documents" && seg[2] === "cancelar") {
      return json(res, 200, publicDoc(await handleCancel(token, seg[1], await readJson(req))));
    }
    return json(res, 404, { error: "not_found" });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) console.error(err);
    return json(res, status, { error: status >= 500 ? "internal_error" : "request_error", message: err.message });
  }
});

// ---------------------------------------------------------------- worker

let workerRunning = false;
async function retryWorker() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    const cutoff = new Date(Date.now() - 30_000).toISOString();
    const docs = await pg(
      `/fiscal_documents?provider=eq.focus_nfe&status=in.(pendente,processando)&updated_at=lt.${cutoff}&tentativas=lt.30&select=*&order=updated_at.asc&limit=20`
    );
    for (const doc of docs || []) {
      try {
        const creds = await getCredentials(doc.tenant_id);
        const t = creds && (doc.ambiente === "producao" ? creds.token_producao : creds.token_homologacao);
        if (!t) continue;
        await consultFocus(doc, t);
      } catch (err) {
        console.error(`worker: falha no documento ${doc.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("worker:", err.message);
  } finally {
    workerRunning = false;
  }
}

server.listen(PORT, () => {
  console.log(`pdv_fiscal ouvindo na porta ${PORT}`);
  setInterval(retryWorker, RETRY_INTERVAL_MS).unref();
});

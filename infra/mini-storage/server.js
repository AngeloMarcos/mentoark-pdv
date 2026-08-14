// Mini serviço de arquivos, no lugar do supabase/storage-api (que tinha um
// bug de ENOENT no backend "file" nesta VPS — ver infra/README.md).
// Implementa só o subconjunto do protocolo REST do Supabase Storage que
// o app realmente usa (src/hooks/useProductImages.ts, via @supabase/storage-js):
//   POST   /object/:bucket/*path        upload
//   POST   /object/sign/:bucket/*path   "signed" url (bucket é público, então
//                                        só devolve o caminho público mesmo)
//   DELETE /object/:bucket              remove (body: {prefixes: [...]})
//   GET    /object/public/:bucket/*path download
//
// Zero dependências além do Node core — imagem final fica minúscula e sem
// superfície de bug de biblioteca de terceiro.

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET;
const DATA_DIR = process.env.DATA_DIR || "/data";
const POSTGREST_URL = process.env.POSTGREST_URL || "http://rest:3000";
const PORT = process.env.PORT || 5000;

// Bucket -> regras (mime types aceitos, tamanho máximo em bytes, público?)
const BUCKETS = {
  "product-images": {
    public: true,
    maxSize: 8 * 1024 * 1024, // 8MB
    allowedMime: [/^image\//],
  },
};

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

// Verifica assinatura HS256 e expiração. Não usa lib de JWT — HS256 é só
// um HMAC-SHA256 sobre "header.payload", conferido por comparação
// constant-time.
function verifyJwt(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${h}.${p}`)
    .digest();
  const got = b64urlDecode(s);
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(p).toString("utf8"));
  } catch {
    return null;
  }
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}

// Confere se o usuário do token pertence ao tenant que é o primeiro
// segmento do path do objeto (convenção: <tenant_id>/<...>), reforçando
// no mini-storage o mesmo isolamento por tenant que as RLS policies do
// Postgres já fazem para as outras rotas.
async function userBelongsToTenant(token, tenantId) {
  if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId)) return false;
  const url = `${POSTGREST_URL}/tenant_users?tenant_id=eq.${tenantId}&select=id&limit=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

function safeJoin(base, ...segments) {
  const target = path.join(base, ...segments);
  if (!target.startsWith(path.resolve(base))) {
    throw new Error("Caminho inválido");
  }
  return target;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (limit && size > limit) {
        req.destroy();
        reject(new Error("PAYLOAD_TOO_LARGE"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

function bearerToken(req) {
  const auth = req.headers["authorization"] || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const segments = url.pathname.split("/").filter(Boolean);

    if (req.method === "GET" && segments[0] === "health") {
      return json(res, 200, { ok: true });
    }

    // GET /object/public/:bucket/*path
    if (req.method === "GET" && segments[0] === "object" && segments[1] === "public") {
      const bucket = segments[2];
      const objectPath = segments.slice(3).join("/");
      const rule = BUCKETS[bucket];
      if (!rule || !rule.public) return json(res, 404, { error: "not_found" });
      const filePath = safeJoin(DATA_DIR, bucket, objectPath);
      if (!fs.existsSync(filePath)) return json(res, 404, { error: "not_found" });
      const stat = fs.statSync(filePath);
      const metaPath = filePath + ".meta.json";
      let mime = "application/octet-stream";
      if (fs.existsSync(metaPath)) {
        try { mime = JSON.parse(fs.readFileSync(metaPath, "utf8")).contentType || mime; } catch {}
      }
      res.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": stat.size,
        "Cache-Control": "public, max-age=31536000, immutable",
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // POST /object/sign/:bucket/*path  (bucket público -> so devolve o caminho publico)
    if (req.method === "POST" && segments[0] === "object" && segments[1] === "sign") {
      const bucket = segments[2];
      const objectPath = segments.slice(3).join("/");
      return json(res, 200, { signedURL: `/object/public/${bucket}/${objectPath}` });
    }

    // POST /object/:bucket/*path  (upload)
    if (req.method === "POST" && segments[0] === "object") {
      const bucket = segments[1];
      const objectPath = segments.slice(2).join("/");
      const rule = BUCKETS[bucket];
      if (!rule) return json(res, 404, { error: "bucket_not_found" });

      const token = bearerToken(req);
      const claims = verifyJwt(token);
      if (!claims) return json(res, 401, { error: "unauthorized" });

      const tenantId = objectPath.split("/")[0];
      if (!(await userBelongsToTenant(token, tenantId))) {
        return json(res, 403, { error: "forbidden" });
      }

      const contentType = req.headers["content-type"] || "application/octet-stream";
      if (rule.allowedMime && !rule.allowedMime.some((re) => re.test(contentType))) {
        return json(res, 415, { error: "unsupported_media_type", message: `Tipo não aceito: ${contentType}` });
      }

      let body;
      try {
        body = await readBody(req, rule.maxSize);
      } catch (e) {
        if (e.message === "PAYLOAD_TOO_LARGE") {
          return json(res, 413, { error: "payload_too_large", message: `Máximo ${rule.maxSize} bytes` });
        }
        throw e;
      }

      const upsert = req.headers["x-upsert"] === "true";
      const filePath = safeJoin(DATA_DIR, bucket, objectPath);
      if (!upsert && fs.existsSync(filePath)) {
        return json(res, 409, { error: "duplicate", message: "Arquivo já existe" });
      }
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, body);
      fs.writeFileSync(filePath + ".meta.json", JSON.stringify({ contentType, size: body.length, uploadedAt: new Date().toISOString() }));

      return json(res, 200, { Id: crypto.randomUUID(), Key: `${bucket}/${objectPath}` });
    }

    // DELETE /object/:bucket  (body: {prefixes: ["path1", "path2"]})
    if (req.method === "DELETE" && segments[0] === "object") {
      const bucket = segments[1];
      const token = bearerToken(req);
      const claims = verifyJwt(token);
      if (!claims) return json(res, 401, { error: "unauthorized" });

      const raw = await readBody(req, 1024 * 1024);
      let prefixes = [];
      try { prefixes = JSON.parse(raw.toString("utf8")).prefixes || []; } catch {}

      const removed = [];
      for (const p of prefixes) {
        const tenantId = String(p).split("/")[0];
        if (!(await userBelongsToTenant(token, tenantId))) continue;
        const filePath = safeJoin(DATA_DIR, bucket, p);
        try {
          fs.unlinkSync(filePath);
          fs.unlinkSync(filePath + ".meta.json");
        } catch {}
        removed.push({ name: p });
      }
      return json(res, 200, removed);
    }

    return json(res, 404, { error: "not_found" });
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: "internal_error", message: String(err && err.message) });
  }
});

server.listen(PORT, () => {
  console.log(`mini-storage ouvindo na porta ${PORT}, DATA_DIR=${DATA_DIR}`);
});

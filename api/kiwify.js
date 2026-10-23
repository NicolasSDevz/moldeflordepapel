// Recebe o aviso de venda da Kiwify (webhook) e grava no Firestore do site,
// para o painel /admkit contar as vendas sozinho.
//
// URL para colar na Kiwify (Apps > Webhooks), evento "Compra aprovada":
//   https://moldeflordepapel.vercel.app/api/kiwify?t=<KIWIFY_WEBHOOK_SECRET>
// A chave fica na variável de ambiente KIWIFY_WEBHOOK_SECRET da Vercel (não no código).
//
// As regras atuais do Firestore só deixam criar documentos em "visits",
// então a venda entra lá com page "/venda-kiwify". Nenhum dado do comprador é salvo.

const SECRET = process.env.KIWIFY_WEBHOOK_SECRET || "";
const URL_FS =
  "https://firestore.googleapis.com/v1/projects/kitmoldeflores/databases/(default)/documents/visits" +
  "?key=AIzaSyB8gd3SVirZYG6P05WinZ7UnrCgVc1TBXg";

function toNumber(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return isFinite(n) ? n : 0;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ ok: true, info: "webhook da Kiwify ativo" });
  if (req.method !== "POST") return res.status(405).end();
  // A Kiwify pode colar "?signature=..." no fim da URL; por isso procura a senha na URL inteira.
  const rawUrl = String(req.url || "");
  const autorizado = !!SECRET && rawUrl.includes("t=" + SECRET);

  let body = {};
  try { body = await readBody(req); } catch (e) { body = {}; }

  const status = String(body.order_status || body.status || "").toLowerCase();
  const evento = String(body.webhook_event_type || "").toLowerCase();

  // Diagnóstico: guarda só o formato do aviso (nada do comprador).
  await gravar({
    page: { stringValue: "/webhook-log" },
    kind: { stringValue: autorizado ? "ok" : "senha_invalida" },
    status: { stringValue: status.slice(0, 40) },
    evento: { stringValue: evento.slice(0, 60) },
    chaves: { stringValue: Object.keys(body || {}).join(",").slice(0, 400) },
    url: { stringValue: (SECRET ? rawUrl.split(SECRET).join("<senha>") : rawUrl).replace(/signature=[^&]*/, "signature=<...>").slice(0, 200) }
  });

  if (!autorizado) return res.status(401).json({ ok: false });

  const pago = ["paid", "approved", "complete", "completed", "aprovada", "pago"].includes(status) || evento === "order_approved";
  if (!pago) return res.status(200).json({ ok: true, ignorado: status || evento || "sem status" });

  const c = body.Commissions || body.commissions || {};
  // A Kiwify manda os valores em centavos.
  const bruto = toNumber(c.charge_amount || c.product_base_price) / 100;
  const minhaComissao = toNumber(c.my_commission) / 100;
  const produto = String((body.Product && body.Product.product_name) || "").slice(0, 120);
  const orderId = String(body.order_id || body.order_ref || "").slice(0, 80);
  // O botão "testar" da Kiwify manda um pedido de exemplo: não grava como venda.
  if (produto === "Example product") return res.status(200).json({ ok: true, teste: true });
  const metodo = String(body.payment_method || "").slice(0, 30);

  const ok = await gravar({
      page: { stringValue: "/venda-kiwify" },
      kind: { stringValue: "sale_kiwify" },
      orderId: { stringValue: orderId },
      amount: { doubleValue: bruto },
      commission: { doubleValue: minhaComissao },
      product: { stringValue: produto },
      method: { stringValue: metodo }
  });
  if (!ok) return res.status(500).json({ ok: false });
  return res.status(200).json({ ok: true });
};

// Grava um documento em "visits" com os campos que as regras exigem.
async function gravar(campos) {
  const doc = { fields: {
    ts: { timestampValue: new Date().toISOString() },
    referrer: { stringValue: "kiwify" },
    ua: { stringValue: "webhook" },
    lang: { stringValue: "" },
    screen: { stringValue: "" },
    ...campos
  } };
  try {
    const r = await fetch(URL_FS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(doc) });
    return r.ok;
  } catch (e) { return false; }
}

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
  if (!SECRET || (req.query && req.query.t) !== SECRET) return res.status(401).json({ ok: false });

  let body;
  try { body = await readBody(req); } catch (e) { return res.status(400).json({ ok: false, erro: "json" }); }

  const status = String(body.order_status || body.status || "").toLowerCase();
  const evento = String(body.webhook_event_type || "").toLowerCase();
  const pago = ["paid", "approved", "complete", "completed"].includes(status) || evento === "order_approved";
  if (!pago) return res.status(200).json({ ok: true, ignorado: status || evento || "sem status" });

  const c = body.Commissions || body.commissions || {};
  // A Kiwify manda os valores em centavos.
  const bruto = toNumber(c.charge_amount || c.product_base_price) / 100;
  const minhaComissao = toNumber(c.my_commission) / 100;
  const produto = String((body.Product && body.Product.product_name) || "").slice(0, 120);
  const orderId = String(body.order_id || body.order_ref || "").slice(0, 80);
  const metodo = String(body.payment_method || "").slice(0, 30);

  const doc = {
    fields: {
      ts: { timestampValue: new Date().toISOString() },
      page: { stringValue: "/venda-kiwify" },
      referrer: { stringValue: "kiwify" },
      ua: { stringValue: "webhook" },
      lang: { stringValue: "" },
      screen: { stringValue: "" },
      kind: { stringValue: "sale_kiwify" },
      orderId: { stringValue: orderId },
      amount: { doubleValue: bruto },
      commission: { doubleValue: minhaComissao },
      product: { stringValue: produto },
      method: { stringValue: metodo }
    }
  };

  try {
    const r = await fetch(URL_FS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doc)
    });
    if (!r.ok) return res.status(500).json({ ok: false, erro: await r.text() });
  } catch (e) {
    return res.status(500).json({ ok: false, erro: String(e) });
  }
  return res.status(200).json({ ok: true });
};

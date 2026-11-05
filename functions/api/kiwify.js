// Webhook da Kiwify no Cloudflare Pages (mesma lógica do api/kiwify.js da Vercel).
// URL na Kiwify: https://moldeflordepapel.pages.dev/api/kiwify?t=<KIWIFY_WEBHOOK_SECRET>
// A chave fica no segredo KIWIFY_WEBHOOK_SECRET do projeto no Cloudflare.
// A venda entra no Firestore em "visits" com page "/venda-kiwify". Nada do comprador é salvo.

const URL_FS =
  "https://firestore.googleapis.com/v1/projects/kitmoldeflores/databases/(default)/documents/visits" +
  "?key=AIzaSyB8gd3SVirZYG6P05WinZ7UnrCgVc1TBXg";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

function toNumber(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return isFinite(n) ? n : 0;
}

export const onRequestGet = () => json({ ok: true, info: "webhook da Kiwify ativo" });

export async function onRequestPost({ request, env }) {
  const SECRET = env.KIWIFY_WEBHOOK_SECRET || "";
  // A Kiwify pode colar "?signature=..." no fim da URL; por isso procura a senha na URL inteira.
  const rawUrl = new URL(request.url);
  const caminho = rawUrl.pathname + rawUrl.search;
  const autorizado = !!SECRET && caminho.includes("t=" + SECRET);

  let body = {};
  try { body = JSON.parse((await request.text()) || "{}"); } catch (e) { body = {}; }

  const status = String(body.order_status || body.status || "").toLowerCase();
  const evento = String(body.webhook_event_type || "").toLowerCase();

  // Diagnóstico: guarda só o formato do aviso (nada do comprador).
  await gravar({
    page: { stringValue: "/webhook-log" },
    kind: { stringValue: autorizado ? "ok" : "senha_invalida" },
    status: { stringValue: status.slice(0, 40) },
    evento: { stringValue: evento.slice(0, 60) },
    chaves: { stringValue: Object.keys(body || {}).join(",").slice(0, 400) },
    url: { stringValue: (SECRET ? caminho.split(SECRET).join("<senha>") : caminho).replace(/signature=[^&]*/, "signature=<...>").slice(0, 200) }
  });

  if (!autorizado) return json({ ok: false }, 401);

  const pago = ["paid", "approved", "complete", "completed", "aprovada", "pago"].includes(status) || evento === "order_approved";
  if (!pago) return json({ ok: true, ignorado: status || evento || "sem status" });

  const c = body.Commissions || body.commissions || {};
  // A Kiwify manda os valores em centavos.
  const bruto = toNumber(c.charge_amount || c.product_base_price) / 100;
  const minhaComissao = toNumber(c.my_commission) / 100;
  const produto = String((body.Product && body.Product.product_name) || "").slice(0, 120);
  const orderId = String(body.order_id || body.order_ref || "").slice(0, 80);
  // O botão "testar" da Kiwify manda um pedido de exemplo: não grava como venda.
  if (produto === "Example product") return json({ ok: true, teste: true });
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
  return ok ? json({ ok: true }) : json({ ok: false }, 500);
}

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

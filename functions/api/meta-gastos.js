// Gasto do Meta ao vivo para os painéis do admkit (gastos e vendas).
// SÓ LEITURA: faz um GET no relatório (insights) da conta Sono Sereno. Não manda nada para o pixel nem muda nada no Meta.
// GET /api/meta-gastos?k=<chave do painel>  -> mesmo formato do admkit/meta-gastos.json
// O token fica no segredo META_TOKEN do projeto no Cloudflare. Se o Meta falhar, devolve o arquivo salvo (meta-gastos.json).

const CONTA = "1073773908656060";
const CHAVE = "b3e7a01772d2"; // a mesma do link do painel (?k=)
const CACHE_SEG = 300; // 5 minutos: o painel abre rápido e não fica chamando o Meta toda hora

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } });

const hojeBR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

async function insights(token, since, until) {
  const u = new URL(`https://graph.facebook.com/v23.0/act_${CONTA}/insights`);
  u.searchParams.set("level", "campaign");
  u.searchParams.set("fields", "campaign_id,campaign_name,spend");
  u.searchParams.set("time_increment", "1");
  u.searchParams.set("time_range", JSON.stringify({ since, until }));
  u.searchParams.set("limit", "500");
  u.searchParams.set("access_token", token);
  const out = [];
  let next = u.toString();
  for (let i = 0; next && i < 20; i++) {
    const r = await fetch(next);
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error?.message || "Meta respondeu " + r.status);
    out.push(...(j.data || []));
    next = j.paging?.next || null;
  }
  return out;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get("k") !== CHAVE) return json({ erro: "chave" }, 403);

  // arquivo salvo: nomes/apelidos das campanhas e os dias antigos (base e plano B)
  let base = { conta: "Sono Sereno", contaId: CONTA, campanhas: [] };
  try {
    const r = await env.ASSETS.fetch(new URL("/admkit/meta-gastos.json", url.origin));
    if (r.ok) base = await r.json();
  } catch {}

  const token = env.META_TOKEN;
  if (!token) return json({ ...base, fonte: "arquivo", aviso: "sem META_TOKEN" });

  const cache = caches.default;
  const cacheKey = new Request(url.origin + "/api/meta-gastos/cache");
  if (url.searchParams.get("refresh") !== "1") {
    const hit = await cache.match(cacheKey);
    if (hit) return json(await hit.json());
  }

  try {
    const dias = base.campanhas.flatMap((c) => Object.keys(c.dias || {})).sort();
    const since = dias[0] || "2026-09-07";
    const rows = await insights(token, since, hojeBR());
    const campanhas = base.campanhas.map((c) => ({ ...c, dias: { ...(c.dias || {}) } }));
    for (const row of rows) {
      let c = campanhas.find((x) => x.id === row.campaign_id);
      if (!c) { c = { id: row.campaign_id, nome: row.campaign_name, apelido: row.campaign_name, dias: {} }; campanhas.push(c); }
      c.dias[row.date_start] = Math.round(Number(row.spend) * 100) / 100;
    }
    const agora = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19) + "-03:00";
    const out = { ...base, campanhas, atualizadoEm: agora, fonte: "meta" };
    await cache.put(cacheKey, json(out, 200, { "Cache-Control": `max-age=${CACHE_SEG}` }));
    return json(out);
  } catch (e) {
    return json({ ...base, fonte: "arquivo", aviso: String(e.message).slice(0, 200) });
  }
}

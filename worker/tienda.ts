export const TOKEN = '15a2l-d23dc8c8873564765e760d8688850044d6b4af0d';
const root = `https://headless.tebex.io/api/accounts/${TOKEN}`;
export const IDS = [7803297, 7803299, 7803300, 7803302];
export async function catalogo() {
  const [sr, pr] = await Promise.all([fetch(root), fetch(root + '/packages')]);
  if (!sr.ok || !pr.ok) throw new Error('Tebex unavailable');
  const [s, p]: any[] = await Promise.all([sr.json(), pr.json()]);
  return { abierto: s.data.disabled === false, paquetes: p.data.filter((x: any) => IDS.includes(x.id)).map((x: any) => ({ id: x.id, nombre: x.name, precio: x.total_price, moneda: x.currency })) };
}
export async function checkout(req: Request) {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  const url = new URL(req.url);
  if (req.headers.get('Origin') !== url.origin) return new Response(null, { status: 403 });
  if (Number(req.headers.get('Content-Length')) > 4096) return new Response(null, { status: 413 });
  let b: any; try { b = await req.json(); } catch { return new Response(null, { status: 400 }); }
  if (!/^[A-Za-z0-9_.]{1,20}$/.test(b.nick ?? '') || !Array.isArray(b.items) || b.items.length < 1 || b.items.length > 4 || b.items.some((x: any) => !IDS.includes(x.id) || !Number.isInteger(x.cantidad) || x.cantidad < 1 || x.cantidad > 10) || new Set(b.items.map((x: any) => x.id)).size !== b.items.length) return Response.json({ error: 'Revisa tu nick y los paquetes.' }, { status: 400 });
  if (!(await catalogo()).abierto) return Response.json({ error: 'La tienda aún no está habilitada en Tebex.' }, { status: 409 });
  const cr = await fetch(root + '/baskets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: b.nick, complete_url: url.origin + '/tienda?resultado=completado', cancel_url: url.origin + '/tienda?resultado=cancelado', complete_auto_redirect: true }) });
  const c: any = await cr.json();
  if (!cr.ok || !c.data?.ident) throw new Error('Basket unavailable');
  for (const item of b.items) {
    const r = await fetch(`https://headless.tebex.io/api/baskets/${encodeURIComponent(c.data.ident)}/packages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ package_id: item.id, quantity: item.cantidad }) });
    if (!r.ok) throw new Error('Package unavailable');
  }
  const r = await fetch(root + '/baskets/' + encodeURIComponent(c.data.ident)); const d: any = await r.json();
  const target = new URL(d.data?.links?.checkout);
  if (target.protocol !== 'https:' || !['checkout.tebex.io','pay.tebex.io'].includes(target.hostname)) throw new Error('Invalid checkout');
  return Response.json({ url: target.href }, { headers: { 'Cache-Control': 'no-store' } });
}
export function estadisticas(events: any[], meta?: string, now = new Date()) {
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' });
  const current = month.format(now);
  const groups = new Map<string, any[]>();
  for (const e of events) { const a = groups.get(e.transaction) ?? []; a.push(e); groups.set(e.transaction, a); }
  const pagos = [...groups.values()].flatMap(a => {
    a.sort((x, y) => Date.parse(x.date) - Date.parse(y.date) || x.type.localeCompare(y.type));
    const initial = a.find(x => x.type === 'payment.completed');
    const last = a.at(-1);
    if (!initial || a.some(x => x.type === 'payment.refunded') || !['payment.completed','payment.dispute.won'].includes(last.type) || initial.currency !== 'USD' || initial.amount <= 0) return [];
    return [{ nick: initial.nick || 'Jugador', importe: initial.amount, fecha: initial.date }];
  });
  const monthly = pagos.filter(x => month.format(new Date(x.fecha)) === current);
  const donors = new Map<string, number>();
  for (const p of monthly) donors.set(p.nick, (donors.get(p.nick) ?? 0) + Math.round(p.importe * 100));
  return { mes: current, total: monthly.reduce((n, p) => n + Math.round(p.importe * 100), 0) / 100,
    meta: Number(meta) > 0 ? Number(meta) : null,
    donadores: [...donors].map(([nick, cents]) => ({ nick, importe: cents / 100 })).sort((a, b) => b.importe - a.importe || a.nick.localeCompare(b.nick)).slice(0, 5),
    recientes: pagos.sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)).slice(0, 6) };
}

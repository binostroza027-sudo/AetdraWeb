const encoder = new TextEncoder();
export async function recibirTebex(req: Request, secret: string | undefined, guardar: (evento: unknown) => Promise<void>) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  if (!secret) return Response.json({ error: 'Webhook unavailable' }, { status: 503 });
  const reader = req.body?.getReader();
  if (!reader) return Response.json({ error: 'Empty body' }, { status: 400 });
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 262144) { await reader.cancel(); return new Response('Too large', { status: 413 }); }
    chunks.push(value);
  }
  const raw = new Uint8Array(size); let offset = 0;
  for (const c of chunks) { raw.set(c, offset); offset += c.length; }
  const signature = req.headers.get('X-Signature') ?? '';
  if (!/^[a-f0-9]{64}$/i.test(signature)) return new Response('Invalid signature', { status: 401 });
  const digest = await crypto.subtle.digest('SHA-256', raw);
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sig = Uint8Array.from(signature.match(/../g)!, b => parseInt(b, 16));
  if (!await crypto.subtle.verify('HMAC', key, sig, encoder.encode(hex))) return new Response('Invalid signature', { status: 401 });
  let event: any;
  try { event = JSON.parse(new TextDecoder().decode(raw)); } catch { return new Response('Invalid JSON', { status: 400 }); }
  if (typeof event.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(event.id)) return new Response('Invalid event', { status: 400 });
  if (event.type === 'validation.webhook') return Response.json({ id: event.id });
  const types = ['payment.completed','payment.refunded','payment.dispute.opened','payment.dispute.won','payment.dispute.lost','payment.dispute.closed'];
  if (!types.includes(event.type)) return Response.json({ received: true });
  const s = event.subject;
  if (typeof s?.transaction_id !== 'string' || s.transaction_id.length > 150 || !Number.isFinite(Date.parse(event.date))) return new Response('Invalid payment', { status: 400 });
  // Keep a deduplicated event journal; no email, address, IP or payment details.
  await guardar({ id: event.id, type: event.type, date: event.date, transaction: s.transaction_id,
    status: s.status?.id ?? null, amount: Number(s.price_paid?.amount) || 0,
    currency: String(s.price_paid?.currency ?? '').slice(0, 3),
    nick: String(s.customer?.username?.username ?? '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 32) });
  return Response.json({ received: true });
}

// Worker de la web: sirve la página estática, guarda el historial de jugadores
// cada 5 minutos (/api/estado) y recibe los tops que envía el plugin (/api/tops).
import { DurableObject } from 'cloudflare:workers';

interface Env {
  ASSETS: Fetcher;
  HISTORIAL: DurableObjectNamespace<Historial>;
  TOPS_CLAVE?: string;
}

const IP = 'play.aetdramc.live';
const RETENCION_DIAS = 31;
// Tamaño de cada punto de la gráfica según el rango pedido.
const RANGOS: Record<string, { dias: number; paso: number }> = {
  '7': { dias: 7, paso: 3600 },
  '14': { dias: 14, paso: 7200 },
  '30': { dias: 30, paso: 14400 },
};
const NICK = /^[A-Za-z0-9_.]{1,20}$/;
const TEXTURA = /^https?:\/\/textures\.minecraft\.net\/texture\/([0-9a-f]{20,80})$/;
const MAX_CUERPO = 64 * 1024;

// Deja solo lo que la web necesita y descarta cualquier otro campo del envío.
function limpiarTops(d: any) {
  if (d?.version !== 1 || !Array.isArray(d.categorias)) return null;
  const texto = (v: unknown, max: number) => String(v ?? '').replace(/[§&][0-9a-fk-orx]/gi, '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
  const categorias = d.categorias.slice(0, 10).flatMap((c: any) => {
    const id = String(c?.id ?? '');
    if (!/^[a-z]{1,20}$/.test(id) || !Array.isArray(c.jugadores)) return [];
    const jugadores = c.jugadores.slice(0, 15).flatMap((j: any) => {
      const valor = Number(j?.valor);
      const nick = texto(j?.nick, 32);
      if (!nick || !Number.isFinite(valor)) return [];
      return [{ pos: Math.trunc(Number(j.pos)) || 0, nick, valor, skin: TEXTURA.exec(String(j?.skin ?? ''))?.[1] ?? null }];
    });
    return [{ id, nombre: texto(c.nombre, 30) || id, unidad: texto(c.unidad, 20), jugadores }];
  });
  return { generado: Math.trunc(Number(d.generado)) || 0, recibido: Math.floor(Date.now() / 1000), categorias };
}

async function claveValida(req: Request, clave?: string) {
  const dada = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!clave || !dada) return false;
  const [a, b] = await Promise.all([dada, clave].map((v) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))));
  return crypto.subtle.timingSafeEqual(a, b);
}

export class Historial extends DurableObject<Env> {
  sql = this.ctx.storage.sql;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql.exec('CREATE TABLE IF NOT EXISTS muestras (ts INTEGER PRIMARY KEY, online INTEGER NOT NULL, jugadores INTEGER NOT NULL)');
  }

  async muestrear() {
    const ahora = Math.floor(Date.now() / 1000);
    let online = 0;
    let jugadores = 0;
    let lista: string[] = [];
    try {
      const r = await fetch(`https://api.mcsrvstat.us/3/${IP}`, { headers: { 'User-Agent': 'AetdraWeb (aetdramc.live)' } });
      if (r.ok) {
        const d: any = await r.json();
        online = d.online ? 1 : 0;
        jugadores = d.online ? Number(d.players?.online) || 0 : 0;
        lista = (d.players?.list ?? []).map((p: any) => String(p?.name ?? p)).filter((n: string) => NICK.test(n)).slice(0, 100);
      }
    } catch {
      // Si la API no responde, se guarda como servidor fuera de línea.
    }
    this.sql.exec('INSERT OR REPLACE INTO muestras (ts, online, jugadores) VALUES (?, ?, ?)', ahora, online, jugadores);
    this.sql.exec('DELETE FROM muestras WHERE ts < ?', ahora - RETENCION_DIAS * 86400);
    await this.ctx.storage.put('ahora', { ts: ahora, online: !!online, jugadores, lista });
  }

  async estado(rango: string) {
    const { dias, paso } = RANGOS[rango] ?? RANGOS['7'];
    const desde = Math.floor(Date.now() / 1000) - dias * 86400;
    const puntos = this.sql
      .exec('SELECT CAST(ts / ? AS INTEGER) * ? AS t, ROUND(AVG(jugadores), 1) AS media, MAX(jugadores) AS pico FROM muestras WHERE ts >= ? GROUP BY t ORDER BY t', paso, paso, desde)
      .toArray();
    const resumen = this.sql.exec('SELECT ROUND(AVG(jugadores), 1) AS media, MAX(jugadores) AS pico, COUNT(*) AS muestras FROM muestras WHERE ts >= ?', desde).one();
    const ahora = (await this.ctx.storage.get('ahora')) ?? { ts: 0, online: false, jugadores: 0, lista: [] };
    return { rango: dias, paso, puntos, resumen, ahora };
  }

  async guardarTops(tops: unknown) {
    await this.ctx.storage.put('tops', tops);
  }

  async tops() {
    return (await this.ctx.storage.get('tops')) ?? { generado: 0, recibido: 0, categorias: [] };
  }
}

const historial = (env: Env) => env.HISTORIAL.get(env.HISTORIAL.idFromName('principal'));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/estado') {
      const datos = await historial(env).estado(url.searchParams.get('rango') ?? '7');
      return Response.json(datos, { headers: { 'Cache-Control': 'public, max-age=60' } });
    }
    if (url.pathname === '/api/tops') {
      if (req.method === 'GET') {
        return Response.json(await historial(env).tops(), { headers: { 'Cache-Control': 'public, max-age=60' } });
      }
      if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });
      if (!(await claveValida(req, env.TOPS_CLAVE))) return Response.json({ ok: false, error: 'clave' }, { status: 401 });
      const cuerpo = await req.text();
      if (cuerpo.length > MAX_CUERPO) return Response.json({ ok: false, error: 'demasiado grande' }, { status: 413 });
      let datos: unknown;
      try { datos = JSON.parse(cuerpo); } catch { return Response.json({ ok: false, error: 'json' }, { status: 400 }); }
      const tops = limpiarTops(datos);
      if (!tops) return Response.json({ ok: false, error: 'formato' }, { status: 400 });
      await historial(env).guardarTops(tops);
      return Response.json({ ok: true, categorias: tops.categorias.length });
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(_ctrl, env) {
    await historial(env).muestrear();
  },
} satisfies ExportedHandler<Env>;

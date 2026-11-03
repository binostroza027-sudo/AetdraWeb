// Worker de la web: sirve la página estática, guarda el historial de jugadores
// cada 5 minutos y lo expone en /api/estado.
import { DurableObject } from 'cloudflare:workers';

interface Env {
  ASSETS: Fetcher;
  HISTORIAL: DurableObjectNamespace<Historial>;
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
}

const historial = (env: Env) => env.HISTORIAL.get(env.HISTORIAL.idFromName('principal'));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/estado') {
      const datos = await historial(env).estado(url.searchParams.get('rango') ?? '7');
      return Response.json(datos, { headers: { 'Cache-Control': 'public, max-age=60' } });
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(_ctrl, env) {
    await historial(env).muestrear();
  },
} satisfies ExportedHandler<Env>;

import { getCollection } from 'astro:content';

export const fecha = new Intl.DateTimeFormat('es', { dateStyle: 'long', timeZone: 'UTC' });

export const iconos: Record<string, string> = {
  Actualización: 'pico', Evento: 'corona', Aviso: 'antorcha', Mundo: 'bloque', Economía: 'esmeralda', PvP: 'espada',
};

export async function novedadesPublicadas() {
  const lista = await getCollection('novedades', ({ data }) => !data.borrador);
  return lista.sort((a, b) => +b.data.fecha - +a.data.fecha);
}

// Cada línea de lista del texto cuenta como un cambio; una novedad sin lista cuenta como uno.
export const cambios = (cuerpo = '') => Math.max(1, cuerpo.split('\n').filter((l) => /^\s*[-*]\s/.test(l)).length);

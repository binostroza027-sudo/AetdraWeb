import calendario from './data/KOTH-CALENDARIO.json';

const { timezone, cycleStart, cycleWeeks, schedule } = calendario;
const dia = 86_400_000;
const semana = 7 * dia;
const ancla = Date.parse(cycleStart + 'T00:00:00Z');
const fechaChile = new Intl.DateTimeFormat('sv-SE', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
});
const desfaseChile = new Intl.DateTimeFormat('en', {
  timeZone: timezone, timeZoneName: 'longOffset',
});

function desfase(fecha: number) {
  const zona = desfaseChile.formatToParts(fecha).find(({ type }) => type === 'timeZoneName')?.value;
  const partes = /^GMT([+-])(\d{2}):(\d{2})$/.exec(zona ?? '');
  if (!partes) throw new Error('Desfase de Chile no disponible');
  const [, signo, horas, minutos] = partes;
  return (signo === '-' ? -1 : 1) * (+horas * 60 + +minutos) * 60_000;
}

function eventosDeSemana(indice: number) {
  if (indice < 0) return [];
  return schedule.filter(({ week }) => week === indice % cycleWeeks + 1)
    .map(({ isoWeekday, time, arena }) => {
      const [hora, minuto] = time.split(':').map(Number);
      // La fecha civil se calcula aparte del instante para conservar la hora chilena.
      const civil = ancla + indice * semana + (isoWeekday - 1) * dia + (hora * 60 + minuto) * 60_000;
      const instante = civil - desfase(civil - desfase(civil));
      return { arena, instante };
    })
    .sort((a, b) => a.instante - b.instante);
}

export function calendarioKoth(ahora: number) {
  const hoy = Date.parse(fechaChile.format(ahora) + 'T00:00:00Z');
  const indice = Math.floor((hoy - ancla) / semana);
  const eventos = eventosDeSemana(indice);
  const proximo = eventos.find(({ instante }) => instante >= ahora)
    ?? eventosDeSemana(Math.max(0, indice + 1))[0];
  return { eventos, proximo, indice };
}

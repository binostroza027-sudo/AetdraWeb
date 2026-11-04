import eonix from './assets/equipo/eonix.webp';
import elvenjo from './assets/equipo/elvenjo.webp';
import meliinoeee from './assets/equipo/meliinoeee.webp';
import jam3r25 from './assets/equipo/jam3r25.webp';
import thetomatito from './assets/equipo/thetomatito.webp';

// Para añadir a alguien: copia su render a src/assets/equipo y súmalo a su rango.
// El color de cada rango está en src/pages/equipo.astro (clases r-*).
export const rangos = [
  { nombre: 'Owner', clase: 'r-owner', icono: 'corona', miembros: [{ nick: '_Eonix', render: eonix }] },
  { nombre: 'Admin', clase: 'r-admin', icono: 'espada', miembros: [{ nick: 'ElVenjo', render: elvenjo }, { nick: 'Meliinoeee', render: meliinoeee }] },
  { nombre: 'Media', clase: 'r-media', icono: 'antorcha', miembros: [{ nick: 'Jam3r25', render: jam3r25 }, { nick: 'thetomatito', render: thetomatito }] },
];

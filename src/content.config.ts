import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const novedades = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/novedades' }),
  schema: z.object({
    titulo: z.string(),
    fecha: z.coerce.date(),
    resumen: z.string(),
    categoria: z.enum(['Actualización', 'Evento', 'Aviso', 'Mundo', 'Economía', 'PvP']).default('Aviso'),
    borrador: z.boolean().default(false),
  }),
});

const guias = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guias' }),
  schema: z.object({ titulo: z.string(), resumen: z.string(), orden: z.number().default(99) }),
});

export const collections = { novedades, guias };

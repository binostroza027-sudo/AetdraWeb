# AetdraWeb

Web de AetdraMC: https://aetdramc.live

## Publicar una novedad

Desde GitHub, sin instalar nada:

1. Abre la carpeta `src/content/novedades`.
2. Pulsa **Add file > Create new file**.
3. Ponle un nombre sin espacios ni acentos, por ejemplo `evento-koth-noviembre.md`. Ese nombre será su dirección web.
4. Pega esta plantilla y edítala:

```markdown
---
titulo: Título de la novedad
fecha: 2026-11-15
resumen: Una frase que se verá en la tarjeta.
categoria: Evento
borrador: false
---

Aquí va el texto. Puedes usar **negrita**, listas y [enlaces](https://aetdramc.live).
```

5. Pulsa **Commit changes**. Cloudflare publica la web sola en uno o dos minutos.

- `categoria` admite `Actualización`, `Evento`, `Aviso`, `Mundo`, `Economía` o `PvP`; cada una tiene su icono.
- Escribe los cambios como lista (`- ...`): cada línea cuenta como un cambio en el calendario.
- Con `borrador: true` la novedad se guarda, pero no aparece en la web.
- Para editar o borrar una novedad, abre su archivo en GitHub y usa el lápiz o la papelera.

Las guías funcionan igual en `src/content/guias`, con los campos `titulo`, `resumen` y `orden`.

## Probar en local

```bash
npm install
npm run dev
```

## Seguridad

- No subas contraseñas, tokens ni archivos `.env`: este repositorio puede ser público.
- La web es estática: no tiene login, base de datos ni formularios.
- Las cabeceras de seguridad están en `public/_headers` y la política de contenido en `astro.config.mjs`.
- Ejecuta `npm audit` de vez en cuando y actualiza las dependencias.

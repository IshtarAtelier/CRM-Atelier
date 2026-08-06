# Cronograma de publicación — agosto 2026

Once publicaciones, tres por semana, martes / jueves / sábado. Es la cadencia
que el plan (`docs/plan-publicacion-meta.md`) define como sostenible: menos y el
algoritmo deja de mostrar las publicaciones, más y no se mantiene en el tiempo.

Los cinco pilares rotan a propósito. Una cuenta que solo publica producto se lee
como catálogo y la gente deja de mirarla; una que solo publica educación no
vende nunca.

| # | Fecha | Pilar | Pieza | Estado |
|---|---|---|---|---|
| 1 | jue 06/08 | Educación | `progresivos-que-medimos` | ✅ **PUBLICADA** 5/8 |
| 2 | sáb 08/08 | Producto | `armazones-destacados` | ✅ renderizada |
| 3 | mar 11/08 | Prueba | `optica-mejor-calificada` | ✅ renderizada |
| 4 | jue 13/08 | Educación | `leer-tu-receta` | ✅ renderizada |
| 5 | sáb 15/08 | Producto | *desde la base* | ⏳ requiere OK para leer producción |
| 6 | mar 18/08 | Adentro | `laboratorio-propio` | ✅ renderizada |
| 7 | jue 20/08 | Educación | `multifocales-marean` | ✅ renderizada |
| 8 | sáb 22/08 | Producto | *desde la base* | ⏳ requiere OK para leer producción |
| 9 | mar 25/08 | Prueba | `multifocales-no-fallan` | ✅ renderizada |
| 10 | jue 27/08 | Educación | `filtro-azul-o-antirreflejo` | ✅ renderizada |
| 11 | sáb 29/08 | Acción | `garantia-adaptacion` | ✅ renderizada |

## Por qué los sábados llevan producto

Es el día de mayor tráfico de una óptica de barrio y el que más gente mira el
celular sin apuro. Las piezas de producto son las únicas que pueden llevar
precio, y **se generan desde la base** (`npm run social:producto`): una pieza con
un precio escrito a mano no renderiza, es la regla R6 del validador y no se
exime nunca. Publicar un precio viejo tiene que ser imposible, no algo a lo que
haya que prestarle atención.

## De dónde sale el contenido

Ninguna pieza se inventó de cero. El blog tiene 51 notas y varias tratan
exactamente lo que rinde en redes: cómo leer una receta, por qué un multifocal
marea, filtro azul contra antirreflejo. Adaptar una nota a carrusel cuesta una
hora; escribir contenido nuevo tres veces por semana no se sostiene.

## Cómo se publica cada una

```bash
# 1. Ver qué saldría, sin publicar nada (comportamiento por defecto)
node scripts/social/publicar.mjs social/contenido/<pieza>.json

# 2. Publicar de verdad, con aprobación de una persona
node scripts/social/publicar.mjs social/contenido/<pieza>.json --facebook --instagram
```

Cada publicación queda registrada en la bitácora (`SystemSetting`), que es
contra lo que compara el aviso diario de cadencia
(`/api/cron/social-cadencia`) — **falta darlo de alta en cron-job.org**. Hasta que
eso pase, el sistema no avisa si se cortó la cadencia.

## Lo que queda pendiente

- **Dos piezas de producto**: necesitan leer el catálogo de producción para que
  los precios sean los reales.
- **El cron de cadencia**: sin él, si nadie publica durante dos semanas nadie se
  entera. Es el mismo patrón que ya costó caro en este proyecto — el silencio no
  puede significar que está todo bien.
- **Programación automática**: hoy cada publicación se dispara a mano. El token
  ya está, así que es construible cuando se decida.

---

## ACTUALIZACIÓN 6/8: la fuente viva es `social/feed-programacion.json`

Este documento explica el porqué; la programación real —agosto, septiembre y
octubre, con reels los domingos por medio— vive en ese JSON y la ejecuta sola
el cron `/api/cron/social-feed`. Cambiar una fecha es editar el JSON, no este
documento.

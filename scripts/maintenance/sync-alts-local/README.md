# Sincronizar `imageAlts` de producción a la base local (5/9/2026)

## Qué pasó

Al construir el filtro de color de la tienda (5/9/26) se descubrió que la base
local del desarrollador tenía **1 de 106** `WebProduct.imageAlts` con texto
descriptivo, mientras que producción tenía **110 de 115**. El código que
extrae el color (`src/lib/catalog/frame-specs.ts`) lee ese alt; sin él, el
filtro de color no se podía probar de verdad en local — se veía siempre vacío,
no porque el código estuviera mal sino porque faltaba el dato de origen.

## Qué hace `sincronizar.mjs`

Lee `imageAlts` de **producción** (solo lectura, vía `PROD_DATABASE_URL`) y lo
escribe en la base **local** (`DATABASE_URL`), emparejando por `slug`. No toca
ningún otro campo. Tiene una guarda real: si `DATABASE_URL` y
`PROD_DATABASE_URL` resolvieran al mismo host:puerto/base, se niega a correr —
este script ESCRIBE, y escribir con el destino mal apuntado sería escribir
sobre producción.

## Resultado de la corrida del 5/9/26

```
Producción: 117 productos activos.
Local actualizado: 59 | ya estaban igual: 4 | sin match por slug: 54
```

54 productos no matchearon por `slug`: la base local tiene sus propios
productos con slugs que no existen (o cambiaron) en producción — una base local
desactualizada de más largo aliento, fuera del alcance de este script. 59
productos con dato real alcanzó para verificar el filtro de color de punta a
punta con datos genuinos, no inventados.

## Cuándo volver a correrlo

Si alguien necesita volver a probar algo que dependa de `imageAlts` con datos
reales en local (el filtro de color, el feed de Merchant Center, etc.) y la
base local volvió a quedar desactualizada.

Uso: `node --experimental-strip-types scripts/maintenance/sync-alts-local/sincronizar.mjs`

# Catálogo minorista optimizado — estado y cómo continuar

Auditoría + reescritura de las **114 fichas minoristas** de la tienda viva
(atelieroptica.com.ar) para dejarlas al 100%: etiquetas que alimentan los
filtros, textos únicos por producto, datos de feed completos y todo en
castellano argentino, escrito para vender y para posicionar.

## Estado (27/07/2026)

| | |
|---|---|
| Fichas producidas | **48 / 114** (lotes 01-08 del workflow) |
| Fichas pendientes | **66** — ver `slugs-pendientes.json` |
| Verificación adversarial | **NO corrió** (se cortó por límite de gasto) |
| Aplicado a la base | **NO** — nada tocado en local ni en prod |

El workflow de 44 agentes se cortó a mitad por el **límite de gasto mensual de
la cuenta** (no por error del trabajo). Completó las 3 investigaciones de
keywords + 8 lotes de producción. Los 12 lotes restantes, las 20
verificaciones y el dedupe global quedaron sin correr.

Las 48 fichas de `fichas-lote-01-08.json` **no pasaron** por el verificador
adversarial, pero sí pasaron un control mecánico local (`--dry-run` del script
de abajo): **0 violaciones de regla dura, 0 términos inventados, 0
españolismos**. Calidad de borrador alto, revisable.

## Archivos

- `fichas-lote-01-08.json` — las 48 fichas nuevas (el entregable). Un objeto por
  producto con: `slug`, `visto` (forma/material/color leídos de la foto),
  `discrepancias` (lo que la tienda declara mal hoy), `seoTags`, `seoTitle`,
  `seoDescription`, `description`, `imageAlts`, `genero`, `ageGroup`, `mpn`.
- `keywords-mercado-ar.json` — banco de keywords del mercado óptico argentino,
  verificado contra competidores reales (Paesani, Pagani, Zolens, ML AR…). Guía
  para escribir las 66 que faltan y para cualquier copy futuro.
- `slugs-pendientes.json` — los 66 slugs que faltan producir.

## Los 3 problemas sistémicos que encontró la auditoría

1. **Contenido duplicado**: 32 descripciones y 30 meta descriptions idénticas
   copiadas entre productos (misma plantilla, cambia solo el código de modelo).
   Google lo penaliza como contenido duplicado.
2. **Género roto en 40/114**: cargados como `"Unisex, Femenino, Masculino"` los
   tres juntos. Como `src/app/api/store/products/route.ts` filtra con
   `includes()`, esos 40 aparecen en los tres filtros a la vez.
3. **Datos de feed incompletos**: falta `mpn` en 96/114 (feed con
   `identifier_exists=false`), `ageGroup` en 24, y 16 títulos superan 60 chars.

Base sana en lo básico: 0 productos sin foto/precio/stock en producción.

## Reglas duras que respetan las fichas (no romperlas al completar el resto)

- `seoTags` **debe** empezar con UNA forma exacta (`Cat-Eye`/`Hexagonal`/
  `Redondo`/`Aviador`/`Cuadrado`/`XL`) y UN material exacto (`Titanio`/
  `Acetato`/`Metal`/`TR90`) — es lo que parsea `src/utils/product-controllers.ts`.
  Si falta, el filtro de la tienda miente.
- `seoTitle` ≤ 35 chars y **sin** "Atelier"/"Óptica"/"Córdoba" (el código los agrega).
- `seoDescription` 120-155 chars. `description` 320-600.
- `genero` = UN solo valor de `Femenino`/`Masculino`/`Unisex`.
- Prohibido inventar (polarizado, fotocromático, "acetato italiano", titanio…)
  lo que no se ve en la foto ni consta en los datos.
- `wicue-cargador-regulable` NO es un armazón (es un cargador): no lleva
  forma/material de anteojo — tratarlo aparte.

## Cómo continuar

### Opción A — terminar los 66 que faltan (necesita presupuesto de agentes)
Cuando el límite de gasto se reponga o se suba, re-lanzar el workflow. Los 48 ya
hechos y las keywords vuelven **de caché sin gastar**; solo corren los pendientes
+ la verificación:

    Workflow({ scriptPath: ".../atelier-catalogo-100-wf_1b4db763-196.js",
               resumeFromRunId: "wf_1b4db763-196" })

(Resume es de la misma sesión. Si ya no existe, se re-arma un workflow que lee
`slugs-pendientes.json` como lista de trabajo — la infra de fotos/datos se
reconstruye desde el sitemap vivo, es barato.)

### Opción B — aplicar las 48 ya hechas (NO requiere agentes)
Primero SIEMPRE en dry-run contra la base local:

    node --env-file=.env scripts/maintenance/aplicar-fichas-optimizadas.mjs \
      scripts/maintenance/catalogo-optimizado/fichas-lote-01-08.json

Revisar el `.diff.json` que genera. Recién con el diff aprobado, `--apply`.
Para producción hace falta **autorización explícita del dueño** y correr con
`AUDIT_DB_URL="$PROD_DATABASE_URL"`. El script no toca precio, stock, imágenes
ni publicación — solo campos de texto/etiqueta.

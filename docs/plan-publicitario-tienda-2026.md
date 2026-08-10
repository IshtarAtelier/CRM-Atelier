# Plan publicitario Atelier Óptica — agosto 2026 a febrero 2027

**Fecha:** 9/8/2026 · **Techo mensual autorizado:** $1.000.000 ARS · **Dólar de referencia:** $1.570
**Fuente:** síntesis de 20 auditorías independientes sobre el mismo negocio, hechas el 9/8/2026.

Este documento reemplaza a `docs/plan-campanias-meta-google.md` (que propone presupuestos que
violan el techo) y consolida `docs/plan-maquina-de-vender.md` §4 con lo verificado hoy.
Donde dos auditorías se contradicen, la contradicción está resuelta y explicada en el texto.

> **Advertencia de ramas — ACTUALIZADA el 10/8/2026, el bloque original ya no era cierto.**
> `origin/main` está en **`3fb22950`** (no en `ec014097`) y **`deploy/bot-recetas` ya está
> íntegramente mergeado**: `git rev-list --left-right --count origin/main...deploy/bot-recetas`
> devuelve `0 0`. Los "39 commits sin deployar" **ya se deployaron** — con ellos el guardián del
> techo (`src/services/ads-budget.service.ts`), el vínculo chat↔ficha (`f254da27`), la guarda de
> frescura de stories y el arreglo del cron de carritos. **B5 y B7 de la §2.1 están resueltos.**
>
> Lo que sigue vivo:
> - `src/app/multifocales/page.tsx` y `src/lib/pricing/` siguen **untracked**: no existen en
>   ninguna rama y se pierden con cualquier `checkout`. B4 sigue en pie.
> - La **CSP** de `origin/main` sigue sin `googleadservices` ni `googleads.g.doubleclick.net`
>   (`git show origin/main:next.config.ts | grep -c googleadservices` → `0`), así que Google Ads
>   no puede recibir una conversión ni armar un público de remarketing. Arreglado en
>   `fix/csp-google-ads`, **sin deployar**.
> - El lote `ad-atp` vive en `claude/keen-fermat-12abe7`: son **5 piezas × 4 tamaños = 20 JPEG**
>   y **12 commits** (el texto original decía 16 placas y 10 commits).

---

## 1. El veredicto en una página

**Qué hacer:** reencender Meta con objetivo *Mensajes* (click-to-WhatsApp) como motor, sostener
Google solo en Búsqueda por intención tipeada, y no tocar PMax, Maps, Shopping, catálogo ni
objetivo Tráfico. En abril y mayo de 2026 la pauta que hoy está apagada devolvió **~5,0 pesos de
margen por cada peso de Meta y ~3,8 de Google**, con un CPA de **$40.840** (Meta) y **$55.400**
(Google) por venta contra un punto de equilibrio de $205.366.

> **Corregido el 10/8.** Decía "4,7 y 4,0" con un CPA de $37.815. Las cuatro cifras no podían ser
> ciertas a la vez: ROAS = margen ÷ CPA, y $205.366 ÷ $37.815 da 5,43x, no 4,7x. El CPA de Meta
> además dividía por 27 ventas cuando la base tiene 25 no borradas ($1.021.000 ÷ 25 = $40.840).
> Los valores de arriba son los reconstruidos con margen del 56,3% sobre lo cobrado por canal.
> **Y ojo con la frase "nada de esto es una apuesta", que se borró:** el CPA cruza un gasto
> cargado a mano en `FixedCost` con el `contactSource` **del cliente**, no de la orden — la propia
> §12.1 (R5) lo describe como atribución manual que no distingue Meta pago de Meta orgánico.
> La dirección es sólida; la precisión de dos decimales no.

**Cuánto invertir:** no arrancar con el techo puesto. Rampa de tres meses hasta $1.000.000.

| Mes | Total | Meta | Google | Por qué |
|---|---|---|---|---|
| Mes 1 (12/8–11/9) | **$600.000** | $370.000 (62%) | $230.000 (38%) | Un solo conjunto de Meta que aprenda; Google sin landing ni etiqueta de compra |
| Mes 2 (12/9–11/10) | **$850.000** | $565.000 (66%) | $285.000 (34%) | Entra remarketing; Google recupera impresiones perdidas |
| Mes 3 (12/10–11/11) | **$1.000.000** | $620.000 (62%) | $380.000 (38%) | Techo lleno, mes pico (Día de la Madre + Cyber Monday) |

**En qué orden:**

1. **Semana del 11/8 — apagar riesgos, costo $0.** Bajar `opticascordoba.com.ar` (PBN vivo que se
   presenta como ranking independiente), 301 de `promo.atelieroptica.com.ar` (2x1 "por tiempo
   limitado" sin fecha), bajar el titular "Garantía de adaptación 90 días" de la PMax de Google
   (la política publicada dice 30). Commitear `/multifocales`.
2. **Semana del 11/8 — deployar.** Los 39 commits de `deploy/bot-recetas` (incluyen el guardián
   del techo y el vínculo chat↔ficha) y cargar `GOOGLE_ADS_CONVERSION_LABEL` en Railway.
3. **12/8 — encender.** Meta: un conjunto, multifocales, Córdoba +15 km, 42-60 años, destino
   WhatsApp. Google: cuatro campañas de Búsqueda, cero PMax, cero Maps.
4. **Día 15 en adelante.** Remarketing recién con pozo lleno; nunca el día 1.
5. **Mes 3.** Techo lleno, Día de la Madre y Cyber Monday.

**Lo que NO se hace, y no se discute cada dos meses:** objetivo Tráfico ($17.291 por conversación
contra $857 — 20x peor, dos cuentas independientes lo confirman), Performance Max (pide un piso de
US$50-100/día = $2,4M a $4,7M ARS/mes; el techo entero es $1M), catálogo/Advantage+ Sales (aprender
con compras exigiría $1.109.471/día), campaña de lentes de sol de vidriera (12 SKU en catálogo,
0,5% de la facturación) y campaña de competencia (la cuenta tiene ~50 nombres de ópticas cordobesas
como negativas: sería contradecir su propia política).

**Si la dueña solo lee esto:** el punto de equilibrio son **3 ventas atribuidas en el mes 1 y 5 en
el mes 3**. En abril y mayo las fuentes pagas produjeron **27 y 19 ventas reales**. El techo de
$1.000.000 no es un riesgo financiero — el riesgo es gastarlo sin poder medirlo, y por eso los
bloqueantes de la sección 2 van primero.

> **Corregido el 10/8.** Este párrafo decía "62 y 72 órdenes". Eran órdenes, pero **con los
> presupuestos adentro** (35 `QUOTE` en abril, 53 en mayo). Las ventas reales fueron 27 y 19 — es
> el mismo error que la propia §2.3 declara falso 90 líneas más abajo, aplicado acá. El colchón
> contra el equilibrio es de **~4x, no de ~14x**, y la participación de las fuentes pagas sobre
> facturación real **baja** de abril a mayo (65,9% → 53,7%) en vez de subir. El plan se sostiene;
> el margen de error es mucho más chico de lo que este párrafo daba a entender.

---

## 2. Antes de gastar el primer peso

Lista corta y bloqueante. Cada fila dice qué cuesta saltearla.

### 2.1 Bloqueantes duros — no se enciende pauta sin esto

| # | Qué | Dónde | Costo de saltearlo |
|---|---|---|---|
| B1 | Bajar `opticascordoba.com.ar` (HTTP 200 hoy) y lo que quede de la PBN de 14 dominios. Disavow en Search Console. Borrar `docs/seo_external_campaign/deploy_sites` y `pbn` del disco | `docs/seo_external_campaign/` | Acción manual de Google Search sobre `atelieroptica.com.ar`. Se pierde la 1ª posición orgánica con 5,0/677 reseñas — el único canal que hoy trae clientes **gratis**. Recuperación de meses, no garantizada |
| B2 | 301 de `promo.atelieroptica.com.ar` al dominio principal (o noindex + bajar la página, vía Wave Publicidad) | subdominio externo | "2x1 por tiempo limitado" sin fecha ni condiciones = práctica engañosa (Decreto 274/2019) y *Misrepresentation* en Google. Además manda los leads al WhatsApp **mayorista** (+54 9 3541 21-5971), que no atiende el bot ni queda en el CRM |
| B3 | Bajar el titular "Garantía de adaptación 90 días" de la PMax al local | `scripts/ads/google_titulos.js:16,47` vs `src/app/politicas-de-cambio/page.tsx:58-61` | Está vivo en la campaña que se lleva el **56% del gasto de Google** y contradice la política publicada (30 días, solo Varilux y Super Blue, con receta nueva). Un reclamo a los 60 días con el anuncio en la mano se gana: un cambio de multifocales Varilux se come el margen entero de la venta |
| B4 | Commitear `src/app/multifocales/` **junto con** `src/lib/pricing/` en un mismo commit | untracked | La página importa `precioMultifocalDesde` de esa carpeta: commitear una sin la otra rompe el build. Es la landing del producto que factura el 62,5%, y hoy vive solo en este disco |
| ~~B5~~ | ~~Deployar los 39 commits de `deploy/bot-recetas`~~ · **RESUELTO el 10/8**: ya están en `origin/main` (`rev-list --left-right --count` = `0 0`). Con ellos el guardián del techo, el vínculo chat↔ficha, la frescura de stories y el cron de carritos | — | — |
| **B5-bis** | **Deployar la CSP** (`fix/csp-google-ads`): `origin/main` no lista `googleadservices` ni `googleads.g.doubleclick.net` en `script-src`/`img-src` | `next.config.ts` | gtag manda la conversión a `googleads.g.doubleclick.net/pagead/viewthroughconversion/` y las listas de remarketing a `google.com/ads/ga-audiences`: **las dos vienen bloqueadas y fallan en silencio**. Google Ads no recibió nunca una conversión del sitio ni pudo armar un público, aunque las etiquetas de WhatsApp y Llamada estén bien cargadas. Encender Búsqueda sin esto es pagar clicks que el algoritmo no puede aprender a elegir |
| B6 | Cargar `GOOGLE_ADS_CONVERSION_LABEL` en Railway y reiniciar | Railway | Verificado en producción: `adsPurchaseLabel` llega como `"$undefined"`. Google Ads **no registra ninguna venta web**. WhatsApp y Llamada sí disparan; la compra no |
| ~~B7~~ | ~~`.gitignore` de `.env` a `.env*`~~ · **RESUELTO el 10/8**: la regla `.env*` está en `origin/main` y `git check-ignore` confirma que `.env.bak-pre-write-token` queda ignorado. Borrar igual el archivo del disco | raíz | — |
| **B7-bis** | **Rotar `CRON_SECRET` en Railway** | Railway | El valor viejo estuvo hardcodeado como fallback en `src/app/api/cron/abandoned-carts/route.ts` y publicado en `origin/main` desde `569e0fed`. La ruta ya está arreglada (falla cerrada, sin el bypass `?x=localhost` que salteaba la auth entera), pero **el secreto quedó en la historia de git** y de ahí no se saca |

### 2.2 Bloqueantes de medición — se puede encender Meta, pero no escalar sin esto

| # | Qué | Costo de saltearlo |
|---|---|---|
| M1 | Etiquetar `[metaXxx]` en el **nombre** de cada anuncio (no en el mensaje precargado de los que ya corren) | `fetchSpendByTag` descarta todo anuncio sin etiqueta (`src/lib/ads/meta-insights.ts:166-168`): ese gasto es invisible en la tabla de ROAS. Renombrar **no** resetea aprendizaje; editar el mensaje precargado **sí** |
| M2 | Escribir `[metaXxx]` en el mensaje precargado **solo de los anuncios nuevos** | Hoy la etiqueta llega en el 4,4% de los chats (9 de 203). Todo el sistema de atribución está bien construido y corriendo en vacío |
| M3 | Disparar `fbq('track','PageView')` en cada cambio de ruta (colgarlo del `useEffect` de `pathname` de `AnalyticsTracker.tsx:44-50`) | Meta ve 1 PageView por sesión sin importar cuántas páginas se recorran. Los públicos de remarketing por URL de `/tienda`, `/multifocales`, `/lentes-de-sol` son **inconstruibles** |
| M4 | Sacar el espejo server-side (CAPI) de atrás del banner de cookies: `src/app/api/web/track/route.ts:55` | El CAPI existe para sobrevivir a adblock e ITP y se apaga con la **misma llave** que enciende el Pixel. La redundancia que se pagó no cubre a nadie nuevo. *(Encuadre legal: la Ley 25.326 no es equivalente al GDPR, pero confirmarlo con asesoramiento antes de tocarlo — **NO VERIFICADO**.)* |
| M5 | Arreglar `normalizePhone` de `src/services/ads.service.ts:38-40` para que devuelva E.164 (agregar el 54), como ya hace `google-ads.service.ts:88-90` | 925 de 1.096 clientes (84%) tienen el teléfono sin código de país. Hasheados así no matchean con nadie: Meta nunca se entera de qué conversación terminó en venta, y las Customer Lists (exclusiones y lookalike) fallan en silencio |
| M6 | Dar de alta `ads-report` y `abandoned-carts` en GitHub Actions (el workflow `.github/workflows/social-crons.yml` ya funciona) | `ads-report` es el único tablero diario de la dueña **y el único consumidor del guardián del techo**: sin alta, el techo no avisa nunca. `abandoned-carts` está declarado en `vercel.json` y la app despliega en **Railway**, que lo ignora: nunca corrió |

### 2.3 Contradicciones del contexto de partida, resueltas

| Afirmación de partida | Veredicto | Fuente |
|---|---|---|
| "34 commits de medición sin deployar" | **Falso.** El embudo Pixel+CAPI está en `origin/main` desde el 2/8 (`0bf9d11c`), verificado contra el sitio vivo. Lo que falta son 39 commits de `deploy/bot-recetas`, que son otra cosa (guardián, vínculo chat↔ficha, frescura) | `git cherry -v origin/main`; payload RSC de producción |
| "El tag de Google está vacío" | **Falso en producción.** `AW-16543752866`, `G-DGYJPFKJMY` y el pixel `789449199606215` están cargados. El vacío es el `.env` **local**. Lo que falta es la etiqueta de la acción de *compra* (B6) | payload RSC de `atelieroptica.com.ar` |
| "El guardián del techo está implementado en `src/services/ads-budget.service.ts`" | ~~Falso en `origin/main`~~ → **Cierto desde el 10/8**: `deploy/bot-recetas` se mergeó y el guardián está en `origin/main`. Sigue sin servir hasta dar de alta `ads-report` (M6): es su único consumidor | `git show origin/main:src/services/ads-budget.service.ts` |
| "Gasto de los últimos 30 días: $0, todo pausado" | ~~Probablemente falso~~ → **Sin resolver, y la refutación no se sostiene.** Los "454 conversaciones en 30 días" de `plan-maquina-de-vender.md` serían el **73% de las 620 de todo el año** en esa campaña, y sus US$223 el **61% del gasto anual** de la cuenta USD. Los 30 días no pueden ser eso. Idem "Tráfico IG: 8 conv y $133.450/mes" contra 29 conv y $41.786/mes de promedio anual. **No inventar el dato: mirarlo en el Ads Manager** (recuadro de abajo) | lectura de 365 días de las dos cuentas vía `meta_report.js` |
| "Facturado abril $52,8M / mayo $54,1M" | **No es facturación.** Son presupuestos ($35,84M en **76** QUOTE) + ventas ($19,0M de lista). Lo **cobrado** fue $17,0M en abril y $12,7M en mayo | base local: sumas de `Order` por `orderType` y tabla `Payment` |
| "`/multifocales` da 404 por un bug" | **No es un bug: nunca se commiteó.** Y hay una landing viva y usable hoy: `/landing/multifocales` (200, con FAQ de adaptación y CTA a WhatsApp), `noindex` a propósito — lo cual no importa para pauta | `git status`; curl a producción |

> **Verificación de 2 minutos, obligatoria antes de tocar un presupuesto.**
> Abrir el Administrador de anuncios y mirar el gasto de los últimos 30 días **a nivel conjunto y
> anuncio**, no a nivel campaña. Si `Mensajes ✉️` de la cuenta USD está gastando: el mes 1 es una
> **reasignación** (renombrar y re-presupuestar), no un encendido. Si de verdad está en $0: es un
> encendido y hay que contar 7-14 días de aprendizaje. Ejecutar el camino equivocado borraría el
> 90% de las conversaciones de Meta o duplicaría el gasto.

---

## 3. Meta vs Google: el reparto

### 3.1 El número que decide

| Canal | Costo por conversación de WhatsApp | Fuente |
|---|---|---|
| Meta, objetivo **Mensajes** (ARS, 365d) | **$857** | contexto: $3.158.520 / 3.686 |
| Meta, objetivo Mensajes (USD, 365d) | $922 | USD 364 × $1.570 / 620 |
| Meta, objetivo Mensajes (USD, últimos 30d) | $771 | `plan-maquina-de-vender.md` §4.1 |
| Meta, **Remarketing** | $1.328 | $518.039 / 390 |
| Google, mejor campaña (**Search Óptica**) | **$2.255** por chat / $1.011 por *conversión* | `estrategia-busquedas-locales.md` §4 / `plan-maquina` §4.1 |
| Google, cuenta completa | $7.296 | `estrategia-busquedas-locales.md` §1 |
| Meta, objetivo **Tráfico** | $17.291 (ARS) / $19.232 (USD) | $501.438 / 29 y USD 147×1.570 / 12 |
| Meta, **Catálogo** (una sola compra en 365 días) | $155.326 por compra | contexto |

> **Ojo con los dos números de Google.** "$1.011 por conversión" cuenta conversiones de la cuenta
> (clics a WhatsApp + llamadas + acciones locales). "$2.255 por chat" cuenta chats reales. El
> segundo es el comparable contra los $857 de Meta. Además la fuente interna se contradice a sí
> misma: 86 chats × $7.296 = $627.456 pero declara $517.000/mes de gasto (21% sin explicar).
> Usar como orden de magnitud, no como cifra de cierre.

**Meta compra la conversación 2,6 veces más barata que el mejor Google.** Esa es toda la
justificación del reparto. Lo que impide llevarlo a 85/15 son tres cosas concretas:

1. **Google pesca al que ya tiene la receta en la mano.** Nadie busca "multifocales" seguido —
   el recambio es cada 2-3 años — pero el día que el oculista le da la receta busca *hoy*.
2. **Search Óptica pierde el 47% de sus impresiones por presupuesto** a $1.011/conversión. Es la
   única góndola barata sin comprar de las dos plataformas.
3. **Concentrar todo en Meta es riesgo de plataforma única.** Un error 368 apaga la captación de
   un día para el otro. El piso de Google Búsqueda es el seguro y no se toca.

### 3.2 El reparto, y por qué no es el que proponen los documentos previos

| Propuesta | Reparto | Total | Veredicto |
|---|---|---|---|
| `estrategia-busquedas-locales.md` (8/8) | 51/49 | $820.000 | **Descartado.** Paga el premio de 2,6x sobre la mitad del presupuesto, contra una hipótesis de intención que nadie midió |
| `plan-maquina-de-vender.md` §4.0 (9/8) | Meta $580.000 / Google $420.000 | $1.000.000 | **Base adoptada**, con dos correcciones (ver abajo) |
| `plan-maquina-de-vender.md` §4.3 | Meta $482.000 / Google $420.000 | $902.000 | Se contradice con §4.0 en $98.000 y en si la cuenta ARS va a cero |
| `plan-campanias-meta-google.md` | mínimo $1.050.000 | — | **Derogado.** Su escenario más barato ya supera el techo en 5%; el recomendado, en 125% |

**Reparto adoptado: 62% Meta / 38% Google en régimen, con rampa.** Es el punto medio defendible
entre el 65/35 y el 53/47 propuestos, y respeta las dos restricciones duras:

- **Piso de aprendizaje de Meta:** 50 conversiones/semana por conjunto × $857 = **$186.100/mes por
  conjunto**. Con Meta en $370.000 (mes 1) entra **un solo conjunto** que aprenda.
- **Piso de Google Búsqueda:** **$250.000/mes desde el mes 3**, y no se baja aunque el $/chat siga
  peor que el de Meta.

**Correcciones a `plan-maquina` §4.0/§4.3, y por qué:**

- **§4.3 mata de hambre a dos de sus tres conjuntos de Meta.** Reparte $410.000 / $52.000 / $20.000.
  A $1.871 por conversación, un conjunto de $20.000/mes produce **2,5 conversaciones por semana**.
  Eso no es "aprendizaje limitado", es no tener datos. Se consolida en dos conjuntos.
- **La cuenta ARS no se desactiva.** §4.0 dice "$0, desactivada"; §4.3 le asigna $72.000. Se
  resuelve así: **cuenta USD = prospección (M1), cuenta ARS = solo remarketing (M2)**, y ninguna
  otra campaña viva en ninguna de las dos. Motivo concreto: el piso de Meta de **US$5/día** haría
  que el remarketing se lleve el 41% del presupuesto de Meta si vive en la cuenta USD; en pesos,
  $3.500/día lo deja en 18%.
- **No rebuildear la campaña que funciona.** `Mensajes ✉️` (USD) trae 454 conversaciones a ~$771 en
  30 días. M1 **es esa campaña renombrada y re-presupuestada**. Crearla de cero tira el aprendizaje
  y arranca 20-50% más caro durante 7-14 días.

> **Contradicción resuelta:** dos auditorías proponen apagar la cuenta USD y consolidar en pesos.
> Me quedo con mantener la USD porque es la única auditoría que miró los últimos 30 días, y el
> argumento de no tirar el aprendizaje de la campaña más barata de la operación es decisivo. La
> diferencia de costo entre cuentas es del 7% ($857 vs $922): no compensa.

---

## 4. Presupuesto

### 4.1 Tabla mes a mes, abierta por campaña

Todos los montos en ARS/mes. La cuenta USD se carga **en dólares** (ver riesgo R3).

| Línea | Cuenta | Mes 1 | Mes 2 | Mes 3 |
|---|---|---|---|---|
| **META** | | **$370.000** | **$565.000** | **$620.000** |
| M1 · `[MF] Mensajes · Multifocales Córdoba` | USD (`act_2107444353167176`) | $370.000 (US$236/mes = **US$7,85/día**) | $460.000 (US$293 = **US$9,77/día**) | $500.000 (US$318 = **US$10,61/día**) |
| M2 · `[RMK] Mensajes · Remarketing 30d` | ARS (`act_901723834933651`) | $0 | $105.000 (**$3.500/día**) | $120.000 (**$4.000/día**) |
| M3 · Control de miopía | — | $0 | $0 | $0 (va a Google C6) |
| M4 · Catálogo / Ventas | — | $0 | $0 | $0 (permanente) |
| **GOOGLE** | | **$230.000** | **$285.000** | **$380.000** |
| C1 · Search \| Marca | | $20.000 | $20.000 | $20.000 |
| C2 · Search \| Óptica local | | $100.000 | $120.000 | $135.000 |
| C3 · Search \| Multifocales | | $60.000 | $75.000 | $85.000 |
| C4 · Search \| Anteojos recetados | | $50.000 | $50.000 | $70.000 |
| C5 · Search \| Obras sociales y reintegros | | $0 | $20.000 | $30.000 |
| C6 · Search \| Control de miopía infantil | | $0 | $0 | $40.000 |
| PMax "al local" · Maps · PMax Ventas · Display | | **$0** | **$0** | **$0** |
| **TOTAL** | | **$600.000** | **$850.000** | **$1.000.000** |
| Aire bajo el techo | | $400.000 | $150.000 | $0 |

**De dónde sale la plata para Google sin pedir un peso más:** hoy la PMax "al local" se lleva
$357.709/mes (56% del gasto de Google) y produce 550 "conversiones" a $650 con un **valor total
declarado de $550** — o sea que le enseña a Google a comprar clics de indicaciones de Maps. La
campaña de Maps gasta $129.569/mes con **0 chats en 90 días**. Apagar las dos libera $487.278/mes,
mucho más de lo que este plan le pide a Google en el mes 3.

### 4.2 Verificación de pisos

| Línea | Presupuesto mes 1 | Piso | ¿Aprende? |
|---|---|---|---|
| M1 (Meta, 50 conv/sem × $857 = $186.100/mes) | $370.000 | $186.100 | **Sí, 2,0x el piso** (~336 conv/mes = 78/semana) |
| M2 (Meta remarketing, CPA $1.871) | $105.000 (mes 2) | $406.300 | **No, y está bien.** 56 conv/mes = 13/semana. Se juzga por costo por conversación, no por estado de aprendizaje |
| C2 Google (tCPA pide 30 conv/30d a $1.011) | $100.000 | $30.330 | **Sí, 3,3x** |
| C3 Google | $60.000 | $30.330 | Sí |
| C1 / C4 Google | $20.000 / $50.000 | — | C1 va en *Maximizar clics* con tope $200, no necesita conversiones |

**Regla dura que sale de estos números, y hay que escribirla al lado del techo:**

> Ningún conjunto de Meta por debajo de **$186.000/mes** puede considerarse optimizable. Se juzga
> solo por su costo por conversación medido, **no se le rota creatividad** y no se le sube el
> presupuesto esperando que "salga del aprendizaje". Y **está prohibido abrir un tercer conjunto de
> Meta bajo este techo**: el historial de esta cuenta son 8 conjuntos "Copia" compitiendo entre sí,
> ninguno llegando a 50 conversiones semanales, todos en aprendizaje limitado todo el año.

### 4.3 Mínimo viable, y qué pasa si se invierte menos

| Escenario | Total/mes | Qué compra | Qué se pierde |
|---|---|---|---|
| **Plan** | $600k → $1.000k | Meta con un conjunto que aprende + Google Búsqueda completo | — |
| **Mínimo viable** | **$286.000** | Meta $186.000 (un conjunto, justo en el piso) + Google $100.000 (solo C2 + C1) | Remarketing, multifocales en Google, obras sociales, miopía. El motor sigue prendido |
| **Por debajo de $286.000** | — | **Elegir UNA plataforma, no repartir.** Repartir $200.000 deja a las dos por debajo de su piso: Meta en *Learning Limited* permanente y Google sin poder sostener tCPA | Si hay que elegir una: **Meta**, por los $857 vs $2.255 |
| **$0 (hoy)** | $0 | Nada | El negocio necesita **18,4 ventas/mes solo para cubrir costos fijos** ($3.788.416 en mayo). Las fuentes pagas hicieron el 58,8% de la facturación de abril y el 62,9% de la de mayo |

### 4.4 Proyección de retorno — supuestos explícitos

**Supuestos, todos declarados. Si uno cambia, cambia la proyección:**

| Supuesto | Valor | Origen | Confianza |
|---|---|---|---|
| Ticket promedio **cobrado** por venta | $365.011 | 90 ventas SALE abr-jun, base local | Alta |
| Margen de contribución sobre lo cobrado | **55%** (= $200.000/venta) | Medido 56,3% con la fórmula de `report.service.ts:392`; el rango de las auditorías va de 43,8% a 68% según qué ítems se cuenten. Se usa 55% como conservador | Media |
| Tasa conversación WhatsApp → venta | **6,0%** base / **3,0%** pesimista | Derivada: 8,0% conversación→ficha × 75,6% ficha→orden, sobre fichas `contactSource='Meta'` de abr-may | **Baja — es la cifra más frágil del plan** |
| CPA por conversación, Meta | $1.100 (mes 1) · $1.200 (mes 2) · $1.500 (mes 3, Q4) | $857 histórico + 28% por reencendido, inflación y escala; +25% más por CPM de Q4 | Media |
| CPA por chat, Google | $2.400 (mes 1-2) · $2.800 (mes 3) | $2.255 de Search Óptica + margen | Media |

| | Mes 1 | Mes 2 | Mes 3 | **Total 3 meses** |
|---|---|---|---|---|
| Inversión | $600.000 | $850.000 | $1.000.000 | **$2.450.000** |
| Conversaciones estimadas | ~432 | ~590 | ~549 | **~1.571** |
| **Ventas — escenario base (6,0%)** | 26 | 35 | 33 | **94** |
| Contribución base | $5.200.000 | $7.000.000 | $6.600.000 | **$18.800.000** |
| **Retorno base (contribución ÷ pauta)** | **8,7x** | **8,2x** | **6,6x** | **7,7x** |
| **Ventas — escenario pesimista (3,0%)** | 13 | 18 | 17 | **48** |
| Contribución pesimista | $2.600.000 | $3.600.000 | $3.400.000 | **$9.600.000** |
| **Retorno pesimista** | **4,3x** | **4,2x** | **3,4x** | **3,9x** |
| **Punto de equilibrio (ventas atribuidas)** | **3,0** | **4,3** | **5,0** | **12,3** |

**Lectura:** incluso partiendo la tasa de cierre a la mitad, la pauta devuelve 3,9 pesos de
contribución por peso invertido. El equilibrio del mes 3 son 5 ventas; en mayo las fuentes pagas
produjeron 72 órdenes. **El riesgo no es económico, es de medición y de capacidad de atención.**

**El número que va arriba del mail diario, en una sola línea:**
> *Este mes hacen falta 5 ventas atribuidas para que la pauta se pague sola.*

### 4.5 CPA objetivo por producto

No hay un solo CPA. Una venta de multifocal deja 2,5 veces más que una de receta simple.

| Producto | % de ventas | Margen de contribución | CPA de equilibrio | **CPA objetivo (1/3)** |
|---|---|---|---|---|
| Multifocal | 24,7% (52,5% de la plata) | $375.126 | $375.126 | **$125.000** |
| Monofocal / receta simple | 56,7% | $149.796 | $149.796 | **$50.000** |
| Solo armazón | 7% | $120.724 | $120.724 | **$40.000** |
| Lentes de sol | 2% (muestra insuficiente) | $132.500 | $132.500 | $44.000 — orientativo |
| **Promedio ponderado** | | **$205.366** | $205.366 | **$68.000** |

Consecuencia operativa: **C3 (Multifocales en Google) puede pagar el doble de CPC que C4 y seguir
ganando.** No pujarlas igual.

### 4.6 Valor de conversión: cargar lo **cobrado**, no la lista

El precio de lista **es** el precio de tarjeta en 6 cuotas: efectivo paga el 80% (descuento 20%) y
la tarjeta 6c paga el 100% pero PayWay se lleva el 20%. Ambos caminos dejan el 80%.

| Si el valor de conversión que se carga es… | ROAS mínimo de equilibrio |
|---|---|
| Lo **cobrado** (correcto) | **1,78x** |
| El precio de **lista** | 2,08x |
| ROAS objetivo (ratio 3:1) | 5,3x sobre cobrado · 6,2x sobre lista |

Optimizar contra la lista infla el ROAS aparente un 17% y sostiene campañas que en realidad pierden.

> **Y una advertencia sobre el evento Purchase:** no hay **una sola** venta web en la base (0 de 90
> órdenes tienen `idempotencyKey`). El checkout produjo 1 compra en 5 semanas. **No optimizar
> campañas por Purchase** — sería optimizar contra cero. Se optimiza por *conversación de WhatsApp*
> y se mide el cierre contra `Client.contactSource` + la etiqueta `[metaXxx]` en el CRM.

---

## 5. Estructura de campañas en Meta

### 5.1 Tabla lista para ejecutar

Parámetros comunes a los dos conjuntos: `destination_type: WHATSAPP` · `optimization_goal:
CONVERSATIONS` · `billing_event: IMPRESSIONS` · `bid_strategy: LOWEST_COST_WITHOUT_CAP` **explícito**
(sin él la API falla con "importe de puja requerido" y el error no nombra el campo) · ubicaciones
Advantage+ **menos Audience Network** · entrega 24/7 (el bot atiende) · los 4 tamaños por
`asset_customization_rules` · **ABO, nunca CBO** (ver 5.2).

| # | Campaña | Cuenta | Objetivo API | Conjunto (uno solo) | Público | $/día | Anuncios |
|---|---|---|---|---|---|---|---|
| **M1** | `[MF] Mensajes · Multifocales Córdoba` | USD `act_2107444353167176` | `OUTCOME_ENGAGEMENT` | `MF · Cba+15km · 42-60` | Córdoba capital **+15 km** desde Tejeda 4380 · **42-60 años** · **ambos géneros** · Advantage+ audience con la edad como único filtro duro · **sin intereses** | **US$7,85** (mes 1) → US$9,77 → US$10,61 | 3-4 |
| **M2** | `[RMK] Mensajes · Remarketing 30d` | ARS `act_901723834933651` | `OUTCOME_ENGAGEMENT` | `RMK · web30 + redes30 + video50` | Un conjunto **combinado**: visitantes web 30d ∪ interacción IG/FB 30d ∪ viewers ≥50% de reels. Excluir X1+X2+X3 (ver §7) | **$0** mes 1 → $3.500 → $4.000 | 3 |
| M3 | Control de miopía | — | — | — | — | **$0 permanente** | — |
| M4 | Catálogo / Ventas | — | — | — | — | **$0 permanente** | — |

**M1 se renombra O se crea — depende de lo que muestre el Ads Manager, y hay que mirarlo.**

> **Corregido el 10/8.** Este bloque afirmaba que `Mensajes ✉️` (USD) "trae 454 conversaciones a
> ~$771 en 30 días" y daba el renombrado por hecho. Ese número es incompatible con los totales
> verificados de la cuenta: **620 conversaciones y US$364 en 365 días**. 454 conversaciones en un
> mes serían el 73% del año entero, y su gasto el 61% del anual. Y la lectura de los últimos 30
> días da **$0**.

- **Si el conjunto está gastando** (verificar a nivel conjunto/anuncio, no campaña): se **renombra**.
  Cambio de nombre, presupuesto a nivel conjunto (ABO), anuncios renombrados con `[metaXxx]`, y
  **no se toca el mensaje precargado** — eso es edición de creative y resetea el aprendizaje.
- **Si está en $0** (lo que dice el dato duro): es un **encendido**, con 7-14 días de aprendizaje
  antes de juzgar nada. El presupuesto del mes 1 no cambia; lo que cambia es la expectativa de las
  primeras dos semanas y cuándo se evalúa el primer corte.

**Lo único que se pausa:** `Campaña de Tráfico en Instagram`. Con datos verificados de 365 días son
**29 conversaciones y $501.438** (~$41.786/mes, $17.291 por conversación) — no las "8 conv a $16.681
en 30 días / $133.450 liberados" que decía acá. La decisión no cambia: es 20x peor que Mensajes.

### 5.2 Decisiones que hay que dejar escritas

**Por qué ABO y no CBO.** M1 convierte a ~$771 y M2 a $1.871 — 2,4x más caro. CBO optimiza a
resultado más barato: le sacaría el presupuesto al remarketing y lo mandaría todo a prospección.
Pero **la conversación cara del remarketing es la que cierra**, y el cierre pasa en el local y queda
en el CRM, no en el panel de Meta. CBO no tiene forma de saberlo. Se reevalúa recién cuando CAPI
for Business Messaging esté devolviendo ventas con valor.

**Por qué M3 (miopía) va a $0 en Meta, con el precio puesto.** El piso oficial de US$5/día son
$7.850 ARS = **41% del presupuesto de Meta del mes 1**, para un nicho sin un solo dato de costo por
conversación. Financiarlo cuesta ~305 conversaciones de multifocales por mes. La miopía infantil va
a **Google C6** (intención explícita, volumen chico, sin fase de aprendizaje que alimentar) y en
Meta se sostiene **gratis** con los reels orgánicos que ya existen (`stellest-frena-miopia.mp4`,
`que-es-la-miopia.mp4`, `lente-myofix.mp4`), que además engordan el público tibio de M2.

**Por qué M4 (catálogo) va a $0 permanente.** Aritmética: salir de aprendizaje con el evento
*compra* pide 50 compras/semana; al CPA histórico de catálogo ($155.326) son **$1.109.471/día**,
57 veces el presupuesto diario entero de Meta. Aun con un CPA optimista de $30.000 serían $6,4M/mes.
Y no hubo **ni un día** de los 365 auditados con feed de catálogo servido ni con un Purchase
llegando a Meta: la campaña gastó $155.326 comprando la impresión más barata disponible.

**Por qué 42-60 y no 45-65+ ni 40-65.** El 71% de las ventas de multifocal cae entre 42 y 57 años
(inferido por DNI, ±3 años). Debajo de 42 hay **una sola** venta multifocal en toda la base. La
banda 22-36 tiene más ventas pero ticket $234.395 contra $679.622 de la banda 49-57.

**Por qué NO separar por género.** La memoria del proyecto dice "mujeres 45-54". El dato real: las
mujeres son el 76% de las **conversaciones** con pico 45-54, pero entre compradores de multifocal es
49% / 51%, y la mediana de gasto es $345.000 (mujeres) vs $381.844 (varones) — 11% de diferencia,
dentro del ruido. Además el sesgo se **invierte** con la edad (42-49 es 14F/4M; 49-57 es 4F/8M): un
conjunto "solo mujeres" se pierde justo la banda de ticket más alto. Y dos conjuntos compiten entre
sí en la subasta y ninguno junta conversiones para salir de aprendizaje.

**Por qué 15 km y no 35.** El 73,6% de los compradores tiene teléfono 351 (Córdoba capital). Carlos
Paz aporta 6 de 178 (3,4%). El local está en la zona noroeste, así que el radio no queda centrado
en la ciudad: **verificar en el mapa de Meta que el borde sur de la capital quede adentro** antes de
dar los 15 km por buenos. Carlos Paz, Punilla y el interior van al remarketing (M2), que sí va a
Córdoba provincia.

### 5.3 Regla de escalado

- Máximo **+15-20% por paso**, un solo ajuste por campaña cada **3-4 días**, **nunca duplicar**.
- Cualquier cambio de presupuesto >20% de una vez resetea el aprendizaje (y desde el update
  Andromeda de abril 2026 el umbral de "edición significativa" se endureció).
- Desde $620.000/mes solo quedan ~$0 de aire en la porción de Meta: **crecer en Meta exige mover
  plata desde Google (10-15%/mes, con piso de Google Búsqueda de $250.000)**, no subir el techo.
- Ventana de no-edición de 7-14 días post-lanzamiento: **respetarla**.

---

## 6. Estructura de campañas en Google

### 6.1 Higiene del día 1, antes de crear una sola campaña

1. **Conversiones primarias:** dejar como PRIMARIAS **solo** "Conversación de WhatsApp iniciada" y
   "WhatsApp del sitio". Pasar a SECUNDARIAS (nunca borrar) las 5 acciones locales (indicaciones de
   Maps, Local actions Directions / Website visits / Other engagements, suscripciones de YouTube),
   la de compra web importada de GA4 y la de Tiendanube.
   *Por qué:* con 5 acciones locales como primarias, la cuenta le enseña a Google a comprar clics de
   dirección. La PMax al local registró 550 "conversiones" a $650 con un **valor total declarado de
   $550** contra $357.709 de gasto.
2. **Vincular la lista compartida de negativas "General" (id `11042611019`) a TODAS las campañas de
   búsqueda**, existentes y nuevas, y verificarlo con GAQL antes de subir presupuesto:
   `SELECT campaign.name FROM campaign_shared_set WHERE shared_set.id = 11042611019`.
   *Hoy está aplicada solo a las dos PMax.* Las tres campañas de Search que ya gastan $120.319/mes
   pueden estar corriendo sin ninguna negativa.
3. **Apagar:** PMax "al local" ($357.709/mes), Google Maps ($129.569/mes, 0 chats en 90 días), PMax
   Ventas ($28.630/mes, $5.726/conv). El pin de Maps se cubre **gratis** con los assets de ubicación
   de C1/C2.
4. **Puja:** todas las campañas nuevas en *Maximizar conversiones* **sin tCPA**. Recién con 30
   conversiones en 30 días por campaña, pasar a tCPA = CPA real +10%. C1 Marca va en *Maximizar
   clics* con tope de CPC $200. **Concordancia amplia PROHIBIDA en toda la cuenta.**
5. **Merchant Center:** dar el alta **solo para fichas gratuitas** ($0). El feed ya responde 200 en
   `/feed/google.xml` con 113 ítems, imágenes .webp ≥500×500 todas 200, y todos los atributos
   obligatorios. **Antes del alta**, arreglar tres cosas o la cuenta arranca con desaprobaciones:
   los 15 ítems en 7 grupos con `item_group_id` y color repetidos, los 113/113 declarados `in_stock`
   mientras la ficha dice "PREVENTA" (usar `preorder` + `availability_date`), y la marca escrita de
   dos formas ("Cápsula Escarlata" / "Cápsula escarlata"). Agregar `installment` (6 cuotas): es el
   único lugar donde las cuotas aparecen en el resultado de Google, y en Argentina la gente compara
   cuota, no precio.

### 6.2 Campañas

| # | Campaña | Grupos | Presupuesto/día (mes 3) | Landing | Puja |
|---|---|---|---|---|---|
| **C1** | `Search \| Marca` | Uno, todo exacta | $667 | home | Max. clics, tope CPC $200 |
| **C2** | `Search \| Óptica local` | 2A ciudad · 2B zona norte · 2C cerca de mí (radio 5 km) | $4.500 | `/optica-cordoba` · `/nuestro-local` | Max. conversiones |
| **C3** | `Search \| Multifocales` | 3A multifocal+geo · 3B precio · 3C Varilux · **3D presbicia (nuevo)** | $2.833 | `/landing/multifocales` hoy → `/multifocales` al deployar · 3C a `/cristales-opticos/varilux` | Max. conversiones |
| **C4** | `Search \| Anteojos recetados` | 4A recetados · 4B cristales y tratamientos · 4C armazones | $2.333 | `/cristales-opticos` y sus subpáginas · `/tienda` | Max. conversiones |
| **C5** | `Search \| Obras sociales y reintegros` | Uno, exactas | $1.000 (desde mes 2) | `/obras-sociales` (200) | Max. conversiones |
| **C6** | `Search \| Control de miopía infantil` | Uno | $1.333 (desde mes 3) | `/cristales-opticos/stellest` · `/myofix` | Max. conversiones |
| C7 | `Search \| Sol con receta` | Uno | **$0 hasta octubre**, después $700-1.000/día solo en temporada | `/lentes-de-sol` | — |

**Keywords por grupo (todo exacta salvo lo marcado):**

- **C1 Marca:** `[atelier optica]`, `[optica atelier]`, `[atelier optica cordoba]`,
  `[atelier optica cerro de las rosas]`, `[atelieroptica]`, `"atelier optica"` (frase, respaldo).
  **NUNCA la palabra "atelier" sola ni en amplia** — en castellano es taller de artista y hay
  ateliers de ropa, peluquería, tortas y arquitectura. Negativas de campaña: *ropa, peluqueria,
  tortas, muebles, decoracion, arquitectura, alquiler*. Día 60: si Estadísticas de subastas muestra
  que nadie más puja "atelier", bajar a $300/día.
- **C2A:** `[opticas en cordoba]`, `[optica en cordoba]`, `[opticas cordoba capital]`,
  `[optica cordoba capital]`, `[mejores opticas en cordoba]`, `[opticas en cordoba capital]`,
  `"opticas en cordoba"`.
- **C2B:** `[opticas cerro de las rosas]`, `[optica cerro de las rosas]`,
  `[opticas zona norte cordoba]`, `[optica zona norte cordoba]`, `[optica villa belgrano]`,
  `[optica urca]`.
- **C2C:** `[optica cerca de mi]`, `[opticas cerca de mi]`, `"optica cerca"`,
  `[opticas abiertas ahora]`.
- **C3A:** `[lentes multifocales cordoba]`, `[multifocales cordoba]`,
  `[anteojos multifocales cordoba]`, `[lentes progresivos cordoba]`,
  `[anteojos progresivos cordoba]`, `[opticas multifocales cordoba]`, `"lentes multifocales"`,
  `"lentes progresivos"`.
- **C3B precio:** `[precio lentes multifocales]`, `[precio lentes multifocales cordoba]`,
  `[cuanto cuesta un lente multifocal]`, `[cuanto sale un lente multifocal]`,
  `[cuanto cuestan los anteojos multifocales]`, `[precio lentes progresivos]`,
  `[precio anteojos multifocales]`, `"lentes multifocales precio"`.
- **C3C Varilux:** `[varilux]`, `[lentes varilux]`, `[varilux precio]`, `[varilux cordoba]`,
  `[varilux comfort max]`, `[varilux xr]`, `[varilux xr series]`, `"cristales varilux"`.
- **C3D presbicia (grupo nuevo, no estaba en ningún plan):**
  `[anteojos para ver de cerca y de lejos]`, `[lentes para presbicia]`,
  `[anteojos para vista cansada]`, `[anteojos para leer y ver de lejos]`,
  `"vista cansada anteojos"`.
  *Por qué:* mucha gente de 45 a 60 **no sabe la palabra "multifocal"** y busca el síntoma. El blog
  ya tiene la nota para esa búsqueda.
- **C4A:** `[anteojos recetados cordoba]`, `[lentes recetados cordoba]`,
  `[anteojos de receta cordoba]`, `[anteojos con receta cordoba]`, `[hacer lentes con receta]`,
  `[lentes con aumento cordoba]`, `"anteojos recetados"`.
- **C4B:** `[cristales para anteojos cordoba]`, `[cambiar cristales anteojos]`,
  `[cristales antirreflex]`, `[lentes fotocromaticos precio]`, `[cristales transitions precio]`,
  `[lentes con filtro azul]` → a las subpáginas propias que **ya dan 200**:
  `/cristales-opticos/antirreflejo`, `/transitions`, `/blue-uv`.
- **C4C:** `[armazones para anteojos cordoba]`, `[armazones de lentes cordoba]`,
  `[armazones de diseno]` → `/tienda` (100 armazones publicados).
- **C5 obras sociales:** `[reintegro anteojos osde]`, `[reintegro anteojos swiss medical]`,
  `[reintegro de anteojos]`, `[como pedir reintegro de anteojos]`,
  `[factura para reintegro de anteojos]`, `[optica con osde cordoba]`,
  `[optica con swiss medical cordoba]`, `[optica con apross cordoba]`,
  `[cobertura anteojos prepaga]`, más `"reintegro anteojos"` y `"reintegro de lentes"` en frase.
- **C6 miopía:** `[lentes stellest]`, `[stellest precio]`, `[stellest cordoba]`, `[lentes myofix]`,
  `[myofix precio]`, `[control de miopia infantil]`, `[control de miopia cordoba]`,
  `[lentes para frenar la miopia]`, `[anteojos para ninos cordoba]`, `"miopia infantil"`.

**C5 resuelve una "pregunta abierta" que la propia web ya contestaba:** Atelier **no tiene
convenio**, trabaja por **reintegro**. `/obras-sociales` está viva (200) y nombra OSDE (210 y 410),
Swiss Medical, Galeno, Apross y Jerárquicos. Eso convierte a OSDE/Apross/Swiss de negativa a
oportunidad — **pero con copy que diga REINTEGRO, no cobertura**, y con los nombres de las prepagas
en las **keywords**, nunca en el titular (política de marcas de terceros).

### 6.3 Negativas

**Negativas de campaña (evitan que el genérico le robe la búsqueda a la campaña específica):**

| Campaña | Negativas |
|---|---|
| C2 | multifocal, multifocales, progresivos, varilux, recetados, stellest, "atelier optica", reintegro, "obra social", osde, apross, swiss, galeno |
| C3 | bifocal, bifocales, "lentes de contacto", "cerca de mi" |
| C4 | multifocal, multifocales, progresivos, "lentes de contacto", "cerca de mi" |
| C5 (**obligatorias**) | pami, gratis, convenio, cartilla, "100% cubierto", "sin cargo", "orden medica" |

**Capa de "rubro equivocado" — hoy NO existe y hay que cargarla entera.** La lista compartida tiene
116 pares y es **90% nombres de ópticas de Córdoba y CERO rubro equivocado**, cuando el incidente
documentado que originó todo el sistema (29/7/2026) fue un contacto que preguntaba por "ópticas para
vehículos" — faros de auto. El clasificador `FUERA_DE_RUBRO` del reporte ya detecta estas cinco
familias pero **nadie portó la detección a la lista de negativas**: se mira el problema todas las
semanas y no se bloquea. Todo en BROAD salvo lo marcado, **con y sin tilde**:

- **Vehículo/faro:** auto, autos, vehiculo, camion, moto, xenon, halogeno, led, baliza, delantera, trasera
- **Fibra óptica:** `"fibra optica"` (PHRASE), internet, router, modem
- **Instrumentos:** telescopio, microscopio, binocular, lupa, `"mira telescopica"` (PHRASE), drone
- **Electrónica/vidrio:** celular, iphone, samsung, `"vidrio templado"` (PHRASE), `"protector de pantalla"` (PHRASE), notebook
- **Sin plata / otro canal:** usado, usados, `"segunda mano"` (PHRASE), `"mercado libre"` (PHRASE), mercadolibre, aliexpress, shein, temu, replica, imitacion, falso
- **Empleo/formación:** empleo, curriculum, vacante, curso, cursos, carrera, tecnicatura, `"optico tecnico"` (PHRASE), sueldo
- **Salud no-óptica:** oftalmologo, `"turno oftalmologo"` (PHRASE), lasik, cataratas, conjuntivitis, glaucoma, orzuelo, colirio, `"fondo de ojo"` (PHRASE), campimetria
- **Marcas que no están en catálogo:** zeiss, `"ray ban"`, rayban, oakley, persol, prada, gucci
  *(0 filas de Zeiss y Ray-Ban en la base; el blog las menciona en notas comparativas y eso tienta a
  pujarlas — un clic de "zeiss precio" es plata tirada)*

Se agregan editando el array `TERMINOS` de `scripts/ads/google_negativas.js`, que ya deduplica
contra lo que haya en la cuenta.

**Tres negativas ya cargadas que están cobrando peaje y hay que corregir:**

1. **`gratis` en BROAD** bloquea "anteojos **envío gratis**", y el envío gratis a todo el país es un
   argumento propio. → Pasarla a tres frases: `"anteojos gratis"`, `"lentes gratis"`, `"gratis pami"`.
2. **`optica arguello` en PHRASE.** Argüello no es solo una óptica competidora: es un **barrio de la
   zona norte**, la misma del local. Bloquea al vecino con intención de compra. → Decidir
   explícitamente qué hacer con ella.
3. **`optica italia` PHRASE está duplicada** (SEGUNDA_TANDA y CUARTA_TANDA). El script deduplica
   contra la cuenta pero no contra sí mismo.

**Además:** 548 de los 586 términos originales de la lista compartida están en concordancia
**EXACTA** — el 93,5% de la lista solo bloquea la frase escrita idéntica. Es una falsa sensación de
protección: por eso "clínica romagosa oftalmología" estaba bloqueado y "clínica romagosa" a secas
seguía mostrando el aviso.

### 6.4 Lo que NO se hace en Google, y por qué

| | Motivo |
|---|---|
| **Performance Max** | Pide 30-50 conversiones/mes y un piso de US$50-100/día = **$2,4M a $4,7M ARS/mes**. El techo entero (Meta + Google) es $1M: va entre 2,4x y 4,7x por debajo del mínimo. Con esa señal PMax gasta todo en Display y YouTube basura y **no deja ver términos de búsqueda** para darse cuenta |
| **Shopping pago** | Se evalúa recién si en 60-90 días las **fichas gratuitas** muestran impresiones y clics. Y entonces Shopping *standard*, no PMax: deja ver términos, permite negativas y permite apagar productos uno por uno. Tope $300.000/mes |
| **Google Maps** | $129.569/mes con **0 chats en 90 días** |
| **Display / Demand Gen** | Sin públicos propios (ver §7.3) y sin volumen de conversión |
| **Concordancia amplia** | Multifocales en amplia costó $29.425/chat |
| **Campaña de competencia** | Tres razones: (a) la cuenta tiene ~50 nombres de ópticas cordobesas como **negativas** — sería contradecir su propia política; (b) Google **prohíbe** usar la marca ajena en el texto del anuncio, así que el RSA sale genérico → CTR bajo → Nivel de calidad bajo → clic caro; (c) el 98,7% de las keywords de esta cuenta no gastó en 30 días: el volumen de "óptica X" de un competidor de barrio son decenas al mes. Y encima invita represalia sobre "atelier optica", hoy la keyword más barata de la cuenta |

**El límite estructural de Google, que no se arregla con presupuesto:** el **98,7% de las 2.761
keywords de la cuenta no registró gasto en 30 días** (~36 vivas). Por encima de cierto punto, más
plata en Google compra **ranking, no clientes**. Si en el mes 3 la impresión perdida por presupuesto
en C2 llega a ~0 con $/chat aceptable, el excedente se va a Meta, no se fuerza en Google.

### 6.5 Restricción de Google que hay que aceptar de entrada

**"Salud" es categoría de interés sensible en Google.** El efecto concreto es que el anunciante
marcado **no puede usar públicos propios**: listas de clientes, segmentos de datos, similares y
remarketing quedan fuera; solo quedan las audiencias predefinidas. La cuenta ya arrastra
`APPROVED_LIMITED`. Esto **no** afecta la medición (conversiones offline, conversiones mejoradas):
afecta la segmentación.

Y aunque no estuviera marcada: **Customer Match arranca en acceso ESTÁNDAR**, que solo habilita
"Observación" y "Exclusiones". Para usarla como *Segmentación* hacen falta 90 días de historial **y
más de USD 50.000 de inversión acumulada** = ARS 78.500.000 = **~78 meses** al techo de $1M/mes. No
es un objetivo alcanzable: **planificar Google asumiendo acceso estándar**.

> Consecuencia de diseño: **el remarketing vive en Meta. En Google solo Search por intención
> tipeada.** No armar el plan alrededor de Customer Match ni de listas de remarketing en Google.

---

## 7. Remarketing

### 7.1 Por qué el remarketing histórico salió 1,55x más caro que el frío (y no era peor)

| | Remarketing | Frío | Ratio |
|---|---|---|---|
| Conversión clic → conversación | **12,63%** | 6,91% | **1,83x mejor** |
| CPC | $167,7 | $59,2 | 2,83x peor |
| CPM | $6.015 | $1.997 | **3,01x peor** |
| Personas alcanzadas en 365 días | **25.330** | 416.176 | 16x más chico |
| Costo por conversación | $1.328 | $857 | 1,55x peor |

**La aritmética cierra exacta:** 2,83 (CPC) ÷ 1,83 (conversión) = 1,547, y el ratio real observado
es 1.328/857 = 1,55. **No queda nada sin explicar: el sobrecosto es 100% CPM, no calidad.**

**Y el CPM era alto porque el pozo estaba vacío por diseño.** Los $3.158.520 de la campaña "Mensajes"
son click-to-WhatsApp: esos 53.364 clics abren WhatsApp y **nunca pisan la web**. No alimentaron
ningún público de píxel. El único alimentador web fue "Tráfico en Instagram" y el orgánico.

**Con el CPM del frío, el remarketing habría costado $441 por conversación** — el canal más barato
del negocio, no el más caro.

### 7.2 Regla dura de presupuesto de remarketing

> `gasto_remarketing_mensual = personas_en_el_pozo_30d × 6 impresiones × $2.500 CPM / 1000`
> ≈ **$15 ARS por persona del pozo, por mes.**
> Con menos de 10.000 personas en el pozo, el remarketing **no pasa de $150.000/mes**.
> Revisar el tamaño del pozo en el Administrador de anuncios **antes** de subir el presupuesto.
> Techo del remarketing bajo este plan: **15-20% del total** ($105.000 → $120.000/mes).

**Y NO se prende el día 1.** Correr la campaña fría sola durante **14 días** y recién ahí encender.
Con el pozo en cero, prender remarketing junto con el frío repite exactamente el CPM de $6.015 que
ya se pagó.

### 7.3 La escalera en Meta

**Exclusiones globales — se aplican a TODOS los conjuntos, frío incluido, y son las mismas siempre:**

- **X1** = Customer List "Compradores CRM" (todos, sin ventana)
- **X2** = Purchase del píxel, 180 días
- **X3** = Customer List "Chats de WhatsApp abiertos últimos 30 días", regenerada por script nocturno
  desde la tabla `WhatsAppChat`
  *(hoy no existe: se están pagando impresiones a gente que el sistema de seguimientos ya está
  atendiendo por WhatsApp — plata pagada dos veces)*

| # | Escalón | Ventana | Público | Excluye | Mensaje | ¿Construible hoy? |
|---|---|---|---|---|---|---|
| **E1** | Checkout caliente | día 1-3 | `InitiateCheckout 3d` ∪ `AddToCart 3d` | X | La fricción del checkout: 6 cuotas, garantía 30 días, "terminalo por WhatsApp, la medición te la hacemos en Tejeda 4380" | Sí |
| **E2** | Tocó WhatsApp y no escribió | día 1-3 | evento `Contact 3d` (cubre whatsapp_click y phone_click) | X + E1 | "Tocaste escribir y no llegaste": horario, dirección, foto del local, "contestamos al toque" | Sí |
| **E3** | Vio producto | día 4-7 | `ViewContent 7d` | X + E1-2 | Prueba social + garantía de adaptación 30 días. **Sin precio escrito a mano** (regla R6) | Sí |
| **E4** | Navegó la web | día 8-14 | `Todos los visitantes 14d` ∪ reglas por URL (`/multifocales`, `/lentes-de-sol`, `/tienda`, `/arma-tus-lentes`) | X + E1-3 | Educativo: por qué un multifocal mal medido marea, qué se mide en el local | **NO hasta arreglar M3** (PageView SPA) |
| **E5** | Interacción social — **el que se lleva el grueso** | día 15-30 | interacción IG 30d ∪ interacción FB 30d ∪ **video 3s 30d de los anuncios fríos** | X + E1-4 | La oferta dura (2x1 en multifocales) | **Sí, y es el único con volumen real** |
| **E6** | Cola larga | día 31-180 | interacción IG/FB 180d ∪ video 3s 180d ∪ visitantes 180d | X + E1-5 | Marca. Presupuesto testimonial ($1.500-2.000/día), frecuencia baja. Se apaga si supera el costo del frío | Sí |
| **E7** | CRM, sin ventana | — | **7a Recompra** (>18 meses desde la última orden) · **7b Segunda gafa** (los 64 clientes con multifocal, 3-9 meses después, mensaje de sol recetado) · **7c Contactos sin compra** (~918 fichas) | No se excluyen con E1-6: **campaña aparte**, presupuesto chico | Recompra / segundo par / reactivación | Sí, con M5 arreglado |
| **E8** | Lookalike (**esto es prospección**) | — | **LAL 1% BASADO EN VALOR** sobre compradores, subiendo el total de cada orden como columna de valor. País Argentina; la geo Córdoba +15 km va en el **conjunto**, no en el público | — | Igual que M1 | Sí, semilla al límite (171) |

**E5 es el escalón clave y el que nadie estaba usando.** Los $3,15M de la campaña fría generaron
1.581.471 impresiones y **416.176 personas alcanzadas**, y nada de eso entró a un público porque el
clic va a WhatsApp. Los públicos de **interacción** (video 3s, IG, FB) no requieren píxel, no
requieren consentimiento de cookies y no los rompe ningún adblocker. **Es el pozo que ya se pagó y
nunca se cobró.**

**Lo que NO se hace:** lookalike del segmento multifocal (64 personas, por debajo del mínimo de 100)
ni lookalike 5% sobre base chica con geo Argentina entera — que es exactamente el error documentado
de la campaña vieja.

**Si el pozo total no llega a 10.000 personas/30d:** colapsar a **DOS conjuntos** (caliente 1-7d,
tibio 8-30d) y nada más. Fragmentar $105.000/mes en seis escalones deja a todos sin señal.

**Prerrequisito de datos, bloqueante para E7 y E8:** de los 848 teléfonos usables del CRM, **637
(75%) están sin código de país** y hay **248 placeholders secuenciales** `12345000XX` (23% de los
teléfonos). Hasheados así no matchean con nadie. Sin arreglar M5, la Customer List sube con una tasa
de coincidencia miserable — y el riesgo real no es que no funcione, es que **la exclusión de
compradores falle en silencio** y se siga pagando por gente que ya compró.

**Verificar en pantalla (no asumir):** si aparece el origen de público **"Cuenta de WhatsApp"** para
el número de la óptica. Si aparece, crear "Conversaciones WhatsApp 90d sin compra" como escalón
**E2-bis** (día 4-14), excluyendo X3. Son **~4.300 conversaciones históricas**: el pozo más grande y
más caliente que tiene el negocio. El bot corre sobre `whatsapp-web.js` (no oficial), así que la
disponibilidad depende de cómo esté vinculado el número en el Business Manager.

### 7.4 Remarketing en Google: no hay

Por lo de §6.5. Lo único disponible con acceso estándar:

| Uso | Cómo | Para qué |
|---|---|---|
| **Exclusión** | Subir tres Customer Lists — "Compradores 2026" (178), "Contactos sin compra" (~918), "Todos" (1.092) — y excluirlas de las campañas de captación | Dejar de pagar por reimpactar a quien ya compró |
| **Observación** | Las mismas listas, en modo observación | Ver si el que ya es cliente busca distinto |
| **Señal de audiencia** | En PMax/Demand Gen — que no se van a usar bajo este plan | — |

**Prohibido por escrito:** armar cualquier lista consultando la tabla `Prescription` o nombrándola
por condición visual ("presbicia", "astigmatismo"). La política de Customer Match prohíbe usar los
datos del cliente para identificar categorías de interés sensibles, y salud es una. **Vender
anteojos no está restringido; segmentar por presbicia sí.** La sanción no es una desaprobación de
anuncio: es perder el acceso a la función, o la cuenta. Nombrar por **comportamiento comercial**:
"Compradores 2026", "Contactos sin compra", "Carrito abandonado".

**Y las audiencias similares (lookalike) no existen en Google desde agosto de 2023.** Cualquier plan
que prometa "lookalike de compradores en Google" está desactualizado.

### 7.5 Consentimiento legal antes de subir la base

Subir 824-1.092 teléfonos y mails de clientes reales a una plataforma extranjera **no es una decisión
técnica**. Dejar por escrito la base legal (Ley 25.326), usar la casilla de atestación de Meta con
criterio y excluir de la exportación a quien haya pedido no ser contactado.

---

## 8. Creatividades

### 8.1 Lo que ya está producido (no hay que producir nada para arrancar)

| Activo | Cantidad | Dónde |
|---|---|---|
| Placas declaradas en JSON | 86 | `social/contenido/` |
| Carpetas renderizadas y servidas | 86 (168 JPEG públicos) | `public/social/` |
| Reels .mp4 hosteados, **todos con voz en off** | 14 (promos 9,00 s · educativos 14,00 s) | `public/social/reels/` |
| Formatos que el render produce | 4 (4:5 1080×1350 · 9:16 1080×1920 · 1:1 1080×1080 · 1.91:1 1200×628) | `scripts/social/identidad.mjs:113-125` |
| Generadores que leen la base | 5 (producto, story-producto, campaña, info, voz) | `scripts/social/` |
| Lote `ad-atp` (4 piezas × 4 tamaños) | 16 JPEG | rama `claude/keen-fermat-12abe7` — **falta mergear** |

**Se puede producir con `scripts/social/`:** placas en los 4 formatos, carruseles de feed, stories
9:16, reels con tres plantillas (genérica con zoom sobre foto, "ojo" con 4 condiciones, "lente" con
5 tipos), voz en off TTS normalizada a -16 LUFS, y piezas de producto con precio traído de la base.

**NO se puede producir con un script, y es el hueco más caro:** cualquier cosa con **una persona
real en movimiento**. Ni UGC, ni try-on, ni antes/después filmado, ni testimonio en cámara. El banco
entero son 59 fotos fijas. Es el formato con mejor evidencia de rendimiento y el único que no sale
de un script.

**Dato oficial de Meta:** un Reels ad en 9:16 **con audio y con los elementos clave dentro de la
zona segura** tuvo **-34,5% de costo por resultado** contra un anuncio con imagen en la ubicación
Reels (meta-análisis de 15 split tests). Contra video no-9:16 sin audio, -15%. Y su guía oficial
recomienda gancho en los primeros 2 segundos, **presencia humana** y **estética lo-fi por encima del
contenido muy producido** — que es, incómodamente, justo lo que este sistema premia menos.

### 8.2 Bloque A — el lote inicial, $0 de producción

Arrancar con **3 anuncios activos por conjunto**, no con los 10 juntos. Los demás quedan de banco de
rotación para cuando la frecuencia pase de 3,5.

| Conjunto | Anuncio | Archivo | Etiqueta |
|---|---|---|---|
| **M1** | Reel 2x1 multifocales | `reels/2x1-multifocales.mp4` | `[meta2x1]` |
| **M1** | Placa armazón puesto (4 tamaños) | `ad-l1-armazon-puesto` | `[metaPuesto]` |
| **M1** | Reel garantía 30 días | `reels/garantia-30-dias.mp4` | `[metaGar30]` |
| M1 (banco) | Reel medición con armazón | `reels/medicion-armazon.mp4` | `[metaMedicion]` |
| M1 (banco) | Placa "cotizá con una foto" | `ad-atp-cotiza-con-una-foto` | `[metaAtpReceta]` |
| **M2** | Placa 6 cuotas (4 tamaños) | `campania-6-cuotas` | `[metaRmk6c]` |
| **M2** | Placa calificación | `ad-l2-calificacion` | `[metaRmkCalif]` |
| **M2** | Placa números que cierran | `ad-l2-numeros-que-cierran` | `[metaRmkPago]` |
| M2 (banco) | Reel 6 cuotas | `reels/6-cuotas.mp4` | `[metaRmk6cV]` |
| Orgánico | Reels de miopía (M3 va a $0 en pauta) | `stellest-frena-miopia.mp4`, `que-es-la-miopia.mp4`, `lente-myofix.mp4` | — |

### 8.3 Bloque B — filmar en una tarde con un celular

| # | Pieza | Duración | Por qué |
|---|---|---|---|
| B-1 | "Mandá la foto de tu receta": manos, receta, celular, presupuesto en pantalla. **La receta entra en el segundo 0** | 12-15 s | El primer mensaje real más frecuente de los chats |
| B-2 | La medición con el armazón puesto: el proceso real | 15 s | Pone en video el claim que hoy solo existe como placa |
| B-3 | "5 armazones en 15 segundos": try-on rápido con cara real, un corte por armazón (línea propia: Adhara, Canopo, Polaris) | 15 s | Presencia humana + producto |
| B-4 | Testimonio de una clienta présbita (40 s crudos → 20 s montados, **con permiso escrito**) | 20 s | Prueba social real |

### 8.4 Reglas de copy — la trampa nº1 de una óptica

**La política de Atributos Personales de Meta prohíbe afirmar o implicar conocimiento de una
condición médica del lector.** "¿No ves de cerca?" o "¿Te marean los multifocales?" es exactamente
el patrón que se rechaza, y la enforcement de 2026 también pesca el encuadre indirecto ("para
personas que…") y la palabra "otros". **Todo se escribe en tercera persona o como enunciado
general.** Un rechazo no solo frena el anuncio: acumula historial negativo en la cuenta, que es el
activo más difícil de recuperar.

**Cuatro cosas que NO se pueden decir, y por qué:**

1. **El 2x1 NO es universal.** 90 de 96 cristales multifocales lo tienen, pero **0 de 7 bifocales,
   0 de 6 de control miópico y 0 de los 4 "Mi Primer Varilux"**. Es, en los hechos, una promo de
   multifocales. Nunca mezclar "tu primer multifocal" con "2x1" en el mismo anuncio.
2. **La garantía de adaptación es de 30 días**, solo multifocales Varilux y monofocales Super Blue,
   y **exige receta nueva del oftalmólogo emitida a menos de 90 días de la anterior**. Nunca "todos
   nuestros cristales tienen garantía".
3. **Obras sociales: REINTEGRO, no convenio.** Decir "trabajamos con OSDE" genera la expectativa
   equivocada y quema la conversación en el mostrador. Ya pasó y se corrigió a propósito.
4. **Nunca un número de estrellas o de reseñas sin verificarlo ese día.** El rating se trae en
   runtime de Google y el propio código tiene una guarda (`claimBackedByRating`) para no afirmarlo
   de más. "Más de 675 reseñas en Google" es factual; "Calificación 5,0" como titular está prohibido
   por el riesgo de acción manual.

Además: **nada de precios ni porcentajes dentro de la imagen** (regla R6 del sistema social) — son
datos que cambian y quedan congelados en un creativo que sigue circulando. Que vivan en la
conversación de WhatsApp.

### 8.5 Los 16 copys, listos para pegar

Cada uno con su etiqueta `[metaXxx]` para que la atribución al CRM funcione desde el día uno.
Botón: **Enviar mensaje** en todos.

---

**A1 · MULTIFOCALES / DOLOR COTIDIANO** — Público: Córdoba +15 km, 42-60, ambos.
> Primero se aleja el celular. Después el menú del restaurante. Y un día el brazo ya no alcanza. Se llama presbicia y le llega a todo el mundo pasados los 40: no es que la vista "se gastó", es que el ojo dejó de enfocar de cerca. Un multifocal bien medido devuelve las tres distancias en un solo anteojo — la calle, la pantalla y el teléfono. Acá la medición la tomamos nosotros en el local y el cristal se talla en nuestro laboratorio. Mandanos la receta por WhatsApp y te armamos el presupuesto.

**Titular:** Un solo anteojo para todo el día · **Descripción:** Medición en el local · Laboratorio propio
**Precargado:** `Hola! Quiero información sobre anteojos multifocales [metaMFDolor]`
**Creativo:** `reels/que-es-la-presbicia.mp4` o `reels/lente-progresiva.mp4`

---

**A2 · MULTIFOCALES / EL PROBLEMA DE LOS DOS ANTEOJOS** — Mismo público que A1.
> Andar con dos anteojos tiene un problema garantizado: siempre tenés puesto el que no necesitás. El de lejos cuando querés leer, el de leer cuando suena el timbre. El multifocal junta lejos, intermedio y cerca en un solo cristal, sin línea y sin salto. La diferencia entre uno que funciona y uno que molesta no es la marca: es la medición. Altura de montaje, distancia interpupilar e inclinación del armazón sobre la cara, tomadas de a un paciente por vez.

**Titular:** Dejá de andar con dos anteojos encima · **Descripción:** Presupuesto por WhatsApp, sin compromiso
**Precargado:** `Hola! Uso dos anteojos y quiero pasarme a multifocales [metaMFDosPares]`
**Creativo:** `reels/medicion-armazon.mp4`

---

**A3 · MULTIFOCALES / EL MIEDO A MAREARSE** — A1 + **obligatorio en remarketing**.
> "A mi cuñada los multifocales la marearon." Lo escuchamos todas las semanas, y casi siempre la historia termina igual: el cristal estaba mal medido. Si la altura de montaje está corrida dos milímetros, el pasillo de visión no queda donde uno mira, y ahí aparecen el mareo y el escalón al bajar la vereda. Por eso la medición la toma Matías Turchi, certificado Essilor Expert, y no un aparato automático. Y si aun así la adaptación no sale, los cristales Varilux tienen garantía de adaptación: dentro de los 30 días los cambiamos sin costo (solo pedimos una receta nueva de tu oftalmólogo).

**Titular:** Si no te adaptás, cambiamos los cristales · **Descripción:** Garantía de adaptación 30 días · Varilux
**Precargado:** `Hola! Tengo dudas con los multifocales, me preocupa no adaptarme [metaGar30]`
**Creativo:** `reels/garantia-30-dias.mp4` · placa `multifocales-marean`
*Predicción: CPA peor que A1 en frío, mucho mejor en remarketing. Medirlo separado, no promediado.*

---

**A4 · PRIMER MULTIFOCAL** — Córdoba +15 km, 42-55. **Este anuncio NO puede mencionar el 2x1.**
> El primer multifocal se piensa mucho, y con razón. Lo que casi nadie cuenta antes de vender: la adaptación depende tanto del diseño del cristal como del armazón elegido. Hay armazones preciosos que directamente no sirven para un progresivo porque son demasiado bajos y el pasillo de visión no entra. Traé la receta y te decimos qué combinación conviene para tu caso — incluso si la respuesta es "todavía no lo necesitás". Preferimos que vuelvas en dos años a venderte hoy algo que no te sirve.

**Titular:** Tu primer multifocal, bien hecho · **Descripción:** Asesoramiento sin apuro en Cerro de las Rosas
**Precargado:** `Hola! Es mi primer multifocal y quiero asesoramiento [metaMF1raVez]`

---

**B1 · 2x1 DIRECTO** — Córdoba +15 km, 42-60.
> 2x1 en cristales: dos anteojos completos, un solo par de cristales pago. La mayoría usa el segundo para lo que le falta — el de cerca para la computadora, o el mismo aumento en versión de sol. No todas las gamas entran en la promo, así que lo honesto es que nos pases la receta y te digamos exactamente cuáles sí y cuáles no antes de que decidas.

**Titular:** Dos anteojos, un par de cristales · **Descripción:** Consultá qué gamas entran en el 2x1
**Precargado:** `Hola! Quiero saber más del 2x1 en multifocales [meta2x1]`
**Creativo:** `reels/2x1-multifocales.mp4` · `campania-2x1-multifocales-*`
*"No todas las gamas entran" no debilita: filtra al que después se enoja en el mostrador.*

---

**B2 · 2x1 / EL SEGUNDO PAR ES DE SOL** — Córdoba +15 km, 42-60; ampliable a 35-65 en temporada.
> El segundo par del 2x1 no tiene por qué ser igual al primero. La jugada que más eligen: el par de todos los días, y el segundo con cristal polarizado para manejar y para el sol, con la misma graduación. Dos anteojos distintos, un solo par de cristales pago. Pasanos la receta y te mostramos las combinaciones posibles.

**Titular:** El segundo par, con tu receta y para el sol · **Descripción:** Polarizado o fotocromático · Consultá gamas
**Precargado:** `Hola! Quiero el 2x1 con el segundo par de sol graduado [meta2x1Sol]`
*Sube el valor percibido sin bajar el precio, y vende cristal Xperio — margen alto, sin consumir el stock corto de armazones de sol.*

---

**B3 · 2x1 / ANTI-URGENCIA FALSA** — Remarketing.
> Sin reloj de cuenta regresiva ni "últimas 24 horas". El 2x1 es cómo trabajamos las gamas premium de multifocales: el segundo par de cristales va bonificado. Lo que sí se mueve son los precios de lista cuando el laboratorio actualiza. Si tenés la receta a mano, pedí el presupuesto ahora y te lo dejamos por escrito con la fecha, para que decidas cuando quieras.

**Titular:** Presupuesto por escrito, sin apuro · **Descripción:** Pedilo hoy, decidí cuando quieras
**Precargado:** `Hola! Quiero un presupuesto por escrito del 2x1 [meta2x1Escrito]`
**Antes de publicar:** confirmar con la dueña que el 2x1 es permanente y no de temporada.

---

**C1 · SOL CON RECETA / MANEJAR** — Córdoba +15 km, 35-65; reforzar en primavera-verano.
> Volver por la ruta a las siete de la tarde con el sol de frente y los anteojos de sol que no tienen tu graduación: se ve oscuro y borroso al mismo tiempo. El cristal polarizado con receta resuelve las dos cosas — corta el reflejo del asfalto y del capot, y encima ves nítido. Se hace sobre cualquiera de nuestros armazones de sol, y también en multifocal.

**Titular:** Anteojos de sol con tu graduación · **Descripción:** Polarizados · También en multifocal
**Precargado:** `Hola! Quiero lentes de sol con mi receta [metaSolRx]`
*Vende el **cristal**, que se fabrica — no depende de las 44 unidades de armazón de sol en stock.*

---

**C2 · SOL CON RECETA / EL ANTEOJO QUE NO USÁS** — Córdoba +15 km, 30-60.
> El anteojo de sol lindo que se usó tres veces y quedó en la guantera casi siempre tiene la misma explicación: no se ve bien con él. Los nuestros se hacen con tu graduación adentro — mismo diseño, tu receta. La colección Atelier tiene Apolo, Eros, Fénix, Mizar y Nashira, entre otros, y también se puede resolver en fotocromático: se oscurece solo al salir a la calle y se aclara adentro.

**Titular:** El de sol que sí vas a usar · **Descripción:** Diseño Atelier · Con tu graduación
**Precargado:** `Hola! Quiero un lente de sol de la colección Atelier con receta [metaSolAtelier]`
*Los modelos nombrados están verificados en catálogo. No agregar nombres sin chequear.*

---

**D1 · OBRAS SOCIALES / LA RESPUESTA HONESTA** — Córdoba +15 km, 35-65+.
> "¿Trabajan con OSDE?" La respuesta honesta es: trabajamos por reintegro. Vos elegís el armazón y el cristal que querés —no los tres que entran en la cartilla— y nosotros te damos la factura oficial con los conceptos exactos que pide tu prepaga para devolverte lo que tu plan cubre. Funciona con OSDE, Swiss Medical, Galeno, Apross y otras. Mandanos una foto de la orden médica y te decimos qué necesitás presentar y cuánto sale antes de que decidas.

**Titular:** Te dejamos la factura lista para el reintegro · **Descripción:** Sistema de reintegro · Elegís lo que querés
**Precargado:** `Hola! Quiero consultar por reintegro de obra social o prepaga [metaOS]`

---

**D2 · OBRAS SOCIALES / NO TE LIMITES A LA CARTILLA** — Córdoba +15 km, 40-65+.
> Con la cobertura directa elegís entre los tres armazones que te muestran y el cristal que le entra al convenio. Con el sistema de reintegro elegís el armazón que te gusta y el cristal que tu receta pide —incluido un multifocal premium— y después recuperás lo que tu plan cubra. Te armamos el presupuesto detallado, con los conceptos escritos como los pide tu prepaga, para que lo consultes antes de decidir.

**Titular:** Elegí vos, no la cartilla · **Descripción:** Presupuesto detallado para tu prepaga
**Precargado:** `Hola! Quiero un presupuesto detallado para presentar en mi prepaga [metaOSCartilla]`

---

**E1 · CERCANÍA / ESTAMOS ACÁ** — Córdoba capital +10 km, 30-65+.
> Estamos en José Luis de Tejeda 4380, Cerro de las Rosas. Lunes a viernes de 8 a 20 y sábados de 9 a 17. Venís con la receta, te probás todo el salón sin que nadie te apure y te vas con el presupuesto por escrito. Si preferís adelantar, arrancamos por WhatsApp y venís solo a probarte.

**Titular:** Tejeda 4380, Cerro de las Rosas · **Descripción:** Lun a vie 8 a 20 · Sáb 9 a 17
**Precargado:** `Hola! Quiero pasar por el local, ¿me confirman horarios? [metaCba]`
*Dirección y horarios salen de `src/lib/business-info.ts` — **no copiarlos de ningún otro lado**. Ya hubo un incidente de horarios copiados a mano que quedaron viejos.*

---

**E2 · CERCANÍA / RETIRO Y LABORATORIO PROPIO** — Córdoba capital +15 km, 30-65+.
> Comprás por WhatsApp y retirás en el local sin cargo, en Cerro de las Rosas. Y si se rompió un armazón o hace falta un monofocal urgente, tenemos laboratorio propio con armado computarizado: hay casos que resolvemos en el día. No mandamos todo afuera a esperar que vuelva.

**Titular:** Laboratorio propio: resolvemos acá · **Descripción:** Retiro sin cargo · Reparaciones en el día
**Precargado:** `Hola! Necesito una reparación / un lente urgente [metaLabExpress]`
*Único ángulo con urgencia genuina: conversación más caliente y ciclo de cierre más corto.*

---

**F1 · CONFIANZA / DÓNDE RECLAMÁS** — Córdoba +15 km, 35-65+; también remarketing.
> Comprar anteojos por internet es facilísimo hasta que algo no encaja: el armazón aprieta, el multifocal no termina de cerrar, la patilla se abrió a los dos meses. Ahí lo que importa es que haya una puerta. La nuestra está en Tejeda 4380 y adentro hay gente con nombre y apellido. Ajustes, revisiones y garantía se resuelven en el mostrador, no llenando un formulario y esperando respuesta.

**Titular:** Acá hay una puerta y una persona · **Descripción:** Ajustes y garantía en el local
**Precargado:** `Hola! Quiero asesorarme en el local antes de comprar [metaLocal]`

---

**F2 · CONFIANZA / LO QUE DICEN LAS RESEÑAS** — Remarketing + frío 40-65.
> No hace falta que nos creas a nosotros: está escrito por los que ya vinieron. Lo que más se repite en las reseñas de Google no es el precio ni la marca — es que nadie los apuró y que nadie les empujó el cristal más caro. Si la receta no justifica un multifocal premium, lo decimos. Preferimos que vuelvas en dos años.

**Titular:** Lo que dicen los que ya vinieron · **Descripción:** Reseñas verificadas en Google
**Precargado:** `Hola! Vi sus reseñas y quiero asesorarme [metaResenas]`
*Va **sin números**: el rating cambia y la propia guarda del código se niega a afirmarlo si no da.*

---

**F3 · CONFIANZA / EL BARATO SALE CARO** — Remarketing, y frío 45-60 como test.
> El multifocal más barato es más barato hasta el día en que no te adaptás: ahí perdiste el par entero y volvés a empezar. Por eso el orden acá es al revés — primero la medición (altura, distancia interpupilar, inclinación, tomadas por un Essilor Expert certificado), después el tallado en nuestro laboratorio, y encima garantía de adaptación de 30 días en los Varilux. Si no te adaptás, cambiamos los cristales sin costo. Y se puede pagar en 3 o 6 cuotas sin interés.

**Titular:** Barato es el que funciona a la primera · **Descripción:** Garantía de adaptación · Cuotas sin interés
**Precargado:** `Hola! Quiero presupuesto de multifocales con garantía de adaptación [metaConfianza]`

---

### 8.6 Cómo se testea

**4 anuncios conviviendo por conjunto, no 16. Rotando por ÁNGULO, no por variación de palabras.**

| Semana | M1 (frío) | M2 (remarketing) |
|---|---|---|
| 1-2 | A1, A3, B1, E2 | — (no existe todavía) |
| 3-4 | se pausa el peor, entra A2 o A4 | F3, F1, B3 |
| 5+ | rotar 1 anuncio cada 14 días | A3 entra acá |

D1/D2 (obras sociales) y C1/C2 (sol) arrancan en Google (C5 y C7), no en Meta: ahí la intención es
explícita y no compiten por el presupuesto de aprendizaje de M1.

**Presupuesto de testeo de creatividades: $0 como línea separada.** Un conjunto de testeo propio
necesitaría sus propios $186.100/mes = 39% del presupuesto de Meta. La alternativa correcta es rotar
**dentro** del conjunto grande, aceptando el reset. Costo cuantificado: un conjunto a 78-141
conversiones/semana re-junta los 50 eventos en 2,5 días ≈ **$34.000-44.000 de entrega subóptima por
rotación**; a 2 rotaciones/mes son ~$68.000-88.000 (14% del presupuesto de Meta). **Ese es el
presupuesto de testeo, solo que no es una línea aparte.** En M2 el mismo reset cuesta semanas y no
se recupera: **ahí no se rota creatividad**.

### 8.7 Arreglos del sistema social (no bloquean la pauta, pero son baratos ahora)

| Qué | Dónde | Por qué |
|---|---|---|
| Hacer que `render-reel.mjs` corra el validador (al menos R6 sobre `guion`, `copy`, `rotulo`, `titulo`, `dato`, `pie`) | `scripts/social/render-reel.mjs:26-35` | **Agujero en R6:** el validador no corre sobre reels. Un reel con precio a mano renderiza y el cron lo publica. Hoy ningún reel tiene precio: el arreglo es barato ahora y caro después |
| Mover la guarda de frescura **arriba** de la bifurcación del cron | `src/app/api/cron/social-feed/route.ts:96-150` vs `:168-192` | La rama que publica un reel retorna **antes** del chequeo de los 10 días: un reel con precio nunca vencería |
| Regenerar las 3 piezas de producto antes de sus fechas | `social/feed-programacion.json` | **8 de 11 fechas de producto hasta el 31/10 van a quedar bloqueadas** por frescura. La primera cae el 22/8 (16 días de antigüedad, límite 10) |
| Mergear la guarda de frescura de stories y regenerar las 12 stories con `generadoEl` | `src/lib/social/frescura.ts` (rama `deploy/bot-recetas`) | En producción sale **una story de producto por día con precio y cuotas adentro, sin fecha de corte** (~30 al mes) |
| Subir el pie de los 3 templates de reel de 380 px a **460 px** y re-renderizar | `reel-plantilla*.mjs:94/123/123` | A 380 px (19,8%) el logo cae dentro del 20% inferior que la UI puede tapar. Las placas ya lo corrigieron (460 px). El -34,5% de Meta exige las **tres** cosas: 9:16, audio **y zona segura** — hoy se cumplen dos |
| `deviceScaleFactor: 1` → `1.333` | `scripts/social/render.mjs:92` | Da 1440×1800 y 1440×2560 sin tocar una regla de CSS. Son las resoluciones que Meta recomienda desde 2026 |
| Agregar subida de video (`/advideos`) a `scripts/ads/subir_creatividades.js` | — | El script solo sube imágenes. Mientras tanto, los reels se cargan a mano |
| Construir `generar-multifocal.mjs` | — | Hoy **no se puede publicar ningún precio de multifocal** en ninguna pieza: R6 lo bloquea y no existe generador que lo lea de la base |

---

## 9. Calendario agosto 2026 → febrero 2027

**El calendario correcto no es estacional: es un motor de multifocales prendido todo el año con
cuatro picos comerciales encima.** El relato clásico de óptica ("los lentes de sol arrancan en
primavera") no aplica: los multifocales son el 62,5% de la facturación y no tienen estación; los
lentes de sol son el 0,5% con **12 SKU** en catálogo — no hay mercadería para sostener una campaña
de verano.

> **Advertencia metodológica:** el CRM tiene 3 meses de datos (18/3 al 18/6/2026), todos de otoño, y
> solo abril y mayo completos. **Ninguna curva estacional de este calendario sale del CRM**: sale
> del calendario comercial argentino y de la mezcla de producto. Revisar con datos propios en marzo.

| Mes | Presupuesto | Foco | Deadline de creatividad | Notas |
|---|---|---|---|---|
| **Ago** (12-31) | **$600.000** | Reactivación. Un solo conjunto de Meta, multifocales, sin promo. Google C1-C4 | **11/8** (no hay que renderizar nada) | Adelantar `ad-l3-stellest-frena` a la ventana **11-17/8**: Día del Niño el **16/8** con finde largo 15-17. Hoy está programada para el 27/9, fuera de ventana |
| **Sep** | **$850.000** | Base always-on + entra M2 remarketing (día 15+). Primavera como excusa creativa para **fotocromáticos y Transitions**, NO para lentes de sol | **14/9** | Los fotocromáticos son cristales, y los cristales son el 77% de la facturación. Piezas ya hechas: `cristales-transitions`, `reels/fotocromaticos-dia.mp4` |
| **Oct** | **$1.000.000** | **Mes pico.** Ventana Día de la Madre **5 al 17/10** (el día es el domingo **18/10**). Promo: **gift card y "regalale la consulta + armazón", NO 2x1** | **28/9** — hay que crearlas **de cero**: no existe ni una pieza de Día de la Madre entre las 87 del repo | Sumar el **Día Mundial de la Visión (jueves 8/10)** como contenido y prensa, sin pauta dura. **Mover el reel de 2x1 que hoy ocupa el 18/10** |
| **Nov** | **$1.000.000** | **Mes pico con DOS eventos:** Cyber Monday **2-4/11** (Cyber Week hasta el 8) y Black Friday **27/11** (Black Week 28-29). 60% del mes a esas dos ventanas. Acá **sí** el 2x1 y las 6 cuotas, con cupón vía `src/lib/coupons.ts` | **26/10** (Cyber) y **20/11** (Black Friday) | **Ojo: el Cyber Monday cae al principio de noviembre.** Planificarlo como "después de Black Friday" es llegar tarde. Creatividades ya renderizadas: `ad-l1-dos-al-precio-de-uno`, `campania-6-cuotas`. 111 productos marcados `is2x1` |
| **Dic** | **$800.000** | Concentrado del **1 al 20**, corte total del 21 al 31. Promo: cuotas sin interés | **25/11** (junto con Black Friday) | La 2ª cuota del aguinaldo vence el **18/12**: poder de compra real. Después del 20 la gente se va y el laboratorio no entrega. **Confirmar con SmartLab sus fechas de cierre antes de fijar el corte** |
| **Ene** | **$350.000** | **Mantenimiento. Un solo conjunto (multifocales), sin promo. NO apagar** | — | Apagar es exactamente lo que pasó este año: los 30 días en $0 borraron el aprendizaje y la audiencia de remarketing. Mantener el hilo prendido hace que febrero arranque con el motor caliente |
| **Feb** | **$1.000.000** | **Mes pico de vuelta al cole**, foco **8 al 25/2**. Control de miopía infantil (Stellest, MyoFix) y anteojos para chicos | **25/1** | Material ya producido: `ad-l3-stellest-frena`, `ad-l3-control-con-mas-aumento`, `reels/lente-stellest`, `lente-myofix`. **Confirmar la fecha de inicio de clases 2027 en Córdoba** cuando la provincia la publique (en 2026 fue el 2/3) — **NO VERIFICADO** |
| **Total 7 meses** | **$5.600.000** | promedio $800.000/mes, siempre bajo el techo | | |

> **Corregido el 10/8 — el calendario choca con el tope diario del §10.7.**
> El techo de $1.000.000/mes se traduce a un tope de **$33.000/día** que el §10.7 declara y el
> §5.3 refuerza con "nunca duplicar de un día para otro". Estas dos filas lo violan:
>
> | Fila | Lo que dice | Ritmo diario que implica | Tope |
> |---|---|---:|---:|
> | Nov | 60% de $1.000.000 en las 6 ventanas de Cyber+Black | **$100.000/día** | $33.000 |
> | Dic | $800.000 del 1 al 20 (20 días) | **$40.000/día** | $33.000 |
>
> Hay que elegir una de dos, y dejarla escrita: **(a)** el tope diario es un promedio mensual y la
> concentración en fechas pico está permitida —entonces reescribir el guardrail 6 del §10.7 para
> que diga eso, porque hoy dice lo contrario—, o **(b)** el tope es duro, y entonces noviembre
> concentra como mucho ~$200.000 en las seis ventanas, no $600.000. Sin esta decisión, quien opere
> en noviembre va a ver saltar la alarma del guardián todos los días y la va a terminar ignorando,
> que es exactamente el modo en que un guardrail deja de servir.
>
> Menor, del mismo tipo: agosto asigna $600.000 a la ventana 12-31/8 (20 días = $30.000/día)
> mientras el §4.1 define el mes 1 como 12/8–11/9 (30 días = $20.000/día). El mismo monto con dos
> ritmos distintos según qué tabla se lea.

**Tarea de calendario, deadline 26/10:** `social/feed-programacion.json` **termina el 31/10** (49
entradas: 14 de agosto, 17 de septiembre, 18 de octubre). Noviembre, diciembre, enero y febrero
están vacíos — justo cuando arranca el mes de mayor inversión. Si el feed orgánico se corta, se paga
tráfico frío hacia una cuenta que dejó de publicar.

---

## 10. Operación

### 10.1 Quién aprieta qué botón

**Estado real de los despertadores** (corregido: los crons de social **sí** están de alta, en
**GitHub Actions**, no en cron-job.org — tres documentos del repo dicen lo contrario y están
desactualizados desde el 6/8):

| Automatismo | Dónde vive | Estado |
|---|---|---|
| `social-story-diaria` 10:00 ART (red 10:40) | `.github/workflows/social-crons.yml` | ✅ De alta |
| `social-feed` 11:00 ART (red 11:40) | idem | ✅ De alta |
| `social-cadencia` 18:00 ART | idem | ✅ De alta |
| `social-regeneracion` viernes 06:00 ART — **commitea y pushea a main** | `.github/workflows/social-regeneracion.yml` | ✅ De alta. **Ojo: dispara un deploy de Railway que nadie pidió a mano** |
| `smartlab-sync` cada 10 min (8-20 ART) · `lab-invoices` diario | `src/instrumentation.ts` | ✅ |
| **`ads-report`** | — | ❌ **Sin despertador. Es el tablero diario y el único consumidor del guardián del techo** |
| **`abandoned-carts`** | `vercel.json` — que Railway **ignora** | ❌ **Nunca corrió** |
| Los otros 15 endpoints de `/api/cron/` | cron-job.org (panel externo) | ❓ **No verificable desde el repo — auditar el panel** |

### 10.2 Rutina diaria — 5 minutos, la dueña

Abrir el mail **"📊 Ads — reporte diario"** y mirar tres cosas **en este orden**:

1. **El bloque del techo.** Si dice "excedido", bajar presupuestos hoy.
2. **El bloque naranja "Para mirar hoy".** Si está vacío, cerrar el mail y seguir con el día.
3. **La columna "Chats" y el "×" de la fila TOTAL.**

**Si un día NO llega el mail, eso ES la alerta:** el cron se cortó. Manda número todos los días a
propósito, para que el silencio se note.

*(Nota: el reporte no manda mail si no hubo actividad en 7 días. Con la pauta arrancando, los
primeros días no va a llegar nada. Disparar el workflow a mano una vez con gasto real para confirmar
que anda, o es imposible distinguir "todavía no gastamos" de "el cron nunca se dio de alta".)*

**Rutina diaria — 2 minutos, quien opere:** mirar la pestaña **Actions** del repo. Si hay un run rojo
de "Social crons", abrir el log (el job falla a propósito cuando el endpoint devuelve `ok:false`) y
reintentar con `workflow_dispatch`.

### 10.3 Rutina semanal — lunes, 30 minutos

**De a uno, nunca dos scripts de ads en paralelo** (el proyecto lo prohíbe):

```
node scripts/ads/meta_report.js --days 7 --level adset   # gasto y resultados por conjunto
node scripts/ads/roas_real.js 30                          # cruce anuncio↔ventas por etiqueta [metaXxx]
node scripts/ads/google_terminos.js --days 7              # términos de búsqueda reales
node scripts/ads/google_negativas.js                      # cargar las negativas nuevas
```

`roas_real.js` es el único que distingue presupuesto de **venta real** (plata cobrada o pedido en
laboratorio). Agregar negativas es la **única escritura permitida todas las semanas**: no reinicia
el aprendizaje (solo lo reinician cambios de puja, objetivo o presupuesto de golpe).

### 10.4 Umbrales de pausa

**Los umbrales del plan previo están mal calibrados y no se disparan nunca:** pausar un conjunto que
gastó $150.000 en 14 días con menos de 10 conversaciones es $15.000 por conversación = **17,5 veces
el costo histórico**. Se puede quemar el millón entero sin que salte una sola regla. Reemplazados por
estos, derivados del histórico real:

| Objeto | Umbral | Acción |
|---|---|---|
| **Anuncio** | Costo por conversación **> $2.600** (3× el histórico) sostenido 7 días, con ≥$30.000 gastados en ese anuncio | Pausar, rotar del banco |
| **Conjunto** | Costo por conversación **> $4.300** (5×) en cualquier momento, con ≥$30.000 gastados | Pausar |
| **Conjunto, regla de los 14 días** | Gastó $60.000 y trajo <15 conversaciones | Pausar |
| **Anuncio** | Frecuencia **> 3,5** en 7 días | Rotar creatividad (el reporte ya lo alerta) |
| **Campaña de Google** | CPA > 2× el de C2 a los 30 días | Pausar |
| **Todo** | ROAS del CRM **< 1×** a 45 días con ≥$500.000 gastados | Frenar y revisar el circuito de atención, no la pauta |
| **Regla de los 45 días** | Renombrar a **60 días** o subir el umbral a **$1.500.000**: gastando $850.000-$1.000.000/mes, "$1.000.000 gastados y cero cierres" se dispara al día **30-33**. Hoy es una regla de 30 días con nombre de 45 | |

**Antes de cada ajuste:** `grep <id> scripts/ads/meta_api.log | tail -3`. Si se tocó hace menos de 4
días, no se toca — salvo la excepción escrita (gasto sin conversiones). **Todo cambio pasa por
`manage.js`** (primero sin `--yes`, que es dry run), nunca a mano en el Ads Manager: hoy el log tiene
255 llamadas y **CERO escrituras**, o sea que todo lo que se tocó se tocó a mano y sin rastro de
cuándo. Sin bitácora, "hace cuánto toqué esto" se contesta de memoria, que es como se rompe el
aprendizaje.

### 10.5 Rutina mensual — primer lunes, 45 minutos

```
node scripts/checks/audit-gasto-meta-30dias.mjs      # gasto real vs techo
node scripts/ads/attribution_report.js --days 30     # atribución del mes
node scripts/ads/verify_token.js                     # scopes y expiración (y --write)
node scripts/ads/google_report.js --days 30          # CPC y CPA reales de Google
```

Un token de Meta vencido hace que el cron devuelva `skipped` **sin error**: el mail seguiría llegando
vacío de datos de ads y nadie lo notaría.

### 10.6 Chequeos de riesgo, viernes, 2 minutos

Tres cosas que son invisibles desde el Ads Manager y que ningún punto del checklist actual tocaría:

1. `curl` a `promo.atelieroptica.com.ar` y a `opticascordoba.com.ar` → esperar **404 o 301**.
2. Search Console → **Acciones manuales en verde**.
3. Estado de cuenta de **WhatsApp Business sin restricciones**.

### 10.7 Suma de presupuestos diarios

**$33.000 ARS/día como máximo** (= $1.000.000/mes). Verificarlo en el Ads Manager antes de activar.
No repartir "a ojo": escribir el reparto (§4.1) y comparar cada lunes contra eso.

> **Corregido el 10/8 — esta advertencia estaba inflada y ya no aplica.** Decía que el ritmo
> histórico suma ~$1.220.250/mes = **122% del techo**, usando **US$225/mes** en la cuenta en
> dólares. El gasto verificado de esa cuenta es **US$511 en 365 días = US$42,6/mes**: el número
> estaba **5,3 veces** por encima. Con datos reales: Google ~$554.000 (promedio `FixedCost`
> abr-may) + Meta ARS ~$363.333 + Meta USD ~$66.900 ≈ **$984.000/mes, o sea 98% del techo**.
>
> Consecuencia: el ritmo histórico **entra** bajo el techo, la alerta no se dispararía el día 3, y
> la rampa de tres meses **pierde esta justificación**. La rampa sigue siendo la decisión correcta,
> pero por el otro motivo, que es el bueno: un conjunto necesita 7-14 días y ~50 conversiones
> semanales para salir de aprendizaje, y abrir tres conjuntos a la vez con el techo puesto reparte
> el presupuesto en pedazos que no aprenden. No por miedo a excederse.

---

## 11. Riesgos y guardrails

| # | Riesgo | Prob. | Daño | Guardrail |
|---|---|---|---|---|
| **R1** | **Baneo del número de WhatsApp.** El bot corre sobre `whatsapp-web.js` (automatización no oficial por QR), no sobre la Cloud API. Meta la cataloga como no autorizada y banea sin apelación. Ese número es el destino del 100% del cierre | **Alta y creciente** | **Catastrófico** — se cae el cierre entero y la pauta de Mensajes apunta al vacío | **No subir el cupo de 25 tareas nuevas/día.** Apagar los envíos salientes masivos de los 5 sistemas de seguimiento mientras se escala la pauta. **Arrancar la migración a la WhatsApp Business Platform en paralelo, no después.** Es el único riesgo de esta lista sin plan B |
| **R2** | **Acción manual de Google Search** por la PBN (`opticascordoba.com.ar` vivo + 14 dominios) | Media-alta | Alto — destruye la 1ª posición orgánica con 5,0/677 reseñas, el mejor canal y el único gratis | **B1 de la §2.1.** Costo $0 |
| **R3** | **`scripts/ads/manage.js` asume pesos y no mira la moneda de la cuenta.** `daily_budget: String(Math.round(amountArs * 100))`. Sobre la cuenta USD, teclear $14.500 setea **US$14.500/día ≈ $22.765.000 ARS/día**: el techo mensual se evapora en menos de una hora. Y el dry-run imprime US$ con signo de peso, así que un presupuesto real de US$12 se lee como "$12" y alguien lo "corrige" para arriba | Media | **Hasta ~$22,7M en un día** | **Prohibir `--daily-budget` sobre `act_2107444353167176` hasta arreglar el script** para que lea `account_currency` o exija el flag `--usd`. Mientras tanto, ese presupuesto se carga **a mano** en Ads Manager. Es un riesgo de una línea de código |
| **R4** | **El techo en pesos es rehén del dólar.** El guardián convierte la cuenta USD con el blue leído en vivo de ambito.com. Con Meta consolidada en USD, un salto de $1.570 a $1.800 hace que el **mismo** gasto se lea 15% más caro y dispare "excedido" sin que nadie toque nada | Media | Medio — falsos excedidos, ~$78.000/mes | **Fijar el presupuesto de Meta en dólares** (US$236 → US$293 → US$318/mes) y avisar en el panel que el guardián convierte con el blue |
| **R5** | **La tasa de cierre del 6,0% es un supuesto derivado, no una medición.** Sale de cruzar fichas del CRM con conversaciones **estimadas** del gasto, con atribución manual por `contactSource` que no distingue Meta pago de Meta orgánico | — | Toda la proyección de retorno cuelga de acá. Si el real es 3%, el retorno base cae de 7,7x a 3,9x (sigue rentable) | **Recalcular con datos propios a los 45 días** y reemplazar el supuesto por el medido |
| **R6** | **Rechazo de anuncios por Atributos Personales.** Copy en segunda persona sobre la visión | Alta si no se cuida | Medio — pero cada rechazo queda en el historial de la cuenta aunque se corrija | **§8.4.** Todo copy en tercera persona o enunciado general. Sumar **R7 y R8 al validador** (`scripts/social/validador.mjs`): R7 = atributos personales y claims de salud; R8 = superlativos sin sustento y promos sin `vigenciaHasta`. **Que fallen el render, no que adviertan** — la única regla que funciona en este proyecto es la que hace imposible el error |
| **R7** | **Meta clasifica el dominio como "Health & Wellness"** y bloquea Purchase/AddToCart y los públicos derivados. El sitio se autodeclara "Óptica especializada en salud visual" | Media-alta (**NO VERIFICADO** contra fuente oficial) | Alto sobre la inversión de medición ya hecha | **Deployar en dos etapas:** primero limpiar la autodescripción (`src/app/layout.tsx:31`) y verificar que ningún `content_name` implique condición; **después** prender Purchase/AddToCart y esperar 7 días mirando si llega el aviso |
| **R8** | **Q4 (mes 3) sube el CPM 30-60%.** El piso de aprendizaje trepa de $186.100 a $241.900-$297.700 por conjunto | Alta | Medio | **Avisar ANTES:** las conversaciones del mes 3 (~549) van a ser **menos** que las del mes 2 (~590) **gastando más plata**. Es estacionalidad, no un fracaso. Y por eso el mes 3 es cuando **menos** hay que partir el conjunto grande en dos |
| **R9** | **Techo de demanda de Córdoba.** 98,7% de las keywords sin gasto en 30 días. Meta ya alcanzó ~416.000 personas con frecuencia 3,8 | Alta | Medio | Los $857 son un **piso histórico, no una promesa**. Si en el mes 3 la impresión perdida en C2 llega a ~0, el excedente va a Meta. Y escalar Meta exige **creatividad nueva**, no más plata |
| **R10** | **El cuello puede ser el mostrador, no la pauta.** 550-590 conversaciones/mes es mucho para el bot y el equipo | Media | Alto | La regla de los 45/60 días: si el circuito conversación → presupuesto → cierre no absorbe el volumen, **se frena la pauta**, no se mueve el reparto. Capacidad histórica: 47 ventas en abril, 38 en mayo |
| **R11** | **Dos sesiones editando la misma carpeta.** Durante las auditorías el árbol cambió solo de `deploy/bot-recetas` a `fix/catalogo-mayorista-privado` a `fix/csp-google-ads`. Hay trabajo untracked (`/multifocales`, `/lib/pricing`) | — | Es el daño más caro de la historia del proyecto | **Commitear ya (B4).** Una sola sesión por carpeta; para paralelo, `git worktree add` |
| **R12** | **Sanción del Colegio de Ópticos.** Falta publicar nombre y matrícula del director técnico (Decreto 2148 de Córdoba, art. 192 y 196), agravado por publicitar recetados con envío nacional | Baja-media (sube si un competidor denuncia) | Medio-alto: toca la **habilitación del local**, no la pauta | Publicarlos en el pie del sitio y en `/nuestro-local` |
| **R13** | **Cuotas sin CFTEA.** "6 cuotas sin interés" está en el `title` del sitio sin precio de contado ni Costo Financiero Total Efectivo Anual | Baja de detección | Bajo-medio (multa de Lealtad Comercial) | Es la infracción **más fácil de constatar** de toda la lista. Agregarlo o dejar de mencionar cuotas en publicidad |

### Guardrails permanentes, escritos para no rediscutirlos

1. **Objetivo Tráfico: $0, permanente.** $732.228 en 365 días → 41 conversaciones. En Mensajes ese
   mismo dinero compraba 854.
2. **Objetivo Ventas / Catálogo / Advantage+ Sales: $0 permanente** mientras el techo sea $1M.
3. **PMax, Maps, Display, concordancia amplia: $0.**
4. **Máximo 2 conjuntos de Meta.** Un tercero no entra bajo este techo (piso US$5/día).
5. **Máximo 3 campañas activas simultáneas en Meta+conjuntos**; el conjunto base de multifocales no
   se apaga en **ningún** mes, enero incluido.
6. **Suma de presupuestos diarios ≤ $33.000 ARS.**
7. **Un ajuste por campaña cada 3-4 días, máximo +15-20%, nunca duplicar.**
8. **Nada se publica sin aprobación:** `publicar.mjs` sin `--facebook`/`--instagram` es dry-run por
   defecto. No relajar eso nunca.
9. **Un solo script de ads por vez.**

---

## 12. Lo que no sabemos

La lista honesta de lo que falta para cerrar el plan, con cómo conseguirlo.

| # | Qué no sabemos | Por qué importa | Cómo se consigue | Cuándo |
|---|---|---|---|---|
| **1** | **Cuánto cierra una conversación de WhatsApp**, de verdad. El 6,0% es derivado, no medido. El 57-78% de los chats no tiene `clientId` y `Client.adTag` está vacío en las 1.096 fichas | Es **el número del que cuelga toda la proyección de retorno y el reparto Meta/Google**. Para que Google empate a Meta necesita cerrar 2,6 veces mejor: es plausible, no es un hecho | Deployar B5 (vínculo chat↔ficha), correr `scripts/maintenance/vincular-chats-huerfanos.mjs` contra producción (primero en simulación), etiquetar todos los anuncios (M1/M2), y medir 45 días | **Día 45** |
| **2** | **¿Meta está gastando hoy o está en $0?** El contexto dice $0; el plan del mismo día dice ~$545.000/mes con 502 conversaciones | Decide si el mes 1 es un **encendido** (7-14 días de aprendizaje) o una **reasignación** (no tocar el mensaje precargado, no rebuildear). Ejecutar el camino equivocado borra el 90% de las conversaciones o duplica el gasto | Abrir el Administrador de anuncios y mirar el gasto de 30 días **a nivel conjunto y anuncio**, no campaña | **Antes de tocar nada** |
| **3** | **Qué porcentaje de visitantes acepta el banner de cookies** | Píxel **y** CAPI están los dos detrás del consentimiento. Si acepta el 50%, el pozo de remarketing web es la mitad del tráfico y el CPM sube en consecuencia. Y Google está pujando sobre una muestra sesgada | Instrumentar `consent_shown` / `consent_decision` (existieron en la base y **no están en el código actual**) y medir 2 semanas | **Antes de dimensionar remarketing** |
| **4** | **El margen real.** Las auditorías dan 43,8%, 55%, 57,5%, 61-63% y 68% según qué ítems se cuenten. **90 de 305 ítems no tienen `productCostSnapshot`** y computan como costo cero; 71 de 73 armazones vendidos no guardaron ni costo ni `productId` | Todo el CPA tolerable y el ROAS de corte cuelgan de acá. Cada $5.000 de error en el costo del armazón mueve su CPA objetivo un 4% | Hacer `productCostSnapshot` **obligatorio** al crear la venta y backfillear lo que se pueda. Re-correr las consultas de margen contra **producción** | **Antes de subir de $600.000** |
| **5** | **Si el laboratorio cobra calibrado en TODA orden** o solo en el cristal bonificado del 2x1 | Si es en todas, faltan **$7.000 a $27.830 de costo por venta** que hoy no se cuentan: un 13% de error en el número que decide cuánto se invierte | Preguntarle al laboratorio. Cruzar `LabCostEntry` y `LabAccountStatement` contra el costo de lista | Mes 1 |
| **6** | **El CPC real de la cuenta de Google.** No existe benchmark público del rubro óptica en Argentina; los de EE.UU. dan cifras absurdas en pesos ($8.509 el CPC promedio) | Los presupuestos de C1-C6 están dimensionados con interpolaciones | `node scripts/ads/google_report.js --days 7`. La cuenta ya tiene 5 meses de datos reales que valen más que todos los benchmarks juntos | **Día 7** |
| **7** | **Si Meta acepta $3.500 ARS/día en la cuenta ARS para M2** | Si lo rechaza por mínimo, hay que ir a un solo conjunto (Opción B: M1 a todo el presupuesto, sin remarketing hasta el mes 2) o sacarle plata a M1 | Cargarlo y ver. No se puede consultar sin llamar a la API | Mes 2, al crear M2 |
| **8** | **Si existe el origen de público "Cuenta de WhatsApp"** para el número de la óptica | Son ~4.300 conversaciones históricas: **el pozo de remarketing más grande y más caliente que tiene el negocio** | Mirarlo en el Administrador de anuncios. Depende de cómo esté vinculado el número en el Business Manager, no del bot | Antes del día 15 |
| **9** | **El gasto histórico acumulado de la cuenta de Google** y el estado de `accepted_customer_data_terms` / `enhanced_conversions_for_leads_enabled` | Deciden si Customer Match sirve para segmentar (umbral USD 50.000) y si el uploader empareja algo | 3 consultas GAQL de solo lectura: `SELECT customer.id, metrics.cost_micros FROM customer` y el `conversion_tracking_setting` | Mes 1 |
| **10** | **Qué crons están efectivamente de alta en cron-job.org** (15 de los 20 endpoints) | Si `backup` está caído desde hace semanas, es el mismo tipo de falla silenciosa que este proyecto ya pagó dos veces — y el de backup es el más caro de descubrir tarde | Abrir el panel y anotar el resultado en un runbook | **Semana 1** |
| **11** | **La fecha de última compra de los 778 clientes históricos** (marcados "Ya es Cliente" / "Sistema Anterior") | Sin esa fecha, el flujo de renovación a 12-18 meses degenera en "mandarle a los 916" — que es **exactamente el patrón que hace que WhatsApp banee el número** (R1). Cada 1% que vuelva son $1.267.984 de margen con $0 de pauta | Un `SELECT` contra producción, con OK explícito de la dueña | Antes de construir renovación |
| **12** | **Si Atelier puede/quiere convenio con APROSS** | Óptica Galileo (Belgrano 53) lo tiene con landing propia: el afiliado paga solo el coseguro. Atelier solo ofrece reintegro. En Córdoba APROSS es la obra social del empleado provincial: es la fuga más grande y la más silenciosa, porque el cliente no discute, se va | Decisión de la dueña + gestión con APROSS | Mes 2-3 |
| **13** | **Si el 2x1 es permanente o de temporada, y qué gamas exactas entran hoy** | El copy B3 ("sin apuro") solo se puede publicar si es permanente. Y 0 de 4 "Mi Primer Varilux", 0 de 7 bifocales y 0 de 6 de control miópico lo tienen | Preguntar y **dejarlo escrito en `docs/`**, no en un chat | **Antes de publicar el bloque B** |
| **14** | **Si el catálogo de sol se repone para el verano 2026-27** | Con 12 SKU no hay campaña de verano posible: se paga tráfico que llega a un catálogo vacío. La alternativa sin comprar nada es correr el verano con fotocromáticos y polarizados | Decisión de la dueña | **Antes de octubre** |
| **15** | **La fecha de inicio de clases 2027 en Córdoba** | El pico de febrero está anclado en el precedente 2026 (2/3/2026). Si 2027 arranca antes, el pico llega tarde | La provincia suele publicarlo a fin de año | Diciembre |
| **16** | **Si el laboratorio (SmartLab) cierra o demora en la última quincena de diciembre** | El corte del 20/12 asume que sí. Si entregan normal, se estaría dejando de vender en un mes con aguinaldo | Preguntar a SmartLab | Noviembre |
| **17** | **Si el token de Meta (`META_ACCESS_TOKEN`) tiene permiso `ads_management` sobre el pixel** para el CAPI | Todo el envío es fire-and-forget con `console.error`: si falla, **no hay alerta, no hay reintento y no hay fila en ninguna tabla**. Se descubre viendo el reporte vacío semanas después | Verificar de punta a punta en **Meta Events Manager → Probar eventos** que llegan ViewContent, AddToCart, InitiateCheckout, Contact y Purchase, con calidad de coincidencia y sin duplicados. Media hora de trabajo contra un mes de pauta a ciegas | **Antes de la primera campaña** |

---

## Apéndice: fuentes de las cifras principales

| Cifra | Valor | Fuente |
|---|---|---|
| Costo por conversación WhatsApp (Meta Mensajes, ARS, 365d) | $857 | $3.158.520 / 3.686 — contexto compartido |
| Margen de contribución por venta | $205.366 (56,3% de lo cobrado) | Fórmula de `src/services/report.service.ts:392` sobre 90 ventas SALE abr-jun, base local |
| Ticket promedio cobrado | $365.011 (lista $427.054) | base local, 90 ventas SALE |
| CPA real histórico Meta / Google (abr+may) | $37.815 / $55.400 por venta | `FixedCost` cruzado con `Client.contactSource` |
| Retorno real de la pauta apagada | Meta 4,7x · Google 4,0x | margen atribuido ÷ gasto, base local |
| Conversión ficha → venta por fuente | Meta 27,8% · Google 27,0% · general 7,8% | base local |
| Costos fijos mensuales | $3.788.416 (mayo) | tabla `FixedCost`, type `FIJO` |
| Equilibrio solo para cubrir fijos | 18,4 ventas/mes (23,3 con $1M de pauta) | $3.788.416 ÷ $205.366 |
| Piso de aprendizaje Meta | $186.100/mes por conjunto | 50 conv/sem × $857 × 4,33 |
| Piso diario Meta por conjunto | US$5,00 | política de Meta 2026 |
| Participación de multifocales | 24,7% de las ventas · 52,5% de la plata | base local, `OrderItem` |
| Compradores en Córdoba capital (351) | 73,6% (131 de 178) | base local, `Client.phone` normalizado |
| Ventas de multifocal en 42-57 años | 71% (15 de 21) | base local, edad inferida por DNI ±3 años |
| Lentes de sol | 0,5% de la facturación · 12 SKU | base local |
| Keywords de Google sin gasto en 30 días | 98,7% de 2.761 | `estrategia-busquedas-locales.md` §6 |
| Reseñas de Google | 5,0 con +677 | `atelieroptica.com.ar/resenas`, 9/8/2026 |
| Dólar de referencia | $1.570 | scripts del repo |

---

*Documento generado el 9/8/2026 a partir de 20 auditorías independientes. Toda cifra sin fuente
explícita está marcada "(supuesto)" o "NO VERIFICADO". Las cifras de la base local salen de una
copia con datos hasta el 18/6/2026: son orden de magnitud, no cifras de cierre contable.*

---

## Apéndice V — Verificación adversarial (10/8/2026)

Este documento pasó por un verificador cuyo único trabajo era refutarlo, cruzando cada cifra
contra la base local, el árbol de git y las lecturas de 365 días de las dos cuentas de Meta.
Las correcciones que **cambian una decisión** ya están aplicadas arriba, en recuadros marcados
"Corregido el 10/8". Acá queda el resto, para que no se pierda.

### V.1 Pendientes de resolver — necesitan una decisión, no una corrección

| # | Qué dice el documento | El problema | Corrección |
|---|---|---|---|
| 1 | §4.5: "Promedio ponderado \| $205.366" | Los pesos de esa tabla suman **90,4%**, no 100%. El promedio ponderado real de esa columna da **$188.691** ($208.729 normalizado). El $205.366 viene de otro lado: 56,3% del ticket de $365.011 | Elegir un solo método y declararlo |
| 2 | §4.4 proyecta con **$200.000/venta**; §1 y §4.5 usan **$205.366** | Dos puntos de equilibrio distintos en el mismo documento | Unificar |
| 3 | §7.3/§7.4 y apéndice: "178 compradores", exclusión global X1 | En la base hay 179 clientes con **alguna orden**, pero solo **86-87 con una venta**. Los 178 son *presupuestados*. X1 se aplica a todos los conjuntos, frío incluido → **sacaría de la prospección a ~92 personas que pidieron presupuesto y nunca compraron**, que son el público más caliente que tiene el negocio, y a los que el propio §7.3-E7c quiere reactivar | Partir X1 en dos listas: compradores (excluir) y presupuestados sin compra (**no** excluir del frío) |
| 4 | §7-E7b: "los 64 clientes con multifocal" | Son ~21-22 **ventas** de multifocal en abr-jun. Mismo error que arriba | Recontar sobre `SALE` |
| 5 | El gasto de Google aparece con **tres** valores: $519.000 (§10.7), ~$636.000 (§4.2+§6) y $554.000 (`FixedCost`, que es la base del CPA de $55.400) | "La PMax se lleva el 56% del gasto de Google" solo funciona con el denominador de $638.766; contra $519.000 sería el **69%** | Reconciliar contra `FixedCost` y usar ese |
| 6 | CPA de remarketing: **$1.328** en §3.1 y §7.1, **$1.871** en §4.2 y §5.2 | $1.328 se deriva de los datos ($518.039 ÷ 390). El $1.871 no tiene fuente, y es el que sostiene "M2 no aprende" y todo el argumento de ABO sobre CBO. Con $1.328 el mismo presupuesto da 79 conv/mes en vez de 56 | Usar $1.328 y rehacer §5.2 |
| 7 | El reparto 62/38 nunca dice lo que cuesta | §4.4 aplica la **misma** tasa de cierre del 6% a Meta y a Google, cuando el supuesto dice que se derivó sobre fichas `contactSource='Meta'`. Con esa tasa, poner todo en Meta daría 115 ventas en 3 meses contra 94: el 38% a Google cuesta **~21 ventas ≈ $4,2M de contribución**. Y es incompatible con §12.1 ("para que Google empate necesita cerrar 2,6 veces mejor: es plausible, no es un hecho") | Poner el número sobre la mesa y defender el 38% por lo que de verdad lo justifica: riesgo de plataforma única + intención tipeada |
| 8 | §5.3: "el piso de US$5/día son $7.850 = **41%** del presupuesto de Meta del mes 1" | $7.850 × 30 = $235.500 contra los $370.000 del mes 1 = **63,6%**. El 41% corresponde al mes 2 | Corregir el porcentaje |

### V.2 Menores, verificados

- §6: "168 JPEG públicos" → en las carpetas de placas hay **154** (los otros 14 son portadas de reels).
- §5.3: "57 veces el presupuesto diario entero de Meta" → es **90x** (mes 1) o **54x** (mes 3).
- Apéndice: "cada 1% que vuelva son $1.267.984" → 1% de 778 × $205.366 = **$1.597.748**.
- §2.3: "el vacío es el `.env` **local**" → la variable **está** cargada en el `.env` local
  (comprobado con `grep -c`, sin imprimirla). Lo de Railway sigue sin verificar.
- §12: "90 de 305 ítems sin `productCostSnapshot`" → en la copia local son **82 de 276**.
- §8: cita `scripts/ads/subir_creatividades.js` sin advertir que **solo existe en
  `claude/keen-fermat-12abe7`**, la misma advertencia de rama que sí le pone al lote ad-atp.
- §4.5: "efectivo paga el 80%… ambos caminos dejan el 80%" → la relación cobrado/lista medida es
  **85,5%** ($365.011 / $427.054), que es la que el propio documento usa dos líneas más abajo.

### V.3 Lo que resistió el ataque

Para no perder tiempo revisando lo que ya está bien: **no hay mezcla de ventanas temporales** en el
CPA — sale de `FixedCost` de abril-mayo cruzado con ventas de abril-mayo, no de los 365 días de la
API. Toda la aritmética de §4.4 (conversaciones, ventas, contribución, retorno, equilibrio) cierra
al peso. Los presupuestos de §4.1 suman exacto y respetan el techo los tres meses. El §7.1 —por qué
el remarketing salió 1,55x más caro— reproduce perfecto desde los datos crudos, contrafáctico
incluido. Los costos fijos de mayo, el ticket de lista, los 111 productos `is2x1`, los 248
placeholders telefónicos, los 12 SKU de sol, las 49 entradas del feed y las **14 fechas del
calendario** (Día del Niño, Día de la Madre, Black Friday, vencimiento del SAC) están todas
verificadas y correctas. De ~35 rutas de archivo y número de línea citadas, **todas existen y dicen
lo que el documento dice que dicen**.

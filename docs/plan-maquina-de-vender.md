# Plan: la tienda como máquina de vender

**Fecha:** 9/8/2026 · **Estado:** PROPUESTA — nada se ejecuta, publica, activa ni deploya sin OK explícito de la dueña. Toda escritura en Meta/Google vía `scripts/ads/manage.js` con doble confirmación (`scripts/ads/CLAUDE.md`); campañas se crean EN PAUSA.

**Fuentes:** backlog priorizado de 13 auditorías (9/8) + 5 planes (Meta, Google, placas, funnel/ofertas, retención/CRM), deduplicados y con contradicciones resueltas (ver §4, notas de unificación).

**Salvedad transversal:** la base local está ~7 semanas atrás de producción (última Order 18/6, Product 22/7). Todo número fino de precio/stock/cohortes se re-verifica contra producción (SOLO SELECT, con autorización previa) antes de imprimirse en landing, placa o anuncio. La regla R6 del sistema de placas (precios solo generados desde la base) se extiende a landings y extensiones de Ads.

---

## 1. Diagnóstico en una página

**El negocio real es el multifocal** (ticket promedio $831.243–$834.000, cierre por WhatsApp/local) **y la tienda hoy lo esconde y lo mide mal.** La plomería transaccional es sólida (idempotencia, anti doble cobro, stock atómico, guard de precio server-side — no tocar); el problema está en cuatro capas:

1. **La primera pantalla mobile no convierte.** El banner de cookies (`CookieConsent.tsx:64`) tapa los DOS CTAs del hero en 375x812 — el 100% del tráfico pago mobile aterriza sin acción visible. El carrusel del hero además rota a pantalla negra. Y el mismo banner apaga TODA la medición (Pixel/GA/Ads no cargan sin clic en "Aceptar"): hoy rompe conversión y medición a la vez.
2. **El producto de $834k es invisible.** El hero habla de pinturas, "multifocales" recién aparece en el 6º bloque, el nav dice "Cristales", `/multifocales` da 404, no hay NINGUNA pieza social con precio de multifocal, y el 2x1 Smart FREE ($646.250, ya codeado en `PricingService.ts:67-78`, único `botRecommended`) no se comunica en ningún lado. Mientras tanto Galileo ancla la categoría en $120.000 a 15 minutos. Todas las fichas contradicen "En Stock" con una nota "⏳ PREVENTA ~1 semana". El configurador tiene un dropzone de receta **fake** (guarda solo el nombre del archivo, descarta los bytes — `LensConfigurator.tsx:548,567`).
3. **La pauta actual compra humo y decide a ciegas.** Medido el 9/8 (§4.1): se gastan **~$1.181.000/mes** entre las dos plataformas, y **$519.000 de eso (44%) va a cuatro campañas que no producen conversaciones** — la PMax "al local" ($357.709/mes por 550 clics de dirección fabricados), Maps ($129.569, que el plan daba por pausada y sigue gastando), la de Tráfico en Instagram ($133.450 por 8 chats a $16.681) y PMax Ventas. Mientras tanto `Search Óptica`, la mejor de Google a $1.011/conv, **pierde 47% de sus impresiones por presupuesto**. Y la cuenta le enseña a Google a comprar ese humo: **5 acciones locales** (Indicaciones de Maps, Local actions Directions / Website visits / Other engagements, suscripciones de YouTube) están marcadas como **PRIMARIAS**, y `Tiendanube Website purchases` sigue ENABLED y PRIMARIA pujando por una conversión que ya no puede ocurrir (verificado 9/8 con `scripts/checks/conversiones-google.mjs`). El purchase server-side solo corre en la rama TARJETA (transferencia con 15% OFF — probablemente la porción mayor — es invisible); el 57% de los chats etiquetados no tiene `clientId`, así que el ROAS 0,48x de Meta no distingue "no cierran" de "no se atribuyen".
4. **La retención no existe pese a estar construida.** El cron de carritos abandonados jamás corrió (schedule en `vercel.json`, deploy en Railway); el pedido de reseñas es 100% manual (0 ProductReview persistidas, 675+ reseñas reales sin usar en feed ni fichas); no hay ningún mecanismo de renovación de receta — la recompra obligada cada 1-2 años del multifocal — a pesar de que el pipeline anti-ban de WhatsApp (5 sistemas de followup) está probado y solo hay que extenderlo.

Refuerzos: fotos 73/106 con una sola toma y cero sobre rostro; feed social 49% educación / 5% acción / 0 testimonios; 111 productos publicados con 0 ventas atribuidas (mostrador vende contra SKUs genéricos); TTFB 0,8-0,95s sin CDN y con ISR roto en las páginas de venta; riesgos de acción manual de Google activos (aggregateRating self-serving 5.0/677 + 46 doorways indexables).

**Tesis del plan:** antes de escalar inversión, destapar la conversión (semana 1), arreglar la medición (semanas 1-2), reconstruir la pauta sobre señal real (semanas 1-4) y encender la base instalada (semanas 1-4). El mayor ROI del documento no es pauta: es el cron de renovación de receta — reactivar base propia a costo cero de ads.

---

## 2. Arreglar antes de invertir (bloqueantes de medición/conversión)

Nada requiere rediseño: configuraciones y parches. Sin esto la pauta optimiza a ciegas o hacia lo equivocado.

| # | Bloqueante | Evidencia | Esf. | Bloquea |
|---|---|---|---|---|
| B1 | Banner cookies tapa los 2 CTAs del hero mobile | `CookieConsent.tsx:64` vs `FilmmakerReel.tsx:179-242` | S | Todo clic pago — arreglar antes del primer peso |
| B2 | ~~Cargar `GOOGLE_ADS_CONVERSION_LABEL`~~ → **NO cargarla.** Higienizar las acciones de conversión: pasar a secundarias las 5 locales y la de Tiendanube (nunca borrarlas) | `scripts/checks/conversiones-google.mjs` (9/8): `Atelier Optica - Web (web) purchase` **ya existe, importada de GA4 y PRIMARIA** → Google sí recibe compras. Cargar además la etiqueta de sitio web contaría la MISMA venta dos veces | S | Que la puja deje de perseguir clics de dirección. La compra queda como observación — jamás optimizar a compra web |
| B3 | Purchase server-side en las 3 ramas (hoy solo TARJETA) | `payway/route.ts:1057-1086`; transferencia/mayorista invisibles; cliente usa UUID random como transaction_id (`CheckoutClient.tsx:351` → usar `data.orderId`) | S-M | ROAS de compras; M4 |
| B4 | Consent Mode v2 (hoy todo apagado si se ignora el banner) | `TrackingScripts.tsx:75`; espejo CAPI exige cookie (`api/web/track/route.ts:55`) | M | Públicos del píxel (M2), puja por conversiones de Google. Trackear la decisión del banner para dimensionar pérdida |
| B5 | Vincular chat→cliente (57% de chats etiquetados sin clientId) + backfill | memoria 3/8; `ads-report/route.ts:164-254` cruza por clientId | M | TODAS las reglas de corte por ROAS. Sin esto, interinamente se corta solo por costo/conversación |
| B6 | Landing `/multifocales` (hoy 404) | Bloqueante declarado 8/8; base ya existe: campaña `multifocales` en `src/lib/landing/campaigns.ts:213` servida por `/promo` — **promover/clonar, no crear de cero**. Ancla "completo desde $X" por gama vía PricingService | M | RSA de C1; el head term del producto de $834k hoy aterriza en la home genérica |
| B7 | Quitar aggregateRating self-serving 5.0/677 | `src/lib/schema.ts:44-54`, vivo en 4 páginas; P0 del 8/8 sin deployar | S | Riesgo de acción manual que tumba TODO rich result |
| B8 | 301 de las 46 doorways `/blog/busquedas/` + sacarlas del sitemap en el MISMO commit | `sitemap.ts:187-192` (priority 0.8); lección del 18/7 en `sitemap.ts:127-131` | S-M | Canal orgánico local que ya gana |
| B9 | Conversiones offline a Google Ads (código inerte) | `google-ads.service.ts:178-189` sin `GOOGLE_ADS_UPLOAD_CONVERSIONS` + ACTION; caller no pasa `gclid` (está en `AnalyticsEvent.meta`). Primera corrida `VALIDATE_ONLY=1`; si el allowlist no pasa, Data Manager API | M | Que Google vea que sus clics terminan en ventas de cientos de miles |
| B10 | Alta en Merchant Center (feed ya operativo) | `/api/web/feed/google` responde 200; `robots.txt` `Disallow: /api/` puede romper la fetch → exponer `/feeds/google.xml` con rewrite. Prerequisito: QW2 (PREVENTA) | S | Free listings gratis; Shopping futuro |
| B11 | UTMs en todo link del pipeline social | grep 'utm' en `scripts/social/` = 0 | S | Distinguir orgánico de pago |
| B12 | Alta confirmada de crons: `ads-report` (9:45), `social-feed`, `social-story-diaria`, `social-cadencia`, `abandoned-carts`, y verificar `pickup-reminder`/`overdue-balances` | docs los marcan sin alta; deploy Railway no ejecuta `vercel.json` | S | El tablero diario de la dueña, el calendario de placas y el flujo 1 de retención |
| B13 | 301 de `promo.atelieroptica.com.ar` al dominio principal | HTTP 200, sin noindex, promos no verificables (2x1, 15% OFF) en la SERP de marca | S | Riesgo de práctica engañosa con anuncios activos |
| B14 | Desindexar CRM railway.app de la SERP de marca | ya tiene noindex+canonical; acelerar con Search Console removal o 301/410 por Host | S | Higiene de marca |
| B15 | Dueña cierra la pregunta obras sociales (¿convenios activos?) | la página `src/app/obras-sociales/page.tsx` EXISTE y está bien resuelta; solo la linkea el footer de /faq y /tienda | — | Sitelink + grupo de keywords vs negativas; placa `obras-sociales` |

**Regla operativa de arranque:** M1 (Meta multifocales) puede prender con solo tres cosas: método de pago ARS activo + etiquetas asignadas + cron `ads-report` dado de alta (click-to-WhatsApp no depende del píxel). M2 no prende su fuente web hasta que Consent Mode esté en producción (arranca solo con fuentes de interacción). Google no reconstruye C1 hasta que `/multifocales` exista.

---

## 3. Quick wins de conversión (esfuerzo S/M/L)

Ordenados por impacto/esfuerzo. Los S se agrupan en 2-3 lotes de deploy.

**Lote 1 — la primera pantalla (S, semana 1):**
1. **Destapar CTAs mobile** (=B1): banner a franja de 1 línea o CTAs a bottom-25% en <768px. Criterio de aceptación: en 375x812 "Hablar con un Asesor" visible sin scroll con banner abierto. Hipótesis: +10-20% CTR de hero mobile.
2. **Matar "⏳ PREVENTA ~1 semana"** en 4/4 fichas vivas: vive en las descripciones de producción (WebProduct), no en código ni DB local. Auditar el campo, limpiar donde hay stock; si algo es preventa real, que reemplace el badge Y el availability del JSON-LD (`producto/[slug]/page.tsx:332,353`). También evita desaprobaciones en Merchant Center.
3. **Multifocal arriba**: línea fija visible en el hero — "Multifocales Varilux — garantía de adaptación 30 días — presupuesto por WhatsApp" — + item de nav "Multifocales" → `/multifocales` (interim `/cristales-opticos`, que ya convierte a WhatsApp). Hoy: hero de pinturas (`FilmmakerReel.tsx:9-50`), h1 comercial sr-only (`page.tsx:138`), nav "Cristales / Lentes a Medida" (`StorefrontNavbar.tsx:168-196,230-234`).
4. **Carrusel del hero a pantalla NEGRA en mobile** (`FilmmakerReel.tsx:119-129`): condicionar `setCurrent` al onLoad del precargado o AnimatePresence `mode='sync'`.
5. **og:image AVIF → WebP** (`producto/[slug]/page.tsx:~171-190`): los links de fichas compartidos por WhatsApp — el canal de cierre — salen SIN foto. La copia .webp ya existe pública; fix de una línea.
6. **FloatingWhatsApp**: delay 5s→1,5s en mobile + mini-etiqueta "Presupuesto" visible (`FloatingWhatsApp.tsx:22-25,84`).

**Lote 2 — checkout y confianza (S, semanas 1-2):**
7. **Microcopy del checkout** (un solo lote): botón muestra "en 6 cuotas" aunque se eligió 1 o 3 (`CheckoutPaymentOptions.tsx:10-13,158` — parsea texto promocional, no `formData.installments`) → mostrar **valor por cuota en pesos** ("6 x $107.708"); sacar la urgencia falsa "¡Solo por esta semana: Envío Sin Cargo!" hardcodeada desde el 17/6 (`CheckoutShippingForm.tsx:53-55,86-88`); pantalla de éxito por transferencia SIN monto ni nº de pedido (`CheckoutClient.tsx:533-555`) → monto con 15% aplicado + alias/monto copiables + monto en el wa.me; DNI obligatorio para todos (`CheckoutContactForm.tsx:44-56`) → solo en rama tarjeta.
8. **Receta fake — fix mínimo**: quitar el dropzone (`LensConfigurator.tsx:548,567`) y reemplazar por botón "Enviá tu receta por WhatsApp" con wa.me precargado con nº de orden/carrito. (Versión completa M — upload real + URL en la orden + adjunto al email admin — queda para estructural.) Mete al comprador en el canal donde se cierra el 100% de las ventas altas.
9. **Lote confianza**: helper único de garantía (texto canónico en §Anexo D.3) expandido en ficha y configurador; nombre+foto+**matrícula del director técnico** en Quiénes somos (obligatorio en ópticas argentinas; "Matías" ya aparece en reseñas); link "Obras Sociales" al `StorefrontFooter` principal + mención en pilares de la home.
10. **2x1 y cuotas visibles en ficha**: badge "2º armazón bonificado" cuando `is2x1`; "6 cuotas de $X" junto al precio; línea "este armazón se hace de sol con tu receta".
11. **Cross-sell por afinidad** (`producto/[slug]/page.tsx:265-277`): query por shape/material/gender en vez de top-4 featured (hoy frida-c2, acetato femenino, recomienda titanio masculino). Arreglar el 404 de febo-c1 (la única oferta).

**Lote 3 — performance e higiene (S-M):**
12. **Cloudflare CDN** (S): checklist completa ya escrita en `docs/LANZAMIENTO-CLOUDFLARE.md`, cero código. DNS hoy directo a Railway (edge Montreal): hasta un cache HIT paga 0,76-0,84s. Proxy naranja + SSL Full (strict) + Cache Rules. ~800ms menos por clic pago.
13. **GBP: sacar el eslogan del nombre** ("ATELIER ÓPTICA CORDOBA - Tus Proximos Anteojos!" viola guías; riesgo de suspensión del activo 5,0/677). **Timing:** fuera de la ventana de 21 días del experimento de Maps.
14. **Title de la home sin "Córdoba"** — una línea en `src/app/layout.tsx`.
15. **Aplicar el lote de fichas ya redactadas** (M): 114 fichas auditadas en `scripts/maintenance/catalogo-optimizado/` sin aplicar; 26 sin seoTitle, 12 sin seoDescription; reactivar 5 productos con `publishToWeb=true` sin WebProduct activo (Venus C1/C2/C2-1, Selene C4/C5 — ~5% del catálogo perdido en silencio).

**Estructurales (M-L, semanas 3-8 — detalle de dependencias en Anexo D y roadmap §9):** ISR de páginas de venta (causas: `cookies()` en `tienda/page.tsx:14-24`, searchParams en /lentes-de-sol y /receta — sin esto el CDN solo cachea estáticos); reconversión de 140 AVIF 4.680px a WebP ≤1600px (passthrough verificado byte a byte; sharp ya está) + sacar `priority` de los 5 thumbs del HomeProductCarousel; **fotos** (73/106 una sola toma, cero sobre rostro — mínimo 3 tomas + 1 en rostro; priorizar 17 de Sol a $200k, 27 isFeatured, los que reciben view_content); Mercado Pago Checkout Pro + Naranja visible + evaluar 9/12 cuotas solo multifocales (whitelist hoy [1,3,6] en `payway/route.ts:838`); turnos online ("Reservá tu medición en Cerro de las Rosas" — Calendly/form→CRM); atar ventas de mostrador al Product real (los genéricos "Atelier" 46u / "acetato" 36u vuelven imposible saber qué modelo vende); escalera de precios + 3-5 salePrice rotativos (94 productos a $160k, 16 a $200k, una sola oferta y su ficha da 404); sol con receta (banner + cargar frameHeight de ~92 productos → badge "Apto multifocal" ≥28mm + filtro); tracking post-pago (trackingNumber + aviso de despacho; hoy hasta 2 semanas de silencio post-cobro).

---

## 4. Inversión propuesta — techo: lo que ya se gasta

**Restricción fijada por la dueña (9/8/2026):** *no superar el promedio que se viene gastando; si se puede, reubicar presupuestos.* Todo este capítulo se reescribió contra esa restricción. **El escenario "mínimo" de $1.260.000 que proponía la síntesis original queda DEROGADO** por dos motivos: superaba el gasto actual, y estaba dimensionado con benchmarks genéricos de Argentina ($1.000-2.000 por conversación) en lugar del costo medido de esta cuenta.

### 4.1 Gasto real medido (últimos 30 días, 10/7→9/8, leído hoy con `scripts/ads/meta_report.js` y `google_report.js`)

| Campaña | Gasto/mes ARS | Resultados | Costo unitario | Veredicto |
|---|---|---|---|---|
| Meta USD `Mensajes ✉️` | ~$350.110 (US$223) | **454 conversaciones WA** | **~$771** | 🟢 **el motor de toda la operación** |
| Google `Search - Optica` | $52.586 | 52 conv · valor $4.036 | $1.011 | 🟢 la mejor de Google |
| Google `Search - Multifocales` | $31.116 | 26 conv | $1.197 | 🟢 sana en el panel (ver corrección 3) |
| Google `Search - Recetados` | $36.617 | 30 conv · valor $2.271 | $1.221 | 🟢 |
| Meta ARS `✉️ Mensajes` | $44.408 | 31 conversaciones WA | $1.432 | 🟢 |
| Meta ARS `Remarketing` | $16.842 | 9 conversaciones WA | $1.871 | 🟡 caro pero es cierre |
| Google `Google Maps` | $129.569 | 47 conv | $2.757 | 🔴 el plan la daba por pausada: **sigue gastando** |
| Google `PMax Ventas` | $28.630 | 5 conv | $5.726 | 🔴 |
| Meta USD `Tráfico en Instagram` | ~$133.450 (US$85) | 8 conversaciones WA | **~$16.681** | 🔴🔴 objetivo tráfico = clics que no compran |
| Google `Máximo rendimiento al local` | **$357.709** | 550 conv a $650 · **valor total declarado $550** | — | 🔴🔴 **56% del gasto de Google**: son los clics de dirección fabricados |
| **TOTAL** | **~$1.181.000/mes** | | | **← este es el techo** |

*Conversión de la cuenta USD a $1.570/USD (misma tasa que la auditoría del 6/8). Montos NETOS, igual que la comparación: el costo real suma IVA 21% + percepciones en ambas columnas, así que la comparación se sostiene.*

### 4.2 Tres correcciones que obligó la medición (derogan partes del plan)

1. **Meta NO está en $0.** La auditoría previa (`plan-campanias-meta-google.md`: "el gasto de los últimos 30 días es $0 en ambas cuentas, auditado 8/7→6/8") era un **falso negativo**. Meta gasta ~$545.000/mes y produce **502 conversaciones**. Es el patrón exacto de [verificar antes de afirmar]: leer la campaña y no el conjunto/anuncio.
2. **NO pausar la cuenta USD** (§5 y la aprobación nº2 quedan corregidas). Ahí vive `Mensajes ✉️` con **454 de las 502 conversaciones a ~$771** — la más barata de toda la operación, 46% más barata que su gemela en ARS. La regla "una sola cuenta, la de ARS" nació de creer que ambas estaban en cero; ejecutarla habría borrado el 90% de las conversaciones de Meta. Lo que se pausa de esa cuenta es **solo** la campaña de Tráfico.
3. **`Search - Multifocales` no quema $29.425/chat** en el panel de Google: registra 26 conversiones a $1.197. Las dos cifras pueden convivir (Google cuenta acciones locales; el CRM cuenta chats con `clientId`, y el 57% no lo tiene — bloqueante B5). Deja de ser la emergencia del plan: se reconstruye igual (concordancia amplia, keywords zombies), pero **sin apurar el corte** hasta que B5 permita distinguir "no cierra" de "no se atribuye".

### 4.3 La reasignación (mes 1): mismo techo, ~24% menos de gasto

Ni un peso nuevo. Se apaga lo que compra humo y se alimenta lo que ya produce conversaciones baratas.

| Campaña | Hoy | Mes 1 | Δ | Por qué |
|---|---|---|---|---|
| Meta USD `Mensajes` | ~$350.110 | **$410.000** | +17% | El motor a $771/chat. Se escala al máximo que permite la regla (+15-20% por paso) |
| Meta ARS `Mensajes` (→ M1 multifocales) | $44.408 | **$52.000** | +17% | $1.432/chat |
| Meta ARS `Remarketing` (→ M2) | $16.842 | **$20.000** | +19% | Cierre del tibio |
| Meta USD `Tráfico en Instagram` | ~$133.450 | **$0** | −100% | 8 chats a $16.681 |
| **Meta total** | **~$544.810** | **$482.000** | **−11%** | |
| Google `Search Óptica` (→ C2) | $52.586 | **$150.000** | +185% | $1.011/conv y **pierde 47% de impresiones por presupuesto**: acá va la primera plata liberada |
| Google `Search Recetados` (→ C3) | $36.617 | **$105.000** | +187% | $1.221/conv |
| Google `Search Multifocales` (→ C1) | $31.116 | **$75.000** | +141% | El producto de $834k, reconstruido a exactas + landing viva |
| Google `Marca + Cerro` (C4, nueva) | $0 | **$30.000** | nueva | Defensa del pin y de "atelier" tras pausar Maps |
| Google `PMax al local` | $357.709 | **$60.000** | −83% | Cuarentena con espada quincenal (>$8.000/chat real → pausa) |
| Google `PMax Ventas` | $28.630 | **$0** | −100% | 5 conv a $5.726 |
| Google `Maps` | $129.569 | **$0** | −100% | $2.757/conv. Respetando la ventana de 21 días del experimento y su gatillo de reversión |
| **Google total** | **$636.227** | **$420.000** | **−34%** | Coincide con el presupuesto firmado el 8/8 |
| **TOTAL** | **~$1.181.000** | **~$902.000** | **−24%** | |

**Headroom disponible: ~$279.000/mes dentro del techo ya aprobado.** No se toca en el mes 1. Se libera de a un paso (+15-20% por vez, máximo un ajuste por campaña cada 3-4 días) y **solo** cuando el `ads-report` muestre cierres reales en la fila TOTAL. Es decir: el plan tiene margen para crecer 31% sin pedir un peso más.

**Reglas de dimensionamiento:** CPC/CPM reciente, nunca la mediana anual (subió 6x en 12 meses). **Q4 (oct-dic): +30-60% de CPM estacional** — con techo fijo eso significa *menos volumen por el mismo peso*, no más presupuesto; decisión en octubre. Escalado siempre +15-20% por vez; **JAMÁS duplicar** (el historial de la cuenta son 8 conjuntos "Copia" compitiendo entre sí). Riesgo nº1 en Google: techo de demanda de Córdoba (98,7% de keywords sin gasto en 30 días) — más plata sobre el techo compra ranking, no clientes. Rebalanceo mensual entre plataformas: mover 10-15%/mes según $/venta atribuida, con piso Google Search $250k/mes.

### 4.4 KPIs y reglas de corte (se ejecutan sin discusión, ambas plataformas)

Los 3 números diarios de la dueña (email "📊 Ads — reporte diario", cron `ads-report` 9:45): gasto de ayer / chats por anuncio / multiplicador "×" de la fila TOTAL (venta real CRM por peso de pauta).

| Regla | Umbral | Acción |
|---|---|---|
| Costo por conversación (anuncio) | ≤$1.000 bueno · >$2.000 sostenido 7 días | Apagar ESE anuncio (no la campaña), rotar creativo del registro |
| Regla de los 14 días (conjunto/grupo) | Meta: >$100.000 con costo/conv >$2.000 o <30 conversaciones · Google: >$150.000 con <10 conversaciones | Pausar; cambiar creatividad o público antes de re-prender. No se clona, no se le "da una semana más" |
| ROAS CRM (campaña, a 30 días) | <1× sostenido = pierde plata · ≥2× = sigue · ≥3× = escalar +15-20% | SIEMPRE con venta real del CRM (Payment/labStatus), nunca el panel de la plataforma — el multifocal cierra offline y la plataforma subestima siempre |
| Regla de los 45 días (global) | $1.000.000+ gastados y CERO cierres en la fila TOTAL | Frenar todo; el problema es el circuito conversación→presupuesto→cierre, no la pauta |
| Frecuencia prospección / remarketing | >3,5 / >5 en 7 días | Rotar creativo del pool de reserva / ampliar ventana a 45-60 días o bajar presupuesto |
| CVR conversación→venta | benchmark 7-14% a 30 días | <7% sostenido con volumen = problema de bot/asesor/precio — NO tocar pauta |
| Chats sin `clientId` (~57%) | mientras siga | Las reglas de ROAS NO son ejecutables; interinamente cortar solo por costo/conversación + presupuestos (QUOTE) generados |

**Optimización, regla de hierro:** SIEMPRE por conversación de WhatsApp iniciada, JAMÁS por compra (compra daría <5 eventos/semana → Learning Limited permanente). Compra web queda como conversión secundaria de observación. Nota: con conversaciones a $771-1.871, los presupuestos propuestos producen **de sobra** las ~50 conversiones/semana que el algoritmo necesita — el miedo a Learning Limited que inflaba el presupuesto original no aplica a esta cuenta.

Con ~502 conversaciones/mes hoy y la reasignación apuntada a las campañas baratas, la banda esperable es **600-900 conversaciones/mes por $279.000 menos**. El número que manda es la tabla ROAS del CRM, no esta cuenta de servilleta.

---

## 5. Campañas Meta (resumen — detalle completo en Anexo A)

**Corregido el 9/8 con datos medidos (§4.2):** las DOS cuentas siguen operativas. `act_2107444353167176` (USD) aloja `Mensajes ✉️`, la campaña más barata de toda la operación (454 conversaciones a ~$771) — **no se pausa**; se le sube el presupuesto y se le aplica el etiquetado. De esa cuenta se pausa **solo** `Campaña de Tráfico en Instagram` (8 chats a $16.681). `act_901723834933651` (ARS) aloja M1/M2 tal como se describen abajo. La contrapartida de operar en dos cuentas (datos partidos, gasto USD convertido a blue en los reportes) se acepta a cambio de no destruir el motor: se resuelve leyendo el `ads-report`, que cruza por etiqueta y no por cuenta. Comunes: ubicaciones Advantage+ sin Audience Network; ABO (un conjunto por campaña, sin excepción); optimización "conversaciones iniciadas"; entrega 24/7 (el bot atiende); etiqueta `[metaXxx]` única en nombre del anuncio Y mensaje precargado (sin eso el anuncio es invisible para `meta-insights.ts:59` / `ads-report`).

- **M1 `[MF] Mensajes WhatsApp | Multifocales`** (75-80% del presupuesto Meta): Córdoba capital +15 km · 40-65+ · Advantage+ con edad como único filtro duro. 4 anuncios: `[meta2x1]` (reel 2x1), `[meta2x1Img]` (placa ad-l1-dos-al-precio-de-uno), `[metaPuesto]` (ad-l1-armazon-puesto — claim de proceso, pasa policy), `[metaGar30]` (garantía 30 días). Sin precios (R6); rotación futura: `[metaDesde]` cuando exista `generar-multifocal.mjs`.
- **M2 `[RMK] Remarketing`** (15-20%): conjunto ÚNICO combinado (web 30d + interacción IG/FB 30d + viewers ≥50% reels), exclusión conversaciones últimos 30d. Si Consent Mode no está en prod, arranca SOLO con fuentes de interacción. Anuncios de cierre: `[metaRmk6c]` (6 cuotas sin monto mínimo — ventaja real vs Más Visión que exige $400k), `[metaRmkPago]`, `[metaRmkCalif]` (solo el número de reseñas), rotación `[metaRmkSiguen]`/`[metaRmkBusca]`; refuerzo futuro `[metaRmkTest]` (testimonio) y `obras-sociales` para el 45+ tibio.
- **M3 `[NIÑOS] Control de miopía`** (semana 4+, SOLO si M1 muestra cierres): 28-50, padres con hijos 3-12. `[metaStellest]`, `[metaCtrlAum]`, `[metaStellImg]`; reserva `[metaMyofix]`/`[metaMiopiaEdu]`.
- **M4 `[TIENDA] Ventas catálogo`**: NO prende hasta cumplir las 5 gates — escenario agresivo aprobado; ≥5 compras web/semana sostenidas con purchase arreglado en las 3 ramas; feed con precios desde la base; PREVENTA limpiada; fotos >1 toma en los SKUs pautados. Hasta entonces es un renglón en cero.

Embudo: FRÍO (M1+M3) → chat → bot → presupuesto · TIBIO (orgánico 3x/sem + ~4 stories/día + blog 51 notas) alimenta los públicos de M2 gratis · CALIENTE (M2) → cierre en local. Los 9 reels educativos restantes quedan SOLO en orgánico.

---

## 6. Campañas Google (resumen — detalle completo en Anexo B)

No arranca de cero: **reconstruye** una cuenta que gasta $517k/mes con 82% de humo. Search sola, sin partners ni Display; geo Córdoba capital + Unquillo/Río Ceballos/Salsipuedes/Saldán/La Calera; horario 9-21 + sábado, madrugada NUNCA (historial de cola zombie del bot). **Concordancia amplia PROHIBIDA en toda la cuenta.** Un solo reset de aprendizaje concentrado (día 21, "Gran Corte"); entre día 21 y 45 la única mano permitida es el informe de términos semanal (`google_terminos.js` → `google_negativas.js`).

- **C1 Multifocales** (reconstruida): grupos 1A multifocal+geo, 1B precio (las notas de blog ya rankean #1 — capturan, la landing cierra), 1C Varilux. Landing `/multifocales` con ancla "completo desde $X" por gama vía PricingService — el precio JAMÁS a mano (R6). En mínimo va chica y concentrada en exactas.
- **C2 Óptica local**: la mejor de la cuenta ($2.255/chat), hoy pierde 47% de impresiones por presupuesto — **acá va la primera plata extra**. Grupo "cerca" en radio 5 km (vivo acá, negativo en C1/C3).
- **C3 Recetados**: segunda mejor ($2.386/chat).
- **C4 Marca + Cerro**: defensa con assets de ubicación — reemplaza a la campaña de Maps pausada (pagaba $131k/mes por aparecer segunda). NO pujar marcas de competidores (la cuenta ya lo hizo sin querer: 35% del gasto de términos con QS 2-3).
- **C5 Miopía infantil** (mes 2, junto con M3, si pasó el valle del Gran Corte). **C6 Sol con receta** (octubre, estacional, tras sumar el banner sol-con-receta a /lentes-de-sol).
- **PMax**: ninguna nueva. La existente en cuarentena a $2.000/día con espada quincenal (>$8.000/chat → pausa). Reevaluar mes 3 solo con las TRES: offline con valor cargando + Merchant sano + Search estabilizadas — y solo para armazones, jamás multifocales.
- **Conversiones**: primarias = conversación WhatsApp iniciada + "WhatsApp del sitio". Compra web secundaria (tras B2/B3). Venta CRM offline con **valor = total de la orden** (no la seña): con ≥15-30 conv/30d, pasar a Maximizar valor (Google aprende que un multifocal $834k vale 3,9 monofocales). Locales: nunca borrar, nunca primarias — eran el 82% de humo. tCPA = CPA real +10% recién con 30 conv/30d por campaña.
- **Aviso previo al Gran Corte:** la columna "Conversiones" cae ~88% (deja de contar humo) y hay 2-4 semanas de valle. Es esperado, no es una falla.

Landings: nunca wa.me directo como URL final (el clic paga sin medición de página). Con CDN + ISR las landings pagas bajan de ~0,9s a ~0,1s de TTFB — impacta QS y CPC de todo.

---

## 7. Placas y contenido — 8 semanas (lun 10/8 → dom 4/10)

Corrige el déficit (49% educación / 5% acción / 0 testimonios / 0 piezas de precio multifocal) sin romper cadencia ni rotación: solo 6 de 24 salidas de carrusel son nuevas, el resto ya existe. **[YA]** = programada en `social/feed-programacion.json` · **[NUEVA]** = crear (copys completos en Anexo C) · **[SWAP]** = reemplaza a una pieza que se repite más adelante (no se pierde nada). Prerequisito: alta de los crons de social (B12).

| Sem. | mar | jue | sáb | dom (reel) |
|---|---|---|---|---|
| 1 (10-16/8) | `optica-mejor-calificada` [YA] | **`obras-sociales`** [NUEVA, SWAP] | `sol-seleccion` [YA, regenerar] | `que-es-la-miopia` [YA] |
| 2 (17-23/8) | `laboratorio-propio` [YA] | `multifocales-marean` [YA] | **`multifocal-desde`** [NUEVA GENERADA — primera pieza de precio multifocal de la historia de la cuenta] | `6-cuotas` [YA] |
| 3 (24-30/8) | `multifocales-no-fallan` [YA] | **`sol-con-receta`** [NUEVA, SWAP] | `garantia-adaptacion` [YA] | `que-es-la-hipermetropia` [YA] |
| 4 (31/8-6/9) | **`testimonio-multifocales`** [NUEVA, plantilla nueva — primer testimonio del feed] | `polarizados-manejo` [YA] | `armazones-destacados` [YA, regenerar] | `garantia-30-dias` [YA] |
| 5 (7-13/9) | `elegir-armazon-rostro` [YA] | **`agenda-tu-medicion`** [NUEVA, SWAP] | `sol-seleccion` [YA, regenerar] | `que-es-la-presbicia` [YA] |
| 6 (14-20/9) | `anteojos-rotos-gotita` [YA] | **`multifocal-desde`** [regenerada, precios frescos] | `receta-seleccion` [YA, regenerar] | `medicion-armazon` [YA] |
| 7 (21-27/9) | `progresivos-que-medimos` [YA] | **`testimonio-multifocales-2`** [NUEVA] | `optica-mejor-calificada` [YA] *(u `oferta-semana` si se aprobó la escalera de precios)* | `stellest-frena-miopia` [YA — calienta M3] |
| 8 (28/9-4/10) | **`renova-tu-receta`** [NUEVA — gemela del cron de renovación] | `laboratorio-propio` [YA] | `armazones-destacados` [YA, regenerar] | `fotocromaticos-dia` [YA] |

Resultado: **cada semana con ≥1 pieza de acción o prueba**. Stories en paralelo: sumar `story-testimonio`, `story-obras-sociales`, `story-turno` al carril `contenido` de `stories-diarias.json` + campo `cta` opcional en las ~120 stories/mes de producto ("Pedí tu presupuesto 👉 WhatsApp", dentro de la zona segura de 460px).

**Construcciones nuevas (backstage, semana 1-2):** plantilla `testimonio` en `plantillas.mjs` (5º tipo; validación estilo R6: sin campo `resena:{autor, fuente:"google"}` no renderiza) y **`generar-multifocal.mjs`** (lee gamas + armazón de entrada desde la base/PricingService, `fuente:"base"`, emite el carrusel + 4 variantes de tamaño para ads + el ancla "desde $X" de la landing: **placa, anuncio y landing nunca pueden decir números distintos**). Todo cambio de calendario = editar `feed-programacion.json`; nada se publica sin `--facebook --instagram` explícito y aprobación humana.

---

## 8. Retención y base instalada

**Principio: NO construir un 6º sistema.** Todo se monta sobre el pipeline existente ClientTask → smart-task-executor → sender → cola anti-ban (30/h, 120/día), que trae gratis: interruptor de pánico `followups_enabled`, patrón SENDING anti-pérdida, compuerta LLM CANCEL/POSTPONE/SKIP, etiqueta SIN_SEGUIMIENTO, corte por contacto frío, ventana horaria 9-19 L-V / 10-16 sáb. **Cambio habilitante único (S):** `AUTO_SENDABLE_TASK_PREFIX` (hoy un string, `config.js:96`) pasa a array `AUTO_SENDABLE_TASK_PREFIXES` + aceptar `createdBy: 'Sistema (Retención)'`. De paso, corregir el bug menor: la Interaction del envío se crea sin `userName: 'Bot'` (`smart-task-executor.js:355-361`). Regla de exclusión mutua nueva: un solo toque de retención por cliente cada 14 días; prioridad posventa > reseña > renovación > cumpleaños > segundo par.

| # | Flujo | Tipo | Esf. | Cuándo | Métrica objetivo |
|---|---|---|---|---|---|
| 1 | **Carrito abandonado: PRENDER** (código terminado que nunca corrió; cupón QUIEROMISLENTES jamás enviado; 5 PENDING / 0 EMAIL_SENT en local) | prender | S | ya | 5-10% recuperación solo email; ≥15% con multi-toque |
| 2 | **Reseña Google automatizada**: plantilla FIJA por `sendFollowUp()` (NO Gemini — no puede inventar el link y el texto probado excede el validador), gatillada por REVIEW_REQUEST vencida | automatizar existente | S-M | semana 1 | ≥10% envío→reseña; reseñas nuevas/mes en GBP |
| 3 | Whitelist→array + firma Bot | habilitante | S | semana 1 (mismo PR que 2) | — |
| 4 | **Posventa `[POSVENTA]`** a 10 días de DELIVERED (el guardián de la adaptación multifocal) + reseña encadenada a +3 días si no hay reclamo | construir | M | semanas 2-3 | ≥40% respuesta; detección temprana de PostSaleCase = éxito |
| 5 | **Renovación de receta `[RENOVACION]`** 12-18 meses — **el mayor ROI de todo el informe**: reactivar base propia, costo cero de ads. Cupo propio 10/día; rama `[RENOVACION MANUAL]` para clientes sin chat (mostrador puro) al panel del CRM | construir | M | semanas 3-4 | ≥10% con QUOTE ≤30 días; ≥5% con SALE ≤60 días (a $834k, 5 ventas/mes extra justifica todo el plan) |
| 6 | Carrito multi-toque (1h + 24h) + toque WhatsApp `[CARRITO]` si hay chat con inbound | extender | M | mes 2 | recuperación ≥15% |
| 7 | **Segundo par** `[SEGUNDO PAR]` 30-45 días post-entrega: sol con su misma receta, 15% off, cupón desde la base | construir | M | mes 2 | canje de cupón; ventas SUN de clientes existentes (histórico: 3 unidades) |
| 8 | Cumpleaños | **DIFERIDO** | — | con ≥200 birthDate (hoy 2/1096) — prerequisito S: capturar fecha en checkout, bot y mostrador | canjes cupón |

Presión sobre el anti-ban: renovación (10/día) + posventa + reseñas ≈ 45-50 envíos programados/día contra el techo de 120 — holgado; toda suba de cupo se hace de a uno mirando advertencias de WhatsApp. `followups_enabled` apaga TODOS los flujos WA de un saque. Dimensionar la cohorte de renovación contra producción (SELECT autorizado) antes de fijar cupo — la local no sirve (cohorte 12-18m = 0). Detalle completo de queries, mensajes modelo y firmas en Anexo E.

---

## 9. Roadmap: semana 1 a semana 8 (todo junto)

**Semana 0/1 (10-16/8) — destapar y bloqueantes:**
- Dueña decide: OK a la reasignación de §4.3 (mismo techo, −24%), método de pago ARS, texto vigente de 2x1 y garantía (cumplibles tal como se leen), pregunta obras sociales (B15), claim "control sin cargo" de renovación.
- Deploy Lote 1 quick wins (banner cookies, PREVENTA, multifocal en hero/nav, carrusel negro, og:image, FloatingWhatsApp) + B7 (aggregateRating) + B8 (doorways) + B13/B14 (301 promo, desindexar CRM) + B11 (UTMs) + B2 (higiene de conversiones de Google: 5 locales y Tiendanube a secundarias — NO cargar la label de compra).
- Altas de crons (B12): ads-report, social-*, abandoned-carts (con fix del bypass localhost y del CRON_SECRET hardcodeado) — retención flujo 1 PRENDIDO.
- Retención: PR flujos 2+3 (reseña automatizada + whitelist array).
- Meta: registro de etiquetas asignado; crear M1 y M2 EN PAUSA; revisión conjunta en Ads Manager → **prender M1 + M2** (M2 solo interacción si Consent Mode no llegó a prod) al presupuesto del escenario elegido, sin "probemos con un poquito más".
- Google: compliance firmado 8/8 (pausar anuncios con "Mejor Óptica", typos, promos vencidas, URLs a promo.*), negativas día 1, crear C4.
- Social: calendario semana 1 + backstage (plantilla testimonio + `generar-multifocal.mjs`).
- Cloudflare (QW12) apenas haya una ventana.

**Semana 2 (17-23/8):** no tocar pauta Meta (el algoritmo necesita 2 semanas estables; solo apagar anuncios que violen costo/conversación y vigilar frecuencia). Deploy Lote 2 (checkout, receta fake fix mínimo, confianza, ficha 2x1/cuotas, cross-sell). Construir `/multifocales` (B6, desde `campaigns.ts:213`) con ancla generada — **verificando precios contra producción con OK previo**. Consent Mode v2 (B4) a producción. Social: sale `multifocal-desde` el sáb 22.

**Semana 3 (24-30/8):** Google **día 21 = Gran Corte** (conversiones primarias definitivas, presupuestos definitivos, cirugía C1 a exactas con landing viva, horario 9-21+sáb, geo ampliada) — avisar del valle de 2-4 semanas. Vinculación chat→cliente + backfill (B5). Conversiones offline (B9, primera corrida VALIDATE_ONLY). ISR + reconversión AVIF (estructurales de performance, hacen rendir al CDN). Retención: construir posventa.

**Semana 4 (31/8-6/9):** primera evaluación Meta con regla de 14 días + tabla ROAS (requiere B5 hecho). Si M1 muestra cierres → **prender M3**. Si el mínimo funciona → proponer subir a recomendado (+15-20% escalonado). Merchant Center (B10, con PREVENTA ya limpia). Retención: construir renovación. Social: primer testimonio en el feed. GBP: cambio de nombre si estamos fuera de la ventana de 21 días del experimento de Maps.

**Semanas 5-6 (7-20/9):** Google día 28-35: veredicto Maps (gatillo de reversión: −20% chats+llamadas+walk-ins sostenido); ritual semanal de términos → negativas. Sesión de fotos por lotes (priorización del §3). Aplicar lote de fichas redactadas + reactivar 5 productos (QW15). Turnos online (estructural) — empalma con la placa `agenda-tu-medicion` del jue 10/9. Renovación empieza a drenar el backlog 12-18m a 10/día.

**Semanas 7-8 (21/9-4/10):** evaluación mes 1 completa: ROAS CRM por campaña, CVR conversación→venta, rebalanceo Meta↔Google (10-15% máx, piso Google $250k). Mes 2 Google: C5 miopía. Retención mes 2: carrito multi-toque + segundo par. Decisiones de negocio pendientes: escalera de precios/ofertas rotativas (habilita `oferta-semana`), MP Checkout Pro, 9/12 cuotas multifocales. Placa `renova-tu-receta` (29/9) sincronizada con el cron ya corriendo.

**Octubre:** decisión colchón Q4 ANTES de que el CPM suba solo; C6 sol con receta (tras banner en /lentes-de-sol); mes 3: reevaluar PMax y tCPA/Max-valor solo con sus condiciones cumplidas. Agresivo solo con "×" total ≥3 sostenido Y capacidad del local validada.

---

---

# ANEXOS

## Anexo A — Campañas Meta: detalle completo

### A.1 Estructura

**Comunes:** cuenta act_901723834933651 (ARS); ubicaciones Advantage+ excluyendo Audience Network; presupuesto a nivel conjunto (ABO); optimización "conversaciones iniciadas"; entrega 24/7; etiqueta única por anuncio en nombre + mensaje precargado (cruce de `src/lib/ads/meta-insights.ts:59` `adTag()` → `ads-report/route.ts:164-254`).

**M1 — `[MF] Mensajes WhatsApp | Multifocales`** — Objetivo: Interacción → Mensajes → WhatsApp. Conjunto único: Córdoba capital +15 km · 40-65+ · todos los géneros · Advantage+ audience con edad como único filtro duro (la presbicia la trae la vida, no un interés declarado). Anuncios:
1. `[meta2x1]` — video `public/social/reels/2x1-multifocales.mp4` + portada `2x1-multifocales-cover.jpg`. Precargado: **"Hola! Quiero saber más del 2x1 en multifocales [meta2x1]"**.
2. `[meta2x1Img]` — imagen `ad-l1-dos-al-precio-de-uno` con personalización por ubicación: `-feed` (4:5) / `-cuadrado` (1:1) / `-story` (9:16) / `-apaisado` (1.91:1). Claim: "2x1 en multifocales — dos pares al precio de uno, medidos con tu armazón puesto".
3. `[metaPuesto]` — imagen `ad-l1-armazon-puesto` (4 formatos). Claim: **"Un multifocal que marea casi siempre estuvo mal medido"** — claim de proceso (medición), no de salud: pasa policy.
4. `[metaGar30]` — imagen `ad-l1-garantia-30-dias` (4 formatos) o video `reels/garantia-30-dias.mp4` — elegir UNO al inicio; el otro es el reemplazo cuando la frecuencia pida rotación. Pieza ya saneada de promesas de resultado ilimitado (commit b18172fa).
Copy sin precios (R6). Condiciones del 2x1 a un clic (Lealtad Comercial + policy Meta, `docs/buenas-practicas-meta-google.md:75`).

**M2 — `[RMK] Remarketing | Tibios y calientes`** — Conjunto único combinado: visitantes web 30d + interacción IG/FB 30d + viewers ≥50% de reels; exclusión: conversaciones iniciadas últimos 30d; geo Córdoba provincia. Partir en dos recién arriba de ~$10.000/día con frecuencia sana. Anuncios (argumentos de cierre):
1. `[metaRmk6c]` — `campania-6-cuotas-{feed,cuadrado,story,apaisado}` (o video `reels/6-cuotas.mp4` = `[metaRmk6cV]`). "6 cuotas sin monto mínimo" es ventaja real vs Más Visión ($400k mínimo) — explotarla textual.
2. `[metaRmkPago]` — `ad-l2-numeros-que-cierran` ("Elegí cómo pagarlos": cuotas/efectivo/transferencia).
3. `[metaRmkCalif]` — `ad-l2-calificacion` ("675 reseñas en Google"). Policy: cita el NÚMERO, no contenido de reseñas (términos de Google; la placa "buscanos" ya se diseñó con esa restricción, commit 42c04134).
4. Rotación (frecuencia >3,5): `[metaRmkSiguen]` `ad-l2-siguen-aca` y `[metaRmkBusca]` `ad-l2-buscanos`. Futuro: `[metaRmkTest]` (testimonio en 4 tamaños) + `obras-sociales` como variante 45+.

**M3 — `[NIÑOS] Mensajes WhatsApp | Control de miopía`** (semana 4+, solo si M1 muestra cierres) — Córdoba +15 km · 28-50 · interés/comportamiento padres con hijos 3-12.
1. `[metaStellest]` — video `reels/stellest-frena-miopia.mp4`. Precargado: **"Hola! Quiero información sobre control de miopía para mi hijo/a [metaStellest]"**.
2. `[metaCtrlAum]` — `ad-l3-control-con-mas-aumento` ("¿Cada control trae más aumento?" — formulado sobre la situación, no sobre el lector: pasa Personal Attributes).
3. `[metaStellImg]` — `ad-l3-stellest-frena` (4 formatos). Policy: si el % de eficacia va en el creativo, respaldarlo con el claim del fabricante y sin promesa de resultado individual (`buenas-practicas-meta-google.md:69`).
4. Reserva: `[metaMyofix]` `reels/lente-myofix.mp4` (empalma con el tag histórico `myofix` de meta-insights) y `[metaMiopiaEdu]` `reels/que-es-la-miopia.mp4`.

**M4 — `[TIENDA] Ventas catálogo | Armazones`** — Gates (todas): (a) escenario agresivo aprobado; (b) ≥5 compras web/semana sostenidas con purchase server-side en las 3 ramas; (c) feed de catálogo con precios desde la base; (d) PREVENTA limpiada; (e) fotos >1 toma en SKUs pautados.

### A.2 Registro de etiquetas (obligatorio antes de crear nada)

| Etiqueta | Campaña | Creativo |
|---|---|---|
| `[meta2x1]` | M1 | reels/2x1-multifocales.mp4 |
| `[meta2x1Img]` | M1 | ad-l1-dos-al-precio-de-uno (4 formatos) |
| `[metaPuesto]` | M1 | ad-l1-armazon-puesto |
| `[metaGar30]` | M1 | ad-l1-garantia-30-dias / reels/garantia-30-dias.mp4 |
| `[metaDesde]` | M1 (fase 2) | multifocal-desde-{feed,cuadrado,story,apaisado} (generada, único anuncio con precio permitido) |
| `[metaRmk6c]` / `[metaRmk6cV]` | M2 | campania-6-cuotas / reels/6-cuotas.mp4 |
| `[metaRmkPago]` | M2 | ad-l2-numeros-que-cierran |
| `[metaRmkCalif]` | M2 | ad-l2-calificacion |
| `[metaRmkSiguen]` / `[metaRmkBusca]` | M2 (rotación) | ad-l2-siguen-aca / ad-l2-buscanos |
| `[metaRmkTest]` | M2 (fase 2) | testimonio-multifocales (4 tamaños) |
| `[metaStellest]` | M3 | reels/stellest-frena-miopia.mp4 |
| `[metaCtrlAum]` | M3 | ad-l3-control-con-mas-aumento |
| `[metaStellImg]` | M3 | ad-l3-stellest-frena |
| `[metaMyofix]` / `[metaMiopiaEdu]` | M3 (rotación) | reels/lente-myofix.mp4 / que-es-la-miopia.mp4 |

### A.3 Presupuestos Meta por campaña (ARS/día, netos)

> ⚠️ **DEROGADA por §4.3 (9/8/2026).** Esta tabla se dimensionó con benchmarks genéricos ($1.000-2.000/conversación) y bajo la premisa falsa de que Meta gastaba $0. Medido: las conversaciones cuestan **$771-1.871** y Meta ya gasta ~$545.000/mes. Rige la reasignación de §4.3, que respeta el techo de gasto actual. Se conserva acá solo como registro de lo que se descartó y por qué.

| Campaña | ~~Mínimo~~ | ~~Recomendado~~ | ~~Agresivo~~ |
|---|---|---|---|
| M1 | ~~$22.000~~ | ~~$32.000~~ | ~~$48.000~~ |
| M2 | ~~$6.000~~ | ~~$10.000~~ | ~~$16.000~~ |
| M3 (sem. 4+) | — | ~~$8.000~~ | ~~$12.000~~ |
| M4 (mes 2+, gates) | — | — | ~~$12.000~~ |
| **Total/mes** | ~~$840.000~~ | ~~$1.500.000~~ | ~~$2.640.000~~ |

**Presupuestos vigentes (§4.3):** `Mensajes` USD $410.000/mes · M1 (ARS `Mensajes`) $52.000 · M2 (`Remarketing`) $20.000 · Tráfico IG $0. **Total Meta $482.000/mes.** M3 (miopía) y M4 (catálogo) no prenden con plata nueva: salen del headroom de $279.000 o de reasignar dentro de Meta, y solo con cierres demostrados.

Sobre Learning Limited: el miedo que inflaba la tabla vieja no aplica. A $771/conversación, los $410.000/mes de `Mensajes` compran ~530 conversaciones/mes ≈ 124/semana — más del doble del umbral de ~50/semana. La campaña ya está fuera de aprendizaje hoy con menos plata.

### A.4 Higiene de cuenta
Tras actualizar un creative por API, **re-pausar y verificar status** (Meta resetea a ACTIVE sin aviso); checklist semanal de viernes; app publicada con URL de privacidad (error 1885183 si está en dev). Fuente: `docs/buenas-practicas-meta-google.md`.

---

## Anexo B — Campañas Google: detalle completo

### B.1 Keywords y RSA por campaña

**C1 `Search | Multifocales Córdoba`**

*Grupo 1A — Multifocal + geo:* `[lentes multifocales cordoba]` · `[multifocales cordoba]` · `[anteojos multifocales cordoba]` · `[lentes progresivos cordoba]` · `[opticas multifocales cordoba]` · `"lentes multifocales"` · `"lentes progresivos"`. Landing: `/multifocales` (interim `/cristales-opticos`; NUNCA la home genérica).
RSA 1A — Titulares (≤30): `Multifocales 2x1 en Córdoba` · `Lentes Multifocales Varilux` · `Dos Pares al Precio de Uno` · `Garantía de Adaptación 30 Días` · `6 Cuotas Sin Interés` · `Medición Essilor Expert` · `Laboratorio Óptico Propio` · `Óptica en Cerro de las Rosas` · `Presupuesto por WhatsApp` · `Más de 675 Reseñas en Google`. Descripciones (≤90): `Dos pares al precio de uno, medidos en el local. Garantía de adaptación de 30 días.` · `6 cuotas sin interés, 20% de descuento en efectivo o 15% por transferencia bancaria.` · `Medición Essilor Expert y laboratorio propio en Cerro de las Rosas, Córdoba.` · `Pedí tu presupuesto sin cargo por WhatsApp. Te respondemos en el día.`

*Grupo 1B — Precio:* `[precio lentes multifocales]` · `[precio lentes multifocales cordoba]` · `[cuanto cuesta un lente multifocal]` · `[cuanto sale un lente multifocal]` · `[cuanto cuestan los anteojos multifocales]` · `[precio lentes progresivos]` · `"lentes multifocales precio"`. Landing: `/multifocales` con el ancla "completo desde $X" por gama (PricingService; Galileo publica $120.000). El blog #1 en "precio lentes multifocales Argentina" debe linkearla.
RSA 1B: los de 1A anteponiendo `Precio de Multifocales 2026` · `Cuánto Cuesta un Multifocal` · `Presupuesto Sin Cargo Hoy` · `Multifocales Desde ${GAMA}` *(SOLO cuando el valor salga generado de la base; hasta entonces no se carga)*. Descripción extra: `Presupuesto de multifocales por WhatsApp en el día, sin cargo y sin compromiso.`

*Grupo 1C — Varilux:* `[varilux]` · `[lentes varilux]` · `[varilux precio]` · `[varilux cordoba]` · `[varilux comfort max]` · `[varilux xr]` · `"cristales varilux"`. Landing: `/multifocales` sección Varilux o nota `varilux-vs-genericos-diferencias`.
RSA 1C: `Varilux Original en Córdoba` · `Especialista en Varilux` · `Varilux XR Series` + promos de 1A. Descripción extra: `Varilux original con medición personalizada. Garantía de adaptación de 30 días.`

**C2 `Search | Óptica local`** — Grupo genérico: `[opticas en cordoba]` · `[optica cordoba]` · `[opticas en cordoba capital]` · `[opticas zona norte cordoba]` · `[opticas cerro de las rosas]` · `[optica cerro de las rosas]`. Grupo "cerca" (radio 5 km, puja corta): `"optica cerca"` · `"opticas cerca de mi"` — vivo acá, negativo en C1/C3 (firmado 8/8 §6.2: se decide con el CPA del grupo, no por trauma). Landings: `/optica-cordoba` (existe) o home; grupo Cerro → `/nuestro-local`.
RSA: `Óptica en Cerro de las Rosas` · `Tu Óptica en Zona Norte` · `Más de 675 Reseñas en Google` · `Multifocales y Lentes de Sol` · `6 Cuotas Sin Interés` · `Abierto de Lunes a Sábado` · `Atelier Óptica` · `Presupuesto por WhatsApp`. Descripciones: `Óptica en José Luis de Tejeda 4380, Cerro de las Rosas. Lun a Vie 8 a 20, Sáb 9 a 17.` · `Más de 675 reseñas en Google. Escribinos por WhatsApp y coordiná tu visita.` · `Multifocales Varilux, laboratorio propio y garantía de adaptación de 30 días.`

**C3 `Search | Anteojos recetados`** — `[anteojos recetados cordoba]` · `[lentes recetados cordoba]` · `[anteojos de receta cordoba]` · `[hacer lentes con receta]` · `[lentes con aumento cordoba]` · `[cristales para anteojos cordoba]` · `"anteojos recetados"`. Landing: `/cristales-opticos` (o `/receta`; decidir por conversión — `/receta` tiene ISR roto por searchParams).
RSA: `Anteojos Recetados en Córdoba` · `Hacé tus Lentes con Receta` · `Lentes Recetados Completos` · `Laboratorio Óptico Propio` · `6 Cuotas Sin Interés` · `20% de Descuento en Efectivo` · `Óptica en Cerro de las Rosas` · `Presupuesto por WhatsApp`. Descripciones: `Anteojos recetados completos con laboratorio propio. Entrega rápida en Córdoba.` · `Traé tu receta y elegí tu armazón. 6 cuotas sin interés o 20% de descuento en efectivo.` · `Pedí tu presupuesto sin cargo por WhatsApp. Te respondemos en el día.`

**C4 `Search | Marca + Cerro`** — `[atelier optica]` · `[optica atelier]` · `[atelier optica cordoba]` · `"atelier optica"`. Landing: home. RSA: `Atelier Óptica` · `Óptica en Cerro de las Rosas` · `Más de 675 Reseñas en Google` · `Multifocales y Lentes de Sol` · `Turnos y Consultas x WhatsApp` · `Abierto de Lunes a Sábado`. Día 60: revisar Estadísticas de subastas; si nadie puja "atelier", presupuesto al mínimo. Titular "Calificación 5,0" PROHIBIDO — solo "Más de 675 Reseñas en Google" (factual).

**C5 `Search | Control de miopía infantil`** (mes 2) — `[lentes stellest]` · `[stellest precio]` · `[stellest cordoba]` · `[lentes myofix]` · `[control de miopia infantil]` · `[control de miopia cordoba]` · `[lentes para frenar la miopia]` · `"miopia infantil"`. Landing: crear (interim nota `lentes-stellest-control-miopia-infantil`). RSA sin promesas de resultado en el hijo del lector: `Control de Miopía Infantil` · `Lentes Stellest en Córdoba` · `Lentes Stellest y MyoFix` · `Medición Especializada` · `Asesoramiento por WhatsApp` · `6 Cuotas Sin Interés`. Descripciones: `Lentes Stellest y MyoFix para control de miopía en chicos. Consultá por WhatsApp.` · `Medición especializada en Córdoba y seguimiento. Coordiná una consulta por WhatsApp.`

**C6 `Search | Sol con receta`** (octubre) — `[anteojos de sol con receta]` · `[lentes de sol graduados]` · `[lentes de sol con aumento cordoba]` → `/lentes-de-sol` DESPUÉS del banner "cualquier armazón se hace sol con tu receta".

### B.2 Negativas (lista compartida, día 1, con y sin tildes)
- Electrónica/otro producto: celular, camara, cámara, iphone, samsung, templado, vidrio, telescopio, microscopio, drone, lupa
- Sin plata/otro canal: gratis, usado, usados, segunda mano, mercado libre, mercadolibre, aliexpress, shein, temu
- Empleo/formación: curso, carrera, empleo, trabajo, sueldo, optico tecnico, óptico técnico
- Salud no-óptica: oftalmologo, oftalmólogo, turno oftalmologo, cirugia, cirugía, lasik, conjuntivitis, cataratas
- Obra social (hasta respuesta de la dueña — B15): pami, apross, osde. Si hay convenios activos → grupo propio + sitelink `/obras-sociales`; `pami` y `gratis` quedan negativas igual.
- Solo C1/C3: lentes de contacto; cerca de mi, cerca de mí (vivo en C2 radio 5 km).
- Ritual: términos de búsqueda semanal el primer mes → engordar con `google_negativas.js`. Única mano permitida entre día 21 y 45.

### B.3 Extensiones / assets
- **Ubicación** (todas): vincular GBP (cid=14830223812501661125, `src/lib/business-info.ts`) — cubre el pin de Maps gratis tras la pausa de la campaña Maps.
- **Llamada:** +54 9 351 868-5644, SOLO en horario del local (L-V 8-20, S 9-17).
- **Sitelinks:** Multifocales (`/multifocales`) · Cómo Llegar (`/nuestro-local`) · Lentes de Sol (`/lentes-de-sol`) · Tienda (`/tienda`) · Reseñas (`/resenas`) · Obras Sociales (`/obras-sociales`, condicional a convenios activos).
- **Callouts (≤25):** `Garantía de adaptación` · `Laboratorio propio` · `6 cuotas sin interés` · `20% off en efectivo` · `Atención por WhatsApp` · `Essilor Expert`.
- **Structured snippet** (Servicios): Multifocales, Anteojos recetados, Lentes de sol, Control de miopía, Lentes de contacto.
- **Extensión de precios: BLOQUEADA** hasta que exista el generador desde PricingService. Prohibido cargar montos a mano (R6 extendida a Ads). Cuando exista: "Multifocal completo desde $X" por gama + armazones $189.000/$200.000 (validados contra prod el 6/8; revalidar por inflación).
- **Promoción:** "2x1 en multifocales" con vigencia REAL en plataforma; cero urgencia falsa.

### B.4 Conversiones

| Acción | Tipo | Estado | Uso |
|---|---|---|---|
| Conversación WhatsApp iniciada (clic wa.me) | **Primaria** día 1 | Trackeada | Única señal de puja al inicio |
| "WhatsApp del sitio" | Primaria (Gran Corte) | Definida 8/8 | Las DOS únicas primarias |
| Compra web (`Atelier Optica - Web (web) purchase`, importada de GA4) | **Ya existe y está PRIMARIA** | Funciona; pasarla a secundaria en el Gran Corte | Observación, jamás puja. **No sumarle la etiqueta de sitio web**: doble conteo |
| `Tiendanube Website purchases` | Legado ENABLED y **PRIMARIA** | 🔴 puja por algo imposible | A secundaria (no borrar). Su etiqueta NO va en el sitio nuevo |
| Venta CRM offline, **valor = total de la orden** (no la seña) | Primaria diferida | Código listo, inerte | Backfill 90 días tras allowlist; runtime VALIDATE_ONLY una semana; con ≥15-30 conv/30d → Maximizar valor |
| Locales (direcciones/llamadas del perfil) | Secundarias | Existen | Nunca borrar, nunca primarias |
| Tiendanube legacy | Eliminar | — | — |

Puja: maximizar conversiones sin tCPA → tCPA = CPA real +10% con 30 conv/30d → Max. valor cuando cargue la venta CRM.

### B.5 Presupuesto Google por campaña (ARS)

La columna **VIGENTE** es la del presupuesto firmado el 8/8, ratificada por §4.3: entra dentro del techo de gasto actual. Las otras dos quedan como referencia de escalado futuro y **solo** se financian desde el headroom de $279.000/mes o reasignando, nunca con plata nueva.

| Campaña | Hoy (medido 9/8) | **VIGENTE (mes 1)** | Referencia: escalar | Referencia: máx. |
|---|---|---|---|---|
| C1 Multifocales | $31.116 | **$2.500/d — $75.000** | $6.000/d — $180.000 | $9.000/d — $270.000 |
| C2 Óptica local | $52.586 | **$5.000/d — $150.000** | $7.000/d — $210.000 | $11.000/d — $330.000 |
| C3 Recetados | $36.617 | **$3.500/d — $105.000** | $5.000/d — $150.000 | $8.000/d — $240.000 |
| C4 Marca | $0 | **$1.000/d — $30.000** | $1.500/d — $45.000 | $2.000/d — $60.000 |
| C5 Miopía | — | **$0** (mes 2, desde headroom) | $1.000/d — $30.000 | $2.000/d — $60.000 |
| PMax "al local" | **$357.709** | **$2.000/d — $60.000** (cuarentena) | $60.000 o $0 (espada quincenal) | $3.000/d — $90.000 (solo feed sano) |
| PMax Ventas | $28.630 | **$0** (pausada) | $0 | $0 |
| Maps | **$129.569** ⚠️ sigue gastando | **$0** (pausar de verdad) | $0 | $0 |
| **Total/mes** | **$636.227** | **$420.000 (−34%)** | ~$675.000 | ~$1.050.000 |

### B.6 Mapa landing × grupo

| Grupo | Landing | Estado |
|---|---|---|
| Multifocal+geo, precio, Varilux | `/multifocales` | Promover desde `campaigns.ts:213` — bloqueante B6; interim `/cristales-opticos` |
| Óptica genérico | `/optica-cordoba` o home | Home solo tras QW1 (banner) y QW3 (línea multifocal) |
| Cerro/cerca | `/nuestro-local` | Existe |
| Recetados | `/cristales-opticos` (o `/receta`) | Existen; `/receta` con ISR roto |
| Marca | Home | — |
| Miopía | Nueva (mes 2) | Interim nota Stellest |
| Sol con receta | `/lentes-de-sol` | Sumar banner primero |
| **Nunca** | wa.me directo como URL final | El WhatsApp va como CTA en la landing + extensión |

---

## Anexo C — Placas: copys completos y especificaciones

Formato: único markup permitido `*resaltado*` (color marca). Imágenes del banco (`public/images/blog/…`); R5 corta si falta. Los colores salen de `globals.css` vía `identidad.mjs` — prohibido color/fuente literal en plantilla.

### C.1 `obras-sociales` (4:5, dark, confianza)
⚠️ Validar mecánica y lista contra `src/app/obras-sociales/page.tsx` — el copy no puede prometer lo que la página no dice.
- **cover** (mostrador-marmol.jpg): `Tu obra social *te cubre parte* de tus anteojos` / `Traé la orden y el resto lo resolvemos acá.`
- **list** `Cómo funciona, sin vueltas`: `Traés tu receta y tu credencial` · `Nosotros hacemos el trámite` · `Pagás solo la diferencia — y podés usar 6 cuotas sin interés`
- **list bisagra** (fachada-ladrillo.jpg) `Lo que nadie te dice`: `El descuento de la obra social *se suma* a las cuotas` · `No hace falta turno: venís y lo vemos en el momento` · `Si tu obra social no está en la lista, consultanos igual`
- **cta**: `Consultá por la tuya` / `Escribinos por WhatsApp con el nombre de tu obra social y te decimos en el día qué te cubre.`
- **caption**: "La pregunta que más escuchamos en el mostrador: «¿trabajan con mi obra social?». Trabajamos con obras sociales y prepagas — traé tu orden y te decimos exactamente cuánto te cubre y cuánto queda. Lo que queda, hasta en 6 cuotas sin interés. Cerro de las Rosas, sin turno previo." + link a `atelieroptica.com.ar/obras-sociales` con UTM.

### C.2 `multifocal-desde` — GENERADA, nunca a mano (R6)
Estructura declarada por `generar-multifocal.mjs`; los `{…}` los llena el script desde la base/PricingService.
- **cover** (pareja-multifocales-exterior.png): `¿Cuánto sale un *multifocal completo*?` / `Armazón + cristales, medidos acá. Números de hoy, no de un folleto.`
- **number** ×3 (una por gama): rótulo `Multifocal completo · gama {nombre}` — dato `desde {precio}` — cuerpo `Armazón incluido. Hasta 6 cuotas sin interés con tarjeta.`
- **list bisagra** (mostrador-marmol.jpg) `Qué incluye ese precio`: `Medición con *tu armazón puesto*, no un promedio` · `Laboratorio propio: tu cristal no viaja por medio país` · `Garantía de adaptación: si no te adaptás, *lo hacemos de nuevo*`
- **cta**: `Pedí tu presupuesto por WhatsApp` / `Con tu receta te lo pasamos en el día. Sin compromiso.`
- **caption** (generada): "Precios reales de hoy, tomados de nuestro sistema — los mismos que ves en la tienda. El valor final depende de tu receta: pedinos presupuesto por WhatsApp y te lo pasamos en el día." + fecha de generación.
- El mismo generador emite las variantes ad `multifocal-desde-{feed,cuadrado,story,apaisado}` para `[metaDesde]` y el ancla de la landing. Regenerar el mismo día de subirla a pauta y ante todo cambio de lista (guarda de frescura 10 días).

### C.3 `sol-con-receta` (4:5, dark, venta)
- **cover**: `Cualquier armazón de la óptica *se hace lente de sol* con tu receta` / `El modelo lo elegís vos. El color y la graduación los ponemos nosotros.`
- **list** `Cómo es`: `Elegís cualquier armazón de receta que te guste` · `Teñimos o *polarizamos* el cristal con tu graduación` · `¿Multifocal? También: sol de lejos y de cerca en el mismo anteojo`
- **number**: rótulo `Tu catálogo de sol acaba de crecer` — dato `Todo el local` — cuerpo `No son 10 modelos de sol: es cada armazón de la vidriera, hecho sol.`
- **cta**: `Traé tu receta y elegí` / `O mandala por WhatsApp y te pasamos opciones con foto. Cerro de las Rosas, sin turno.`
- **caption**: "El anteojo de sol con receta no es un producto aparte: es cualquier armazón que te quede bien, con tu graduación y el tratamiento que uses — teñido, polarizado o fotocromático. Si usás multifocales, también se puede. Mandanos tu receta por WhatsApp y armamos opciones."

### C.4 `testimonio-multifocales` (4:5, dark, prueba — plantilla nueva)
⚠️ La cita se toma TEXTUAL de una reseña pública de Google (675+), con nombre de pila real; jamás se redacta ni se "mejora". Elegir una que mencione multifocales/adaptación/medición.
- **testimonio** (slide nueva): cita textual ≤180 caracteres (recortable con […]), 5 estrellas en color marca, atribución `{Nombre} — reseña en Google`.
- **number**: rótulo `No es la única` — dato `5,0 ★` — cuerpo `{n} reseñas en Google. Buscanos y leelas todas — no elegimos solo las buenas.` (n desde el dato vigente; hoy 677 — verificar al generar).
- **cta**: `La próxima reseña puede ser tuya` / `Vení a medirte y comprobalo. WhatsApp o sin turno en el local.`
- **caption**: "Esto no lo escribimos nosotros. {Nombre} lo dejó en Google después de llevarse sus multifocales. Lo que más nos gusta: no habla del anteojo, habla de cómo ve. Buscá «Atelier Óptica Córdoba» en Google y leé el resto."
- `testimonio-multifocales-2` (S7): otra reseña (ideal: garantía o medición) + cta variante `¿Ya te atendiste acá? Dejanos tu reseña — se lee cada una.` (siembra la cadena de reseñas del flujo 3 de retención).

### C.5 `agenda-tu-medicion` (4:5, dark, acción)
⚠️ Validar horarios contra `business-info.ts` (el horario del bot vive en `SystemSetting`, no asumir).
- **cover**: `Un buen anteojo empieza *antes* de elegir el armazón` / `La medición es lo que hace que un multifocal funcione. O no.`
- **list** `Qué pasa en tu visita`: `Tomamos tu receta (o te medimos la vista)` · `Medimos con *el armazón puesto*: altura, distancia, inclinación` · `Te decimos qué cristal conviene para TU uso — no el más caro`
- **list bisagra** (fachada) `Por qué presencial`: `Dos milímetros de diferencia en un multifocal se sienten todo el día` · `Ningún formulario online puede medir cómo te queda un armazón` · `Por eso la garantía la podemos dar: medimos nosotros`
- **cta**: `Coordiná tu visita por WhatsApp` / `Decinos qué día te queda cómodo y te esperamos. También sin turno: {horarios}.`
- **caption**: "El multifocal que marea casi nunca es culpa del cristal: es una medición hecha a las apuradas o directamente sin el armazón puesto. Acá la medición es el corazón del trabajo. Escribinos por WhatsApp y coordinamos un momento tranquilo para vos."

### C.6 `renova-tu-receta` (4:5, dark, acción/remarketing)
⚠️ Si se afirma "medición sin cargo", validar la condición con la dueña primero.
- **cover**: `¿Tus anteojos tienen *más de dos años*?` / `La vista cambia despacio. Uno se acostumbra a ver peor sin darse cuenta.`
- **list** `Señales de que la receta venció`: `Acercás o alejás el celular para enfocar` · `Leer te cansa o te deja dolor de cabeza` · `De noche las luces encandilan más que antes`
- **number**: rótulo `Un multifocal se renueva cada` — dato `1 a 2 años` — cuerpo `No porque se gaste el cristal: porque cambia tu vista.`
- **cta**: `Vení a chequearla` / `Es un rato, y salís sabiendo si tu graduación sigue siendo la tuya. WhatsApp o sin turno.`
- **caption**: "Nadie nota que ve un 10% peor: el cerebro compensa. Por eso la receta tiene vencimiento aunque el anteojo esté impecable. Si tus multifocales tienen más de dos años, vení a chequear — capaz están perfectos, capaz te estás perdiendo de ver bien." *(Pieza gemela del followup `[RENOVACION]`: mismo mensaje en orgánico y en WhatsApp 1-a-1.)*

### C.7 Plantillas y generadores nuevos (especificación)
1. **Slide `testimonio`** (`plantillas.mjs`, 5º tipo): comillas de apertura grandes en `id.colores.marca`; cita ~54-60px peso 700 `white-space:pre-line`; 5 estrellas SVG inline en `marcaClara` (contraste ≥4,5:1 — restricción de accesibilidad); atribución 30px opacidad .7; fondo editorial opcional con `.velo`; zona segura del pie (267px en 4:5, 460px en 9:16). Validador: slide `testimonio` exige `resena:{autor, fuente:"google"}` — sin ese campo NO renderiza.
2. **`generar-multifocal.mjs`**: análogo a `generar-producto.mjs`; lee gamas + armazón de entrada desde la base/PricingService (nunca re-implementar cálculo); emite `multifocal-desde.json` con `fuente:"base"` + 4 variantes de tamaño (patrón `generar-campania.mjs`); cubierto por la guarda de frescura de 10 días.
3. **`generar-testimonio.mjs`** (fase 2, opcional): tercera fuente "reseñas" ya prevista en `docs/plan-publicacion-meta.md` §2; depende de persistir reseñas; mientras tanto, JSON a mano con cita textual + campo `resena` obligatorio alcanza (sin precios → R6 no aplica).
4. **`oferta-semana`** (condicional a la escalera de precios): variante de `generar-producto.mjs` que toma solo productos con `salePrice` vigente, precio tachado con `fuente:"base"`. Sin decisión de negocio, no existe.
5. **CTA en stories** (~120/mes): campo `cta` opcional en `generar-story-producto.mjs` + plantilla — rótulo de una línea arriba del pie, dentro de la zona segura de 460px (verificada contra la UI real de FB Reels, comentario `plantillas.mjs:249-254`).

---

## Anexo D — Oferta, precios y cierre

### D.1 Precios de referencia (base LOCAL — re-verificar contra prod antes de imprimir; costos de cristales POR PAR)
Smart ONE $269.000 · Smart NEW $434.000 · **Smart FREE 2x1 $646.250** (único `botRecommended`; segundo armazón más barato bonificado — lógica robusta en `src/lib/promo-utils.ts`, `isMiPrimerVarilux` excluido) · Mi Primer Varilux Comfort Max $673.301–$963.286 · tope Stylis 1.74 $1.287.743 · promedio multifocal $831.243.

### D.2 Escalera de oferta por segmento

**A. Multifocal 45-65** (el negocio real). Propuesta de valor — todo ya es verdad: "Multifocales Varilux con garantía de adaptación 30 días, medición presencial en Cerro de las Rosas, 6 cuotas sin monto mínimo, presupuesto por WhatsApp en minutos." Tres anclas nombradas contra el $120k de Galileo:
- **Entrada:** "Multifocal completo desde $269.000" — comunicar SIEMPRE el paquete completo (~$429k con armazón $160k), nunca el cristal solo: posiciona "completo con antirreflejo y filtro azul + garantía" y evita la comparación desnuda.
- **Media/héroe:** **Smart FREE 2x1 $646.250 con el segundo armazón bonificado** — la mejor oferta dormida del sistema: ya codeada y no comunicada en NINGÚN lado. "2 anteojos multifocales por $646.250" es demoledor a 45+.
- **Premium:** "Mi Primer Varilux desde $673.301" — para el primer multifocal (máximo miedo a la adaptación → máximo valor de la garantía).
Hipótesis: precio "desde" + 2x1 visible debería duplicar la tasa chat→presupuesto (el precio filtra curiosos, el 2x1 da motivo de consulta). Meta declarada: bajar el costo/chat de $29.425 a <$10.000.

**B. Sol/moda ($160-200k):** "cualquier armazón se hace de sol con tu receta" (convierte 95 SKUs); Clip-On como puente (landing `clipon` ya existe en `campaigns.ts:161` — "dos anteojos en uno", contra-oferta al 2x1 de Galileo para quien no llega al multifocal); 3-5 salePrice rotativos semanales desde la base con un "modelo de la semana" con foto sobre rostro. Primero: arreglar el 404 de febo-c1.

**C. Receta simple joven:** "armazón + monofocal con filtro azul, completo desde $X, en 6 cuotas" — el Super Blue TIENE garantía de adaptación (`faq-data.ts:64`) y nadie lo dice: EL diferencial en un commodity. Objetivo secundario explícito: capturar teléfono+receta → `Prescription.date` → el cron de renovación los convierte en recompra a 18 meses y multifocales a futuro. Se justifica por LTV, no por margen inicial.

### D.3 Garantía — texto canónico (helper único en `src/lib/`, patrón lab-frame-summary; consumido por ficha, configurador, landing y bot)
> **"Garantía de adaptación 30 días: si no te adaptás a tus multifocales, te cambiamos los cristales sin costo."** (letra chica en una frase: con nueva receta de tu oftalmólogo, hasta 90 días entre recetas)

Verificado en `src/lib/faq-data.ts:63-64`: aplica a Varilux multifocal y Super Blue monofocal, NO al resto — la home hoy promete de más. Debe aparecer: hero (línea fija), landing `/multifocales`, ficha de cristales, guion del bot ante CUALQUIER objeción de adaptación, 1 placa social/mes. Extensión barata: "primera semana de adaptación acompañada" = el followup `[POSVENTA]` vendido como servicio.

### D.4 Financiación (en orden de esfuerzo)
1. Costo cero: comunicar "6 cuotas sin monto mínimo" (hero, ficha, configurador, checkout) y "15% OFF por transferencia" arriba del fold — ya existen y no se dicen.
2. Cuota en pesos en el botón ("6 x $107.708") — en ticket alto la cuota ES el precio.
3. Mercado Pago Checkout Pro en paralelo (billetera dominante; sube conversión por confianza aun sin usarse — hipótesis +15-25% en checkout iniciado→pago junto con la cuota en pesos).
4. 9/12 cuotas SOLO multifocales (decisión financiera de la dueña): "tu multifocal en 9 cuotas de $71.805". Naranja visible si Payway la rutea.

### D.5 Urgencia honesta (reemplaza la falsa)
Sacar el "¡Solo por esta semana!" hardcodeado desde el 17/6. Poner solo lo verificable: (a) "queda 1 en este color" solo cuando `stock===1`; (b) ofertas rotativas con vencimiento REAL en `SystemSetting` con fecha; (c) urgencia de calendario legítima ("tu receta vence", Día de la Madre, vuelta a clases); (d) cupón QUIEROMISLENTES con expiración de 72h reales.

### D.6 Guion WhatsApp de cierre
Restricción: el prompt vive en `SystemSetting.bot_prompt` de PRODUCCIÓN (tocar prompts en código y deployar NO cambia nada); referencia en `wa-service/prompts/salesPrompt.js`.
- **Bot responde:** horario, ubicación, obras sociales (lista), precios "desde" por gama (leídos de la base, nunca hardcodeados en el prompt), garantía (texto canónico), pedir foto de receta, los 3 datos de calificación (¿receta a mano? ¿multifocal o primera vez? ¿obra social?), agendar/derivar. **Regla dura: el bot NUNCA da precio final, solo "desde"** — el presupuesto exacto es el gancho para que entre el humano.
- **Humano cierra (5 pasos):** (1) presupuesto en el día con 2 opciones máximo — gama media recomendada + entrada como alternativa, premium mencionado al pasar como ancla; (2) precio SIEMPRE con cuota: "$646.250, o 6 cuotas de $107.708 — y te llevás dos armazones"; (3) objeción adaptación → garantía 30 días textual; (4) objeción precio → bajar a entrada, JAMÁS descontar la media; (5) sin respuesta → lo cubren los 5 sistemas de followup existentes. CTA final siempre binario: "¿te lo reservo y pasás a medirte, o preferís seña por transferencia con el 15%?".

---

## Anexo E — Retención: detalle de flujos

Infraestructura heredada (verificada): ejecutor `wa-service/followups/smart-task-executor.js` (toma tareas vencidas +2h, redacta con Gemini `gemini-2.5-flash`, validador 50-250 chars / máx 45 palabras / sin "¿" / 1-2 emojis — `followups/config.js:137-139`); lista blanca `config.js:96` + filtro `smart-task-executor.js:145-157`; interruptor `followups_enabled` (`:129-132`); reclamo SENDING atómico (`:298-306`, recuperación a los 45 min, DONE solo si sigue SENDING `:347-353`); compuerta LLM (`:236-270`); `followUpPausedUntil`; `SIN_SEGUIMIENTO` en preflight (`sender.js:44-47`); Cold Contact Shield `inboundCount===0` (`:204-214`); horario `task-generator.js:9-12`; cupo preventa `MAX_NEW_TASKS_PER_DAY=25` (`config.js:61`, conteo `task-generator.js:101-103`). Los flujos de EMAIL no respetan `followups_enabled` — decisión: dejarlo así (el interruptor protege el número de WhatsApp, no la casilla). El CRM crea ClientTasks, el wa-service las ejecuta — separación que se mantiene. Firma: envío = Interaction con `userId: null, userName: 'Bot'` (BOT_ACTOR); crons sin envío = SYSTEM_ACTOR (modelo: `cart-recovery.service.ts:93-101`).

**Flujo 1 — Carrito (PRENDER, S):** `abandoned-carts/route.ts` completo (ventana 24-72h, guard "ya compró", una sola vez → EMAIL_SENT, cupón validado vía `src/lib/checkout/recovery.ts:24-36`). Alta en self-scheduler de `src/instrumentation.ts` (patrón `maybeRunDaily`, `:31-80`) o cron-job.org con Bearer CRON_SECRET; cerrar en el mismo toque el bypass `request.url.includes('localhost')` (`route.ts:18` — matchea `?x=localhost`) y el fallback `'atelier-cron-secret-key-2026'` (`route.ts:6`). Fase 2 (M): segundo cron a la 1h (estado `EMAIL_SENT_1H` o campo `recoveryStage`). Fase 3 (M): si la sesión tiene teléfono y el cliente chat con inbound (el checkout ya captura teléfono con debounce, `CheckoutClient.tsx:224-261`), ClientTask `[CARRITO] El cliente dejó un carrito con <modelo> por $<total> hace 1 día. Preguntale si tuvo alguna duda con la compra y ofrecele ayuda para terminarla. Cupón QUIEROMISLENTES disponible.` con `createdBy:'Sistema (Retención)'`; sin chat previo NO escribir (el Shield lo cancelaría). `ensureClientForAbandonedCart()` (`cart-recovery.service.ts:47`) ya crea/linkea la ficha con tag "Carrito Web". Métrica: % EMAIL_SENT con Order del mismo clientId/email ≤7 días (`hasClosedOrder`); instrumentar contador sent/recovered en la ruta.

**Flujo 2 — Posventa (M):** disparador `labStatus → DELIVERED` (mismo hook de la REVIEW_REQUEST, `order.service.ts:~1858-1874`); ClientTask `type:'TASK'`, `createdBy:'Sistema (Retención)'`, `dueDate = entrega + 10 días` (`pickSpreadDueDate`), solo con cristales (`OrderItem.eye IS NOT NULL`) y chat con inbound. Descripción: `[POSVENTA] <Nombre> retiró sus <multifocales/anteojos> hace 10 días. Preguntale cómo viene la adaptación y si necesita algún ajuste del armazón (el ajuste es sin cargo).` Mensaje modelo (cumple validador): *"Hola Marta! Cómo venís con los multifocales nuevos? Si sentís que algo no termina de acomodarse, pasate por el local que te los ajustamos sin cargo 😊"*. Encadenado: charla positiva sin reclamo (sin PostSaleCase en 72h, sin etiqueta de queja) → REVIEW_REQUEST a +3 días (mover del DELIVERED inmediato: mejora la tasa y evita pedir reseña a alguien con problemas); reclamo → PostSaleCase (`buildPostSaleCaseEmailHtml`). Sin cupo propio (volumen = entregas, decenas/mes).

**Flujo 3 — Reseña (S-M):** las tareas YA se generan (`ContactService.addReviewRequest`, `contact.service.ts:1305-1315`) con el link real `https://g.page/r/CcVls8v7ic_NEBM/review`, pero el texto vive hardcodeado en `TasksPanel.tsx:132-147` y el envío es manual. NO pasar por Gemini: **plantilla fija** por `sendFollowUp()` directo (mismo camino que `notifyOrderReady`), rama nueva en el ejecutor para `type:'REVIEW_REQUEST'` que saltea la generación; mover el texto de `TasksPanel.tsx:147` a constante compartida o SystemSetting. Un solo envío, jamás insistir (dedup ya existe). Local: 54 COMPLETED / 12 PENDING, 0 ProductReview. Éxito secundario: persistir respuestas como ProductReview → aggregateRating LEGÍTIMO por ficha (reemplazo del self-serving que B7 elimina) → estrellas en SERP/Shopping → slide testimonio en el feed.

**Flujo 4 — Renovación (M, el mayor ROI):** generador nuevo junto a `task-generator.js` (preferible en wa-service: ya tiene ventana horaria y patrón). Query: última Order SALE no eliminada con `OrderItem.eye IS NOT NULL` por cliente, `createdAt` 12-18 meses atrás, sin Order de cristales posterior, sin ClientTask de retención PENDING/SENDING, sin SIN_SEGUIMIENTO, con chat con inbound. Tarea: `[RENOVACION] <Nombre> compró <multifocales> hace ~14 meses. Sugerile renovar el control de la vista: la graduación suele cambiar en ese plazo y el control en el local es sin cargo. Ofrecele coordinar un turno.` Mensaje modelo: *"Hola Jorge! Ya pasó más de un año de tus multifocales y la graduación suele moverse en ese tiempo. Querés pasar por el local a hacer un control? Es sin cargo 😊"*. Cupo propio `RENOVACION_MAX_PER_DAY=10` (conteo en base, vale entre reinicios). Clientes SIN chat: `[RENOVACION MANUAL]` (prefijo NO whitelisted) al panel del CRM para un humano — que el ejecutor los cancele en silencio es perder la mitad del valor. Interaction `type:'FOLLOWUP'` content `[RENOVACION]` → atribución por clientId + fecha.

**Flujo 5 — Cumpleaños (DIFERIDO):** `Client.birthDate` existe (`schema.prisma:36`) pero 2/1096 cargados. Prerequisito S: capturar fecha (checkout "para tu descuento de cumpleaños", extracción pasiva del bot, mostrador al retirar). Con >200 fechas: mismo patrón que renovación, `[CUMPLE] Saludá a <Nombre> por su cumpleaños y ofrecele 15% en un segundo par este mes.`

**Flujo 6 — Segundo par (M, mes 2):** 30-45 días post-DELIVERED de cristales, si posventa sin problemas. Oferta natural: sol con su receta (fricción cero, receta ya cargada). Tarea: `[SEGUNDO PAR] <Nombre> retiró sus multifocales hace un mes. Ofrecele hacer un par de sol con su misma receta con 15% off presentando este mensaje.` Cupón generado desde la base (compatible R6, reusable por cumpleaños). Un solo toque; exclusión mutua con renovación.

---

## Aprobaciones que necesita dar la dueña (consolidado)

1. OK a la reasignación de §4.3: **mismo techo de gasto, ~$902.000/mes netos (−24% vs los ~$1.181.000 actuales)**, sin plata nueva. Confirmar el bruto (neto + IVA 21% + percepciones).
2. Pausar **solo** `Campaña de Tráfico en Instagram` (cuenta USD) y las dos PMax/Maps de Google. **La cuenta USD NO se pausa** — ahí vive el motor de 454 conversaciones a $771 (§4.2, corrección 2).
3. Texto y condiciones vigentes del 2x1 y de la garantía (cumplibles tal como se leen; alinear con lo que publica el subdominio promo antes del 301).
4. Obras sociales: ¿convenios activos? (define sitelink, grupo de keywords, placa y footer).
5. Claim "control/medición sin cargo" (placas `renova-tu-receta` y flujo `[RENOVACION]`).
6. Decisiones de negocio del mes 2: escalera de precios + ofertas rotativas, MP Checkout Pro, 9/12 cuotas multifocales, cupón de segundo par.
7. Verificaciones contra PRODUCCIÓN (solo SELECT) para precios de landing/placas y dimensionado de la cohorte de renovación.
8. OK final por etapa: campañas creadas en pausa → revisión conjunta en Ads Manager → activación; nada se publica en redes sin `--facebook --instagram` explícito.

**Referencias:** `docs/plan-campanias-meta-google.md` · `docs/estrategia-busquedas-locales.md` (manda donde difieren) · `docs/buenas-practicas-meta-google.md` · `docs/plan-publicacion-meta.md` · `docs/cronograma-social-agosto-2026.md` · `docs/LANZAMIENTO-CLOUDFLARE.md` · `scripts/ads/manage.js` + `scripts/ads/CLAUDE.md` · `src/lib/ads/meta-insights.ts:59` · `src/app/api/cron/ads-report/route.ts:164-254` · `social/contenido/ad-l*.json` + `public/social/` (creativos listos) · `wa-service/followups/` (pipeline de retención).
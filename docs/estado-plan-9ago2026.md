# Estado del plan · auditado contra el código el 9/8/2026

> Verificado por 6 lectores independientes sobre el código real (no sobre los mensajes de commit).
> 82 ítems. Fuente: docs/plan-maquina-de-vender.md

## Estado del plan en una tabla

| Bloque | Hechos | Parciales | Pendientes | Total |
|---|---:|---:|---:|---:|
| Bloqueantes (B1–B15) | 6 | 3 | 6 | 15 |
| Quick wins (QW1–QW15 + deploy) | 5 | 2 | 9 | 16 |
| Estructurales (E1–E9) | 0 | 2 | 7 | 9 |
| Retención (flujos 1–8 + infra 1–3) | 3 | 1 | 7 | 11 |
| Medición y paneles (sin duplicados con B1/B3/B4/B9) | 10 | 1 | 4 | 15 |
| Social y placas (sin duplicados con B11/B12) | 1 | 0 | 15 | 16 |
| **Total (deduplicado)** | **25** | **9** | **48** | **82** |

**Advertencia que atraviesa todo el informe: nada de lo "hecho" está en producción.** `git cherry -v origin/main` = 34 commits sin deployar, incluidos los que resuelven B1, B3, B4, B7, B8, B11 y los 6 quick wins marcados hechos. Hoy no le mueven la aguja a ningún visitante real.

---

## ✅ Hecho y verificado

**Bloqueantes**
- B1 — banner de cookies de ~190px a ~76px, deja de tapar los CTAs del hero. `src/components/Storefront/CookieConsent.tsx:73-93` (commit bb25f2bd)
- B3 — Purchase server-side en las 3 ramas de checkout, `transaction_id = orderId`. `src/app/api/checkout/payway/route.ts:171,850,893,1157` + `src/app/checkout/CheckoutClient.tsx:363,496` + `src/lib/tracking.ts:228` (197f4c1b)
- B4 — Consent Mode v2 con los 6 estados denegados por defecto y `wait_for_update:500` antes de los `config`. `src/components/Storefront/TrackingScripts.tsx:112-146` (53edf8f9). *Ojo: la §0 del plan NO lo lista como hecho — está hecho.*
- B7 — `aggregateRating` 5.0/677 eliminado de las 4 páginas. `src/lib/schema.ts:14`, `src/app/page.tsx:88`, `nuestro-local/page.tsx:41`, `optica-cordoba/page.tsx:95`, `resenas/page.tsx:108` (de00a1b5)
- B8 — 301 de las doorways `/blog/busquedas/` + salida del sitemap en el mismo commit. `src/app/blog/busquedas/[query]/page.tsx:34-43` + `src/app/sitemap.ts:186-191` (de00a1b5)
- B11 — UTMs en el pipeline social. `scripts/social/publicar.mjs:45-54,213` (7f2119c8)

**Quick wins**
- QW1 — CTAs mobile destapados. `CookieConsent.tsx:73,86,88,97,103`
- QW4 — carrusel del hero con crossfade a negro + CTAs fuera del bloque que rota. `FilmmakerReel.tsx:139-173,262-280`
- QW5 — og:image AVIF→WebP en fichas. `src/app/producto/[slug]/page.tsx:161-167,181-195`
- QW6 — FloatingWhatsApp con delay 1,5s, etiqueta "Presupuesto" y no se monta sobre `[data-hero]`. `FloatingWhatsApp.tsx:31-44,157`
- QW7 — microcopy del checkout 4/4 (cuotas reales, urgencia falsa borrada, transferencia con importe/alias/nº de pedido, DNI opcional). `CheckoutPaymentOptions.tsx:14,22-29,133-136`, `CheckoutShippingForm.tsx:54,87`, `CheckoutClient.tsx:565-624`, `CheckoutContactForm.tsx:45-56` (fb773143)

**Retención**
- flujo-3 — whitelist de tareas auto-enviables + firma `Bot`. `wa-service/followups/config.js:96-115`, `smart-task-executor.js:153,157,368` (b5a1b2d0). *Habilitante vacío: hoy ningún productor emite esos prefijos.*
- infra-1 — interruptor `followups_enabled` con 3 puntos de corte. `wa-service/index.js:158-168`, `smart-task-executor.js:130-133`, `src/app/api/cron/followups/route.ts:24-32`
- infra-2 — patrón SENDING anti-pérdida (reclamo atómico, recuperación de zombies, claimStamp verificado en el envío físico). `smart-task-executor.js:303-311,144,161,353-380`, `sender.js:127-140`, `anti-ban.js:42`

**Medición y paneles**
- B4b — se mide el punto ciego del consentimiento. `CookieConsent.tsx:34,64`, `src/lib/analytics.ts:30-31`
- Embudo cliente completo con eventId de dedup + `whenTagReady()` (era el motivo de que las fichas nunca mandaran ViewContent). `src/lib/tracking.ts:20-259` + call sites
- Espejo CAPI del embudo. `src/app/api/web/track/route.ts:34-83` → `src/services/ads.service.ts:167-219`
- Lectura de gasto Meta (2 cuentas, USD→ARS por blue, secuencial a propósito). `src/lib/ads/meta-insights.ts:37-153`
- Lectura de gasto Google (GAQL, devuelve null y no 0 si falla). `src/services/google-ads.service.ts:313-357`
- Techo mensual de inversión con proyección y degradación a "atención". `src/services/ads-budget.service.ts:63-138` + `GrowthPanel.tsx:97-122` + `ads-report/route.ts:293-312`
- Panel "Salud de la medición". `MeasurementHealth.tsx` + `growth.service.ts:53-196` + `ads.service.ts:229-311`
- Panel "Crecimiento mes a mes" (cobrado desde `Payment`, respeta la regla de `Order.paid`). `growth.service.ts:206-292`
- Panel de embudo `/admin/analitica`. `AnalyticsDashboard.tsx` + `api/admin/analytics/route.ts:39-172`
- Panel de Atribución. `admin/analitica/atribucion/page.tsx` + `attribution.service.ts:1-90`

**Social**
- Las 12 piezas `[YA]` + los 8 reels del calendario existen todos en `social/contenido/` y `social/contenido/reels/`.

---

## 🟡 A medias

| Ítem | Qué está | Qué falta | Esf. |
|---|---|---|---|
| **B2** conversiones primarias Google | La etiqueta NO está cargada (correcto) y hay guardián que avisa si alguien la carga: `growth.service.ts:142-153` | Pasar a secundarias las 5 acciones locales + `Tiendanube Website purchases` **en el panel de Google Ads**. **Grieta:** `src/app/layout.tsx:108` sigue cableando `GOOGLE_ADS_CONVERSION_LABEL` — si alguien la carga en Railway vuelve el doble conteo; el guardián avisa, no bloquea | S |
| **B9** conversiones offline | Service correcto (hash, dedupe por orderId, validateOnly) `google-ads.service.ts:162-299`; caller vivo en `order.service.ts:1640-1652` | (1) el caller no pasa gclid/wbraid/gbraid aunque el gclid está guardado (`client-analytics.ts:105`, `payway/route.ts:190`); (2) faltan `GOOGLE_ADS_UPLOAD_CONVERSIONS` y `GOOGLE_ADS_OFFLINE_CONVERSION_ACTION` + crear la acción en Google Ads; (3) sin corrida VALIDATE_ONLY; (4) solo cubre ventas del CRM | M |
| **B14** desindexar CRM railway | `X-Robots-Tag: noindex` por host ya existía. `src/middleware.ts:21-26,207-209` | No hay removal en Search Console ni 410/301 activo. **No tocar** `next.config.ts:75` (el 301 por host está a propósito detrás de `DOMAIN_CUTOVER`; activarlo antes del cutover DNS deja la tienda inaccesible) | S |
| **QW3** multifocal arriba | Línea fija en el hero (`FilmmakerReel.tsx:245-259`) e ítem de nav desktop (`StorefrontNavbar.tsx:184-188`) | El ítem es `hidden lg:block` (`:181`) → **no se ve en celular**, que es el 100% del tráfico pago; el menú mobile sigue diciendo "Cristales" (`:230-237`); apunta al interino `/cristales-opticos` porque B6 no existe | S |
| **QW10** 2x1 y cuotas en la ficha | Las cuotas ya estaban desde julio (`PaymentOptions.tsx:47,60-62`) | El flag `is2x1` no viaja al storefront (`grep is2x1` solo da admin y tipos): falta exponerlo en el payload + badge "2º armazón bonificado" + línea "se hace de sol con tu receta" | S |
| **E7** escalera de precios | El mecanismo entero funciona: `schema.prisma:291`, editor `admin/web/page.tsx:2179-2183`, precio tachado `ProductClient.tsx:139,847-849`, JSON-LD `page.tsx:338` | Los datos: 2 escalones para 111 productos (160k×94, 200k×17) y 1 solo `salePrice` cargado. No existe rotación automática | M |
| **E8** sol con receta | Campo `frameHeight` existe y es editable (`schema.prisma:273`, `inventario/page.tsx:1272`) | 19/111 medidos (faltan 92); no existe badge "Apto multifocal", ni filtro en `ProductFilters.tsx:88-92`, ni banner. **Trampa:** `GlassesDiagram.tsx:51` inventa la altura con `lensWidth*0.8` — el badge tiene que leer el campo crudo o marca aptos armazones nunca medidos | L |
| **flujo-1** carrito abandonado | Lógica completa y auth ya corregida: `abandoned-carts/route.ts:25-85`, `recovery.ts:21-88`; cupón `QUIEROMISLENTES` vivo | **Nadie lo dispara**: `instrumentation.ts:145-150` solo agenda smartlab-sync y lab-invoices; `vercel.json` no lo ejecuta Railway. Falta el alta + el contador sent/recovered (hoy es un `console.log`) | S |
| **google-conv-web** | Código completo: `TrackingScripts.tsx:98-107`, `tracking.ts:193-256` | Faltan cargadas `GOOGLE_ADS_WHATSAPP_LABEL`, `GOOGLE_ADS_CALL_LABEL`, `NEXT_PUBLIC_GOOGLE_ADS_TAG_ID`, `NEXT_PUBLIC_GA_ID`. Con el id vacío **ninguna conversión de Google se dispara**. La de compra vacía es lo correcto (B2) | S |
| **7-b12-crons** social | Las 3 rutas existen y están completas | El alta en el scheduler — mismo agujero que mató el cron de carritos | S |

---

## ⛔ Pendiente

### A) Se puede hacer ya (solo código)

Ordenado por impacto en ventas.

| # | Ítem | Qué es | Esf. |
|---|---|---|---|
| 1 | **B6** landing `/multifocales` | Hoy 404. La campaña existe (`campaigns.ts:212-251`) pero `landing/[slug]/page.tsx:34` pone `robots:{index:false}` a todas — promover `/landing/multifocales` deja el head term sin indexar. Falta también el ancla "completo desde $X" vía PricingService | M |
| 2 | **7-regenerar-base** ⏰ | Las 3 piezas con precio tienen `generadoEl: 2026-08-06` y el cron corta a los 10 días (`social-feed/route.ts:168-192`): **receta-seleccion del 22/8 y armazones-destacados del 5/9 NO van a publicar**. Correr `generar-producto.mjs` | S |
| 3 | **QW8** receta fake | El dropzone guarda el File y `LensConfigurator.tsx:548,567` mandan solo `.name` — los bytes se tiran. Reemplazar por botón wa.me precargado | S |
| 4 | **B5** chat→clientId | `bot/messages/route.ts:76-84` crea el chat sin `clientId`; los 10 chats con adTag tienen los 10 el clientId en NULL → el ROAS por anuncio subestima (`ads-report/route.ts:134-139`). Causa raíz viva: la extracción pasiva se agenda con `setTimeout` en un Map en memoria (`wa-service/index.js:1793`) y se pierde en cada reinicio | M |
| 5 | QW3 (mobile) + QW10 badge 2x1 | Ver "A medias" | S |
| 6 | **E3** sacar `priority` de los thumbs | `HomeProductCarousel.tsx:169,185` — 6 preloads compitiendo con el LCP del hero. Una línea | S |
| 7 | **flujo-2** reseña automatizada | Las tareas se crean pero el ejecutor nunca las levanta (ni el `type` ni el `createdBy` matchean, `smart-task-executor.js:150-158`). Incluye mover el texto duplicado en 4 archivos a una constante | M |
| 8 | **infra-3** exclusión mutua 14 días | Prerequisito de prender el **segundo** flujo, o dos crons le escriben al mismo cliente en la misma semana | S |
| 9 | **flujo-4** posventa a 10 días + reseña encadenada | Nada construido; el hook DELIVERED existe (`order.service.ts:1858-1875`) | M |
| 10 | **E9** tracking post-pago | `trackingNumber` no existe en todo el repo. Hoy el cliente cobrado no recibe nada hasta el retiro. La cañería se clona de `notifyOrderReady` (`bot.service.ts:158-271`) | M |
| 11 | **E1** ISR de /tienda, /lentes-de-sol, /receta | Los tres declaran `revalidate` pero `cookies()` y `searchParams` fuerzan render dinámico: letra muerta | M |
| 12 | **E2** downscale de imágenes | 150 de 151 AVIF > 1600px (hasta 6064×4640) y 167 WebP igual de grandes. 31MB en `public/`. sharp ya está declarado | M |
| 13 | **QW11** cross-sell por afinidad | `producto/[slug]/page.tsx:271-283` ordena por `isFeatured`/`createdAt`, cero afinidad | M |
| 14 | **QW9 (a) y (c)** | (c) es **una línea**: sumar Obras Sociales al `StorefrontFooter.tsx` principal. (a) crear `src/lib/garantia.ts` — el texto está duplicado a mano en 6 archivos | S |
| 15 | **pageview-spa** | `fbq('track','PageView')` solo en la primera carga (`TrackingScripts.tsx:182`) → públicos de remarketing por URL más chicos de lo real | S |
| 16 | **evento-search** + **B4b panel** | `search` declarado y jamás disparado (`analytics.ts:19`); y falta el cociente aceptó/rechazó/ignoró en `MeasurementHealth.tsx:143-151` | S |
| 17 | **huecos-medicion** | LensConfigurator, CustomGlassesBuilder, HomeRecommendationQuiz y ExitIntentPopup no llaman a `track()`. No se sabe dónde abandona la gente el producto de $834k | M |
| 18 | Social: **plantilla `testimonio`** (M) + **`generar-multifocal.mjs`** (L) + 4 piezas nuevas a mano (S c/u) + guarda de frescura en stories (S) + campo `cta` (M) + los 8 slots del calendario (S) | `plantillas.mjs:55-99` tiene solo 4 tipos. **Hallazgo fuera del plan:** las 13 story-producto publican precios sin `generadoEl` ni guarda de frescura → un precio viejo puede salir indefinidamente | varios |
| 19 | **flujo-6** carrito multi-toque, **flujo-8** captura de birthDate en checkout (2/1096 fichas la tienen) | Depende del flujo 1 prendido | M / S |

### B) Bloqueado por una decisión o acción de la dueña

| Qué se necesita de ella | Desbloquea |
|---|---|
| **OK para mergear a `main` y deployar los 34 commits** | B1, B3, B4, B7, B8, B11 y los 6 quick wins. Es el bloqueo más caro: todo eso está escrito y no lo ve nadie |
| **Dar de alta los crons** en cron-job.org con Bearer `CRON_SECRET` (ads-report, abandoned-carts, social-feed, social-story-diaria, social-cadencia, y verificar pickup-reminder / overdue-balances) | B12, flujo-1, cron-alta, §7 entera. El código está listo; Railway no ejecuta `vercel.json` |
| **En Google Ads:** pasar a secundarias las 5 acciones locales + `Tiendanube Website purchases`; crear la acción de conversión offline | B2, B9 |
| **Cargar en Railway** `GOOGLE_ADS_WHATSAPP_LABEL`, `GOOGLE_ADS_CALL_LABEL`, `NEXT_PUBLIC_GOOGLE_ADS_TAG_ID`, `NEXT_PUBLIC_GA_ID`, `GOOGLE_ADS_UPLOAD_CONVERSIONS`, `GOOGLE_ADS_OFFLINE_CONVERSION_ACTION` | google-conv-web, B9 |
| **Alta en Merchant Center** — usar la URL real `/feed/google.xml` (singular; el plan dice `/feeds/`) | B10 |
| **Cloudflare:** pasar el registro a naranja + SSL Full strict + Cache Rules. Verificado hoy: NS ya están en Cloudflare pero `curl` devuelve `server: railway-hikari`, sin `cf-ray` → hoy es DNS-only | QW12 |
| **301 de `promo.atelieroptica.com.ar`** — no se resuelve desde este repo, hay que tocar el hosting/DNS donde vive. Riesgo vigente: promos no verificables (2x1, 15% OFF) en la SERP de marca con anuncios activos | B13 |
| **Removal en Search Console** del subdominio railway.app | B14 |
| **Editar el nombre del perfil de Google Business** (sacar el eslogan) — el plan lo condiciona a que cierre la ventana de 21 días del experimento de Maps | QW13 |
| **Autorización para leer/escribir la base de PRODUCCIÓN**: (a) limpiar "⏳ PREVENTA ~1 semana" de las descripciones; (b) aplicar el lote de 114 fichas SEO + reactivar Venus C1/C2/C2-1 y Selene C4/C5. **Aviso:** el README declara que 48 de esas fichas nunca pasaron el verificador adversarial | QW2, QW15 |
| **¿Qué convenios de obras sociales están activos?** | B15, sitelink, keywords vs negativas, placa `obras-sociales` |
| **Nombre y nº de matrícula del director técnico** | QW9(b) |
| **Definir si el `<title>` de la home lleva "Córdoba"** — hoy no lo tiene desde junio, pero og:title y twitter:title sí dicen "Córdoba": quedan inconsistentes en cualquiera de las dos lecturas | QW14 |
| **Cuotas:** alta de Mercado Pago, acuerdo de 9/12 con banco/Naranja y a qué productos aplica | E4 (L) |
| **Turnos online:** qué horarios, quién atiende, Calendly vs propio | E5 |
| **Cargar el inventario de mostrador SKU por SKU** (o aceptar productos genéricos). El patrón se extendió el 2/8 con `cargar-armazones-sol-agosto-2026.mjs`, un SKU por marca | E6 |
| **Definir la escalera de precios y qué 3-5 productos van en oferta** — el código ya está listo para recibirlos | E7, pieza `oferta-semana` |
| **Medir 92 armazones en el local** (frameHeight) | E8 |
| **Aprobar el claim "control sin cargo"** + SELECT autorizado en prod para dimensionar la cohorte | flujo-5 renovación |
| **Aprobar el cupón de segundo par (15%)** | flujo-7 |
| **Elegir qué reseñas de Google se citan** en las placas de testimonio | 2 piezas de social |

---

## Lo que más mueve la aguja ahora

1. **Deployar los 34 commits.** Seis quick wins de conversión, el Purchase server-side, el Consent Mode y las 46 doorways corregidas están escritos y no los ve ningún visitante. Es la única acción con ROI inmediato y costo cero de desarrollo.
2. **Dar de alta los crons.** Sin esto, el carrito abandonado nunca recupera un peso, la dueña no recibe el tablero diario de gasto y el calendario social de 8 semanas no publica nada. El código está terminado hace días esperando un alta de 20 minutos en un panel.
3. **Regenerar las 3 piezas con precio (⏰ antes del 22/8) y cargar las labels de WhatsApp/Llamada en Railway.** Dos vencimientos con reloj: dos publicaciones programadas se van a saltear solas por la guarda de frescura, y hoy Google no recibe *ninguna* conversión del sitio, así que la pauta se optimiza a ciegas.
4. **B5: vincular chat→cliente.** Todo el panel de atribución y el ROAS por anuncio están construidos pero subestiman, porque los 10 chats con adTag tienen el clientId en NULL. Sin esto no se puede decidir qué anuncio apagar. Incluye arreglar el `setTimeout` en memoria que se pierde en cada reinicio del bot.
5. **La landing `/multifocales` + el ítem de nav visible en mobile.** El producto de mayor ticket manda su tráfico pago a un 404, y el único link de "Multifocales" está oculto en celular, que es donde entra el 100% de ese tráfico.

*Fuera del top 5 pero con la mejor relación esfuerzo/impacto: QW8 (la receta que se tira a la basura), E3 (una línea, LCP del hero) y QW9(c) (una línea, link a Obras Sociales).*
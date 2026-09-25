# Conversiones offline hacia Google Ads: las ventas del mostrador que empezaron con un anuncio

**Qué resuelve.** Google ve el clic en el anuncio y nunca se entera de que terminó
en una venta, porque el cierre pasa por WhatsApp o en el local. Sin esto, las
campañas de Search pujan contra "cómo llegar" y clics de llamar. Con esto, cada
venta cerrada del CRM que empezó con un clic de Google se sube a Google con su
importe, y Google la une al anuncio exacto.

Decidido por Ishtar el 25/9/2026. Construido en la rama `feat/google-conversiones-offline`.

## Las tres piezas

1. **La acción de conversión "Venta (CRM)"** en Google Ads, del tipo que acepta
   cargas desde afuera. Se crea con
   `scripts/maintenance/google-ads/crear-accion-venta-crm.cjs`. Nace
   **secundaria**: mide, no cambia la puja (hacer que Google optimice por ella
   reinicia el aprendizaje; es otra decisión, se toma en el panel con datos).
2. **El hilo entre el clic y la persona.** Cuando alguien toca un anuncio de
   Google, la visita trae un id de clic (`gclid`; `wbraid`/`gbraid` en iOS). La
   landing lo mete en el mensaje de WhatsApp junto a la etiqueta de campaña:
   `— Campaña: recetados · origen: google-ads [googlerecetados] [gclid:Cj0K…]`
   (`src/lib/landing/wa-attribution.ts`). Los sitelinks que van derecho al chat
   hacen lo mismo con el ValueTrack `{gclid}`
   (`scripts/maintenance/google-ads/sitelinks-agregar-gclid.cjs`). El mensaje
   queda guardado en `WhatsAppMessage.content`, así que el id ya está
   persistido sin columna nueva. La vendedora y el bot no lo ven:
   `stripAdTags()` lo saca en los dos parsers (`ad-tag-core.ts` y su espejo
   `wa-service/shared/ad-tag.js`; `npm run check:adtag` falla si divergen).
3. **La subida diaria**: `GET /api/cron/google-conversiones` busca las ventas
   cerradas en los últimos 10 días, les encuentra el clic en los mensajes del
   cliente y las sube con importe (`src/services/google-offline-conversions.service.ts`
   → `GoogleAdsService.uploadOfflineConversion`).

## Qué cuenta como venta, cuándo y por cuánto

Mismas reglas que el resto del sistema (CLAUDE.md), probadas en
`npm run check:google-conv`:

- Venta = plata cobrada (filas de `Payment`) **o** pedido en laboratorio. Nunca
  `Order.paid` ni el total a secas.
- Cierre = envío a fábrica si lo hubo; si no, el primer pago.
- Valor = el total de la venta (Google puja por valor; una seña diría que el
  anuncio vale seis veces menos). Sin total cargado, lo cobrado.
- Clic = el último mensaje entrante con id de clic anterior al cierre y dentro
  de los 90 días de ventana de Google. Con dos clics gana el más reciente.
- Qué queda afuera: la persona que entró al local sin haber tocado nunca un
  anuncio, y los chats anteriores al deploy (no llevan el id). Está bien que
  no se unan a nada.

## Cómo se prende (una sola vez)

1. Crear la acción:
   `GOOGLE_ADS_ALLOW_WRITES=1 node --env-file=.env scripts/maintenance/google-ads/crear-accion-venta-crm.cjs --aplicar`
   (imprime el id).
2. En Railway, servicio CRM-Atelier: `GOOGLE_ADS_OFFLINE_CONVERSION_ACTION=<id>`
   y `GOOGLE_ADS_UPLOAD_CONVERSIONS=1`. Cambiar variables reinicia la app.
   Sin las dos, el cron responde `bloqueo` y no sube nada.
3. Sitelinks con clic:
   `GOOGLE_ADS_ALLOW_WRITES=1 node --env-file=.env scripts/maintenance/google-ads/sitelinks-agregar-gclid.cjs --aplicar`.
4. Probar en seco contra producción (Google valida y no registra):
   `https://atelieroptica.com.ar/api/cron/google-conversiones?seco=1&secret=<CRON_SECRET>`.
   Un `ok:true` con `conClic: 0` es normal los primeros días: solo cuentan los
   chats que entraron después del deploy.
5. Alta en cron-job.org, como los demás crons: diario, 10:00 Argentina,
   `GET https://atelieroptica.com.ar/api/cron/google-conversiones` con header
   `Authorization: Bearer <CRON_SECRET>`.

## Dónde se ve

- En el CRM: `AuditLog` con `action = GOOGLE_CONVERSION` por cada venta subida
  (valor, cierre, tipo de clic, campaña). Es también lo que evita subirla dos
  veces (Google además desduplica por `orderId`).
- En Google Ads: Objetivos → Conversiones → "Venta (CRM)". Las conversiones
  offline tardan hasta 48 h en aparecer en los informes.
- La respuesta del cron: `ventas`, `conClic`, `subidas`, `yaSubidas`,
  `sinClic`, `errores`, `bloqueo`.

## Checks

- `npm run check:google-conv` — las reglas, sin base ni red.
- `npm run check:google-conv-base` — el service en seco contra la base local.
- `npm run check:landing` — la línea del WhatsApp lleva etiqueta y clic, y los
  dos parsers la leen y la limpian.
- `npm run check:adtag` — los dos parsers no divergen.

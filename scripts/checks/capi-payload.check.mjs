// ────────────────────────────────────────────────────────────────────────────
// Verificación del armado de eventos del Conversions API de Meta (AdsService).
// SIN RED: se mockea `fetch` y se inspecciona el payload exacto que saldría
// hacia graph.facebook.com. Importa el service REAL, no una copia de su lógica.
//
// Qué protege:
//  - Los datos personales (email, teléfono, nombre) salen SIEMPRE hasheados
//    con SHA-256 y normalizados como pide Meta — nunca en claro.
//  - El teléfono se normaliza a E.164 sin '+' (549…) con el canon argentino
//    de phone-utils: el mismo número tipeado de dos formas hashea igual.
//  - `event_id` viaja intacto (dedup con el Pixel del navegador: Purchase usa
//    order.id; el embudo usa el eventId que nació en src/lib/tracking.ts).
//  - Sin credenciales configuradas no se manda nada (fail-quiet).
//  - Un evento de embudo sin ninguna señal del navegador se descarta.
//
// Correr:  npm run check:capi
//   (node --experimental-strip-types --import ./scripts/checks/_alias.mjs
//    scripts/checks/capi-payload.check.mjs)
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { AdsService } from '../../src/services/ads.service.ts';

let passed = 0;
const check = (name, cond) => {
  assert.ok(cond, `FALLÓ: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
};

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const esHashHex = (v) => Array.isArray(v) && v.length === 1 && /^[0-9a-f]{64}$/.test(v[0]);

// ── Mock de fetch: captura cada request en vez de salir a la red ──
const llamadas = [];
globalThis.fetch = (url, opts) => {
  llamadas.push({ url: String(url), body: JSON.parse(opts?.body ?? '{}') });
  return Promise.resolve({ json: async () => ({ events_received: 1 }) });
};

console.log('\nPayload del Conversions API de Meta (sin red)\n');

// ── 1. Fail-quiet: sin credenciales, NADA sale ──
delete process.env.META_ACCESS_TOKEN;
delete process.env.META_PIXEL_ID;

await AdsService.sendWebPurchase({
  id: 'orden-sin-credenciales',
  total: 1000,
  client: { email: 'x@x.com', phone: '351 6123456', name: 'X X' },
});
await AdsService.sendWebFunnelEvent('ViewContent', {
  eventId: 'ev-x',
  matchData: { fbp: 'fb.1.1.1' },
});
check('sin META_ACCESS_TOKEN/META_PIXEL_ID no se manda nada (fail-quiet)', llamadas.length === 0);

// ── Credenciales de mentira para el resto de los casos ──
process.env.META_ACCESS_TOKEN = 'token-de-prueba-jamas-real';
process.env.META_PIXEL_ID = '111222333444555';

// ── 2. Purchase web completo ──
await AdsService.sendWebPurchase(
  {
    id: 'orden-capi-check-1',
    total: 185000,
    client: {
      email: '  Compradora.CAPI@Ejemplo.com ',
      phone: '0351 15 612-3456',
      name: 'María José Pérez',
      firstName: 'María José',
      lastName: 'Pérez',
    },
    createdAt: new Date('2026-09-01T12:00:00Z'),
  },
  {
    eventSourceUrl: 'https://atelieroptica.com.ar/checkout',
    matchData: {
      fbc: 'fb.1.1725000000.IwAR-click-de-prueba',
      fbp: 'fb.1.1725000000.1234567890',
      clientIp: '181.10.20.30',
      userAgent: 'Mozilla/5.0 (prueba)',
    },
  },
);

check('el Purchase salió (1 request)', llamadas.length === 1);
const compra = llamadas[0];
const eventoCompra = compra.body.data?.[0];

check('URL: graph.facebook.com v24.0 /{pixel}/events', compra.url === 'https://graph.facebook.com/v24.0/111222333444555/events');
check('el token va en el body, nunca en la URL', !compra.url.includes('token') && compra.body.access_token === 'token-de-prueba-jamas-real');
check('event_name = Purchase', eventoCompra?.event_name === 'Purchase');
check('action_source = website', eventoCompra?.action_source === 'website');
check('event_id = order.id (dedup con el Pixel del navegador)', eventoCompra?.event_id === 'orden-capi-check-1');
check('event_source_url presente', eventoCompra?.event_source_url === 'https://atelieroptica.com.ar/checkout');
check('custom_data: ARS + valor + order_id', eventoCompra?.custom_data?.currency === 'ARS' && eventoCompra?.custom_data?.value === 185000 && eventoCompra?.custom_data?.order_id === 'orden-capi-check-1');
check('event_time en segundos (no ms)', eventoCompra?.event_time === Math.floor(Date.parse('2026-09-01T12:00:00Z') / 1000));

const ud = eventoCompra?.user_data ?? {};
check('em hasheado = sha256(email normalizado)', esHashHex(ud.em) && ud.em[0] === sha256('compradora.capi@ejemplo.com'));
check('ph hasheado = sha256(E.164 sin +: 5493516123456)', esHashHex(ud.ph) && ud.ph[0] === sha256('5493516123456'));
check('fn hasheado = sha256("maria jose") (minúsculas, sin tildes)', esHashHex(ud.fn) && ud.fn[0] === sha256('maria jose'));
check('ln hasheado = sha256("perez")', esHashHex(ud.ln) && ud.ln[0] === sha256('perez'));
check('fbc/fbp van en claro (lo exige CAPI)', ud.fbc === 'fb.1.1725000000.IwAR-click-de-prueba' && ud.fbp === 'fb.1.1725000000.1234567890');
check('IP y user-agent presentes', ud.client_ip_address === '181.10.20.30' && ud.client_user_agent === 'Mozilla/5.0 (prueba)');

// Ningún dato personal en claro en TODO el payload serializado. Los textos
// buscados tienen caracteres no-hex, así que no pueden aparecer por azar
// dentro de un hash.
const serializado = JSON.stringify(compra.body);
for (const crudo of ['Ejemplo.com', 'ejemplo.com', '612-3456', 'María', 'maría', 'Pérez', 'pérez']) {
  check(`sin dato en claro: "${crudo}"`, !serializado.includes(crudo));
}

// ── 3. El mismo teléfono escrito distinto hashea IGUAL ──
await AdsService.sendWebPurchase({
  id: 'orden-capi-check-2',
  total: 1,
  client: { email: 'a@b.com', phone: '+54 9 351 612-3456', name: 'A B' },
});
const ph2 = llamadas[1].body.data[0].user_data.ph;
check('"+54 9 351 612-3456" y "0351 15 612-3456" producen el mismo ph', ph2?.[0] === ud.ph[0]);

// ── 4. Un teléfono basura no se manda (hashearlo no matchea a nadie) ──
await AdsService.sendWebPurchase({
  id: 'orden-capi-check-3',
  total: 1,
  client: { email: 'a@b.com', phone: '123', name: 'A B' },
});
check('teléfono incompleto ("123") queda afuera del user_data', llamadas[2].body.data[0].user_data.ph === undefined);

// ── 5. Conversión offline: split del nombre completo de la ficha del CRM ──
await AdsService.sendOfflineConversion({
  id: 'orden-capi-check-4',
  total: 90000,
  client: { email: 'c@d.com', phone: '351 612 3456', name: 'Juan Ignacio Núñez' },
});
const offline = llamadas[3].body.data[0];
check('offline: action_source = physical_store', offline.action_source === 'physical_store');
check('offline: fn = sha256("juan") (1ª palabra del nombre completo)', offline.user_data.fn?.[0] === sha256('juan'));
check('offline: ln = sha256("ignacio nunez") (el resto, sin tildes)', offline.user_data.ln?.[0] === sha256('ignacio nunez'));

// ── 6. Evento de embudo: el eventId del navegador pasa intacto ──
await AdsService.sendWebFunnelEvent('ViewContent', {
  eventId: 'ev-1725000000-abc123',
  eventSourceUrl: 'https://atelieroptica.com.ar/producto/orion-c1',
  matchData: { fbp: 'fb.1.1725000000.1234567890', clientIp: '181.10.20.30', userAgent: 'Mozilla/5.0' },
  value: 120000,
  contentIds: ['prod-123'],
  contentName: 'Orión C1',
});
const vc = llamadas[4].body.data[0];
check('embudo: event_id = el que generó el navegador (dedup)', vc.event_id === 'ev-1725000000-abc123');
check('embudo: content_ids + content_type product', vc.custom_data.content_ids?.[0] === 'prod-123' && vc.custom_data.content_type === 'product');
check('embudo: sin em/ph (todavía no hay datos del cliente)', vc.user_data.em === undefined && vc.user_data.ph === undefined);
check('embudo: valor y moneda', vc.custom_data.value === 120000 && vc.custom_data.currency === 'ARS');

// ── 7. Embudo SIN señales del navegador: se descarta, no se manda ciego ──
const antes = llamadas.length;
await AdsService.sendWebFunnelEvent('AddToCart', { eventId: 'ev-sin-senales', value: 100 });
check('embudo sin fbp/fbc/IP/UA no se manda (no matchearía con nadie)', llamadas.length === antes);

console.log(`\n✅ ${passed} verificaciones OK — el payload CAPI sale hasheado, deduplicado y sin red.\n`);

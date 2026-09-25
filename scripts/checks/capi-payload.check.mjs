// ────────────────────────────────────────────────────────────────────────────
// Verificación del Conversions API de Meta: el PAYLOAD (AdsService) y la
// OUTBOX de compras (MetaConversionService). SIN RED y SIN BASE: se mockea
// `fetch` y se usa el almacén en memoria del service. Importa los services
// REALES, no una copia de su lógica.
//
// Qué protege:
//  - Los datos personales (email, teléfono, nombre) salen SIEMPRE hasheados
//    con SHA-256 y normalizados como pide Meta — nunca en claro.
//  - El teléfono se normaliza a E.164 sin '+' (549…) con el canon argentino
//    de phone-utils: el mismo número tipeado de dos formas hashea igual.
//  - `event_id = order.id` en TODA compra (web Y local): dedup con el Pixel del
//    navegador y con nuestros propios reintentos.
//  - La venta del local viaja con la fecha de la VENTA (labSentAt), no la del
//    presupuesto (createdAt): Meta rechaza más de 7 días.
//  - Regla "sí o sí" (25/9/2026): toda compra queda anotada; si Meta falla se
//    reintenta con backoff; lo vencido/rechazado no se insiste pero se avisa;
//    una compra ya enviada no se manda dos veces; una fila colgada en SENDING
//    se recupera.
//  - Sin credenciales no se manda nada (fail-quiet), pero la compra queda
//    FAILED para que el cron avise: no puede quedar mudo.
//  - Un evento de embudo sin ninguna señal del navegador se descarta.
//
// Correr:  npm run check:capi
//   (node --experimental-strip-types --import ./scripts/checks/_alias.mjs
//    scripts/checks/capi-payload.check.mjs)
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { AdsService, idsDeProductos } from '../../src/services/ads.service.ts';
import {
  MetaConversionService,
  crearAlmacenEnMemoria,
  INTENTOS_ANTES_DE_AVISAR,
  SENDING_COLGADA_MS,
} from '../../src/services/meta-conversions.service.ts';

let passed = 0;
const check = (name, cond) => {
  assert.ok(cond, `FALLÓ: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
};

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const esHashHex = (v) => Array.isArray(v) && v.length === 1 && /^[0-9a-f]{64}$/.test(v[0]);
const min = (n) => n * 60_000;
const dia = (n) => n * 24 * 3600_000;
/** El envío desde registrar() es fire-and-forget: dejar que asiente. */
const asentar = () => new Promise((r) => setTimeout(r, 10));

// ── Mock de fetch: captura cada request y responde lo que diga `respuestaMeta` ──
const llamadas = [];
let respuestaMeta = () => ({ ok: true, status: 200, json: async () => ({ events_received: 1 }) });
globalThis.fetch = (url, opts) => {
  llamadas.push({ url: String(url), body: JSON.parse(opts?.body ?? '{}') });
  return Promise.resolve(respuestaMeta());
};
const errorMeta = (code, message) => () => ({ ok: false, status: 400, json: async () => ({ error: { code, message } }) });

// ── Almacén en memoria (sin base) ──
const almacen = crearAlmacenEnMemoria();
MetaConversionService.usarAlmacen(almacen);
const fila = (orderId, actionSource = 'website') =>
  almacen.filas.find((f) => f.orderId === orderId && f.actionSource === actionSource);

console.log('\nConversions API de Meta: payload y outbox de compras (sin red, sin base)\n');

// ── 1. Sin credenciales: NADA sale, pero la compra queda anotada y FALLIDA (el cron avisa) ──
delete process.env.META_ACCESS_TOKEN;
delete process.env.META_PIXEL_ID;

await MetaConversionService.registrarCompraWeb({
  id: 'orden-sin-credenciales',
  total: 1000,
  client: { email: 'x@x.com', phone: '351 6123456', name: 'X X' },
  createdAt: new Date(),
});
await asentar();
await AdsService.sendWebFunnelEvent('ViewContent', {
  eventId: 'ev-x',
  matchData: { fbp: 'fb.1.1.1' },
});
await asentar();
check('sin META_ACCESS_TOKEN/META_PIXEL_ID no se manda nada (fail-quiet)', llamadas.length === 0);
const muda = fila('orden-sin-credenciales');
check('…pero la compra queda anotada FAILED con próximo intento (no puede quedar muda)', muda?.status === 'FAILED' && muda?.nextAttemptAt instanceof Date && /sin configurar/.test(muda?.lastError ?? ''));
// Se la saca del medio (como si ya hubiera entrado) para que no ensucie los
// conteos de reintentos de los casos siguientes.
await almacen.resolver(muda.id, { status: 'SENT', sentAt: new Date() });

// ── Credenciales de mentira para el resto de los casos ──
process.env.META_ACCESS_TOKEN = 'token-de-prueba-jamas-real';
process.env.META_PIXEL_ID = '111222333444555';

// ── 2. Purchase web completo ──
const creadaHace1h = new Date(Date.now() - min(60));
await MetaConversionService.registrarCompraWeb(
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
    createdAt: creadaHace1h,
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
await asentar();

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
check('event_time = createdAt de la orden web, en segundos (no ms)', eventoCompra?.event_time === Math.floor(creadaHace1h.getTime() / 1000));
const enviada = fila('orden-capi-check-1');
check('la compra quedó SENT en la outbox, con sentAt y 1 intento', enviada?.status === 'SENT' && enviada?.sentAt instanceof Date && enviada?.attempts === 1);
check('el payload guardado es EXACTAMENTE el que salió', JSON.stringify(enviada?.payload) === JSON.stringify(eventoCompra));

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
await MetaConversionService.registrarCompraWeb({
  id: 'orden-capi-check-2',
  total: 1,
  client: { email: 'a@b.com', phone: '+54 9 351 612-3456', name: 'A B' },
  createdAt: new Date(),
});
await asentar();
const ph2 = llamadas[1].body.data[0].user_data.ph;
check('"+54 9 351 612-3456" y "0351 15 612-3456" producen el mismo ph', ph2?.[0] === ud.ph[0]);

// ── 4. Un teléfono basura no se manda (hashearlo no matchea a nadie) ──
await MetaConversionService.registrarCompraWeb({
  id: 'orden-capi-check-3',
  total: 1,
  client: { email: 'a@b.com', phone: '123', name: 'A B' },
  createdAt: new Date(),
});
await asentar();
check('teléfono incompleto ("123") queda afuera del user_data', llamadas[2].body.data[0].user_data.ph === undefined);

// ── 5. Venta del LOCAL: fecha de la venta, event_id, split del nombre ──
const presupuestoDeHace20Dias = new Date(Date.now() - dia(20));
const enviadaAFabricaHace2h = new Date(Date.now() - min(120));
await MetaConversionService.registrarCompraLocal({
  id: 'orden-capi-check-4',
  total: 90000,
  client: { email: 'c@d.com', phone: '351 612 3456', name: 'Juan Ignacio Núñez' },
  createdAt: presupuestoDeHace20Dias,
  labSentAt: enviadaAFabricaHace2h,
});
await asentar();
const offline = llamadas[3].body.data[0];
check('local: action_source = physical_store', offline.action_source === 'physical_store');
check('local: event_id = order.id (permite reintentar sin duplicar)', offline.event_id === 'orden-capi-check-4');
check('local: event_time = labSentAt (la VENTA), no createdAt (el presupuesto de hace 20 días)', offline.event_time === Math.floor(enviadaAFabricaHace2h.getTime() / 1000));
check('local: fn = sha256("juan") (1ª palabra del nombre completo)', offline.user_data.fn?.[0] === sha256('juan'));
check('local: ln = sha256("ignacio nunez") (el resto, sin tildes)', offline.user_data.ln?.[0] === sha256('ignacio nunez'));
check('local: quedó SENT en la outbox', fila('orden-capi-check-4', 'physical_store')?.status === 'SENT');

// ── 6. Meta falla (token caído): queda FAILED y el cron la reintenta hasta que entra ──
respuestaMeta = errorMeta(190, 'Error validating access token: Session has expired');
const antes = llamadas.length;
await MetaConversionService.registrarCompraLocal({
  id: 'orden-token-caido',
  total: 50000,
  client: { email: 'e@f.com', phone: '351 612 3456', name: 'Ana Sosa' },
  labSentAt: new Date(),
});
await asentar();
const caida = fila('orden-token-caido', 'physical_store');
check('token caído: se intentó 1 vez y quedó FAILED con el error de Meta', llamadas.length === antes + 1 && caida?.status === 'FAILED' && caida?.attempts === 1 && /#190/.test(caida?.lastError ?? ''));
check('token caído: próximo intento programado ~10 min después', caida?.nextAttemptAt && Math.abs(caida.nextAttemptAt.getTime() - Date.now() - min(10)) < 5000);

let r = await MetaConversionService.reintentarPendientes(new Date());
check('el cron NO la reintenta antes de su turno', r.revisadas === 0 && llamadas.length === antes + 1);

const t11 = new Date(Date.now() + min(11));
r = await MetaConversionService.reintentarPendientes(t11);
const caida2 = fila('orden-token-caido', 'physical_store');
check('a los 11 min la reintenta; sigue fallando → intento 2, backoff 20 min', r.revisadas === 1 && r.fallidas === 1 && caida2?.attempts === 2 && Math.abs(caida2.nextAttemptAt.getTime() - t11.getTime() - min(20)) < 5000);

r = await MetaConversionService.reintentarPendientes(new Date(Date.now() + min(32)));
check('intento 3 fallido → ya merece aviso por mail', r.fallidas === 1 && fila('orden-token-caido', 'physical_store')?.attempts === INTENTOS_ANTES_DE_AVISAR && (await MetaConversionService.paraAvisar()).some((f) => f.orderId === 'orden-token-caido'));

respuestaMeta = () => ({ ok: true, status: 200, json: async () => ({ events_received: 1 }) });
r = await MetaConversionService.reintentarPendientes(new Date(Date.now() + min(80)));
const recuperada = fila('orden-token-caido', 'physical_store');
check('token repuesto → el cron la manda y queda SENT (intento 4), con el MISMO event_id', r.enviadas === 1 && recuperada?.status === 'SENT' && recuperada?.attempts === 4 && llamadas.at(-1).body.data[0].event_id === 'orden-token-caido');

r = await MetaConversionService.reintentarPendientes(new Date(Date.now() + dia(1)));
check('una compra SENT no se vuelve a mandar nunca', r.revisadas === 0);

// ── 7. Rechazo en firme (#100 parámetro inválido): no se insiste, se avisa ──
respuestaMeta = errorMeta(100, 'Invalid parameter: user_data.em is not a valid hash');
await MetaConversionService.registrarCompraWeb({
  id: 'orden-rechazada',
  total: 1,
  client: { email: 'g@h.com', phone: '351 612 3456', name: 'G H' },
  createdAt: new Date(),
});
await asentar();
const n1 = llamadas.length;
r = await MetaConversionService.reintentarPendientes(new Date(Date.now() + dia(1)));
check('rechazo #100 → REJECTED, sin reintentos, y en la lista de avisos', fila('orden-rechazada')?.status === 'REJECTED' && llamadas.length === n1 && r.revisadas === 0 && (await MetaConversionService.paraAvisar()).some((f) => f.orderId === 'orden-rechazada'));
respuestaMeta = () => ({ ok: true, status: 200, json: async () => ({ events_received: 1 }) });

// ── 8. Vencida (más de 7 días): no se manda, queda EXPIRED y avisa ──
const n2 = llamadas.length;
await MetaConversionService.registrarCompraLocal({
  id: 'orden-vieja',
  total: 1,
  client: { email: 'i@j.com', phone: '351 612 3456', name: 'I J' },
  labSentAt: new Date(Date.now() - dia(8)),
});
await asentar();
check('venta de hace 8 días: no se manda (Meta la rechazaría) y queda EXPIRED', llamadas.length === n2 && fila('orden-vieja', 'physical_store')?.status === 'EXPIRED');
check('EXPIRED está en la lista de avisos', (await MetaConversionService.paraAvisar()).some((f) => f.orderId === 'orden-vieja'));

// ── 9. El aviso sale UNA sola vez por compra ──
const avisar = await MetaConversionService.paraAvisar();
await MetaConversionService.marcarAvisadas(avisar.map((f) => f.id));
check('después de avisar, la lista queda vacía (no se repite el mail)', (await MetaConversionService.paraAvisar()).length === 0);

// ── 10. Idempotencia: anotar dos veces la misma compra = una fila, un envío ──
const n3 = llamadas.length;
await MetaConversionService.registrarCompraWeb({
  id: 'orden-capi-check-1',
  total: 185000,
  client: { email: 'otra@x.com', phone: '351 612 3456', name: 'X' },
  createdAt: new Date(),
});
await asentar();
check('re-anotar una compra ya enviada no crea otra fila ni manda de nuevo', almacen.filas.filter((f) => f.orderId === 'orden-capi-check-1').length === 1 && llamadas.length === n3);

// ── 11. Fila colgada en SENDING (el proceso murió a mitad del envío): se recupera ──
const colgada = await almacen.registrar({ orderId: 'orden-colgada', actionSource: 'website', eventTime: new Date(), value: 1, payload: { event_name: 'Purchase', event_id: 'orden-colgada' } });
await almacen.reclamar(colgada.id, ['PENDING']);
almacen.filas.find((f) => f.id === colgada.id).updatedAt = new Date(Date.now() - SENDING_COLGADA_MS - min(1));
const n4 = llamadas.length;
r = await MetaConversionService.reintentarPendientes(new Date());
check('SENDING de hace >10 min se considera colgada: se reintenta y queda SENT', r.enviadas === 1 && llamadas.length === n4 + 1 && fila('orden-colgada')?.status === 'SENT');

// ── 12. Un labSentAt del futuro (reloj corrido) se recorta a "ahora" ──
await MetaConversionService.registrarCompraLocal({
  id: 'orden-futuro',
  total: 1,
  client: { email: 'k@l.com', phone: '351 612 3456', name: 'K L' },
  labSentAt: new Date(Date.now() + dia(1)),
});
await asentar();
check('event_time nunca queda en el futuro', llamadas.at(-1).body.data[0].event_time <= Math.floor(Date.now() / 1000) + 1);

// ── 13. Si la base falla, la compra se manda IGUAL (sin registro) ──
MetaConversionService.usarAlmacen({ ...almacen, registrar: async () => { throw new Error('base caída'); } });
const n5 = llamadas.length;
await MetaConversionService.registrarCompraWeb({
  id: 'orden-base-caida',
  total: 1,
  client: { email: 'm@n.com', phone: '351 612 3456', name: 'M N' },
  createdAt: new Date(),
});
await asentar();
check('con la base caída el Purchase sale igual (mejor sin rastro que ninguno)', llamadas.length === n5 + 1 && llamadas.at(-1).body.data[0].event_id === 'orden-base-caida');
MetaConversionService.usarAlmacen(almacen);

// ── 13b. Qué se compró: los ids del catálogo viajan en la compra ──
check('idsDeProductos: carrito web (productId), orden del CRM (product.id), sin repetir ni "unknown"',
  JSON.stringify(idsDeProductos([{ productId: 'p1' }, { product: { id: 'p2' } }, { productId: 'p1' }, { productId: 'unknown' }, null])) === JSON.stringify(['p1', 'p2']));
check('idsDeProductos: algo que no es lista → vacío', idsDeProductos(undefined).length === 0);
await MetaConversionService.registrarCompraWeb({
  id: 'orden-con-productos',
  total: 250000,
  client: { email: 'q@r.com', phone: '351 612 3456', name: 'Q R' },
  createdAt: new Date(),
  contentIds: ['prod-a', 'prod-b'],
});
await asentar();
const cd = llamadas.at(-1).body.data[0].custom_data;
check('compra con productos: content_ids = ids del catálogo, content_type product, num_items', JSON.stringify(cd.content_ids) === JSON.stringify(['prod-a', 'prod-b']) && cd.content_type === 'product' && cd.num_items === 2);
await MetaConversionService.registrarCompraWeb({
  id: 'orden-sin-productos',
  total: 1,
  client: { email: 's@t.com', phone: '351 612 3456', name: 'S T' },
  createdAt: new Date(),
});
await asentar();
check('compra sin productos: no se inventa content_ids', llamadas.at(-1).body.data[0].custom_data.content_ids === undefined);

// ── 14. Evento de embudo: el eventId del navegador pasa intacto ──
const n6 = llamadas.length;
await AdsService.sendWebFunnelEvent('ViewContent', {
  eventId: 'ev-1725000000-abc123',
  eventSourceUrl: 'https://atelieroptica.com.ar/producto/orion-c1',
  matchData: { fbp: 'fb.1.1725000000.1234567890', clientIp: '181.10.20.30', userAgent: 'Mozilla/5.0' },
  value: 120000,
  contentIds: ['prod-123'],
  contentName: 'Orión C1',
});
await asentar();
const vc = llamadas[n6].body.data[0];
check('embudo: event_id = el que generó el navegador (dedup)', vc.event_id === 'ev-1725000000-abc123');
check('embudo: content_ids + content_type product', vc.custom_data.content_ids?.[0] === 'prod-123' && vc.custom_data.content_type === 'product');
check('embudo: sin em/ph (todavía no hay datos del cliente)', vc.user_data.em === undefined && vc.user_data.ph === undefined);
check('embudo: valor y moneda', vc.custom_data.value === 120000 && vc.custom_data.currency === 'ARS');

// ── 15. Embudo SIN señales del navegador: se descarta, no se manda ciego ──
const n7 = llamadas.length;
await AdsService.sendWebFunnelEvent('AddToCart', { eventId: 'ev-ciego', matchData: {} });
await asentar();
check('embudo sin fbp/fbc/IP/UA no se manda (no matchearía con nadie)', llamadas.length === n7);

console.log(`\n✅ ${passed} verificaciones OK — el payload CAPI sale hasheado y deduplicado, y ninguna compra se pierde en silencio.\n`);

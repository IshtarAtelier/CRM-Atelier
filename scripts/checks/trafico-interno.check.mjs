// ────────────────────────────────────────────────────────────────────────────
// Tráfico del equipo: un navegador marcado (`ate_interno=1`) no le cuenta nada
// a Meta ni a Google, y no entra en la analítica propia. Las compras, sí.
// SIN RED y SIN BASE: se simulan `fetch` y el cliente de Prisma, y se llaman
// la ruta /api/web/track, el middleware, /interno y tracking.ts REALES.
//
// Qué protege (25/9/2026):
//  - Una prueba del equipo (una ficha, un carrito, un deploy verificado en
//    /checkout) no le llega a Meta por el Conversions API como un
//    ViewContent / AddToCart / InitiateCheckout / Contact de un cliente. La
//    campaña "Ventas | Tienda online" optimiza con esos eventos.
//  - El tráfico de clientes SIGUE llegando: un filtro que corte de más apaga
//    la medición en silencio, que es peor que el ruido.
//  - Todo navegador donde alguien del equipo abre el CRM queda marcado solo;
//    una óptica mayorista (OPTICA) no, porque es un cliente.
//  - En un navegador marcado no se carga ni el píxel ni gtag.
//  - Las compras no miran la marca: una compra real de alguien del equipo
//    sigue yendo a Meta (MetaConversionService.registrarCompra*).
//
// Correr:  npm run check:interno
//   (node --experimental-strip-types --import ./scripts/checks/_alias.mjs
//    scripts/checks/trafico-interno.check.mjs)
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const leer = (rel) => readFileSync(path.join(RAIZ, rel), 'utf8');

let passed = 0;
const check = (name, cond) => {
  assert.ok(cond, `FALLÓ: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
};
/** El espejo a Meta es fire-and-forget: dejar que asiente. */
const asentar = () => new Promise((r) => setTimeout(r, 20));

// ── Dobles: Prisma en memoria y fetch que anota todo ────────────────────────
// src/lib/db.ts reusa `globalThis.prisma` si existe: se pone ANTES de importar.
const registrados = [];
globalThis.prisma = {
  analyticsEvent: {
    createMany: async ({ data }) => {
      registrados.push(...data);
      return { count: data.length };
    },
  },
};

const aMeta = [];
globalThis.fetch = (url, opts) => {
  const u = String(url);
  if (u.includes('graph.facebook.com')) {
    const body = JSON.parse(opts?.body ?? '{}');
    for (const ev of body.data ?? []) aMeta.push(ev.event_name);
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ events_received: 1 }) });
  }
  return Promise.reject(new Error(`sin red en el check: ${u}`));
};
process.env.META_ACCESS_TOKEN = 'token-de-prueba';
process.env.META_PIXEL_ID = '123';
process.env.JWT_SECRET = 'secreto-de-prueba-para-el-check';

const log = console.log;
const silenciar = () => { console.log = () => {}; };
const restaurar = () => { console.log = log; };

const { esTraficoInterno, conGuardaInterno, TRAFICO_INTERNO_MAX_AGE_S } = await import('../../src/lib/trafico-interno.ts');

// ── 1. La decisión ──────────────────────────────────────────────────────────
console.log('\nDecisión (lib/trafico-interno.ts)');
check('sin cookies → cliente', !esTraficoInterno(null) && !esTraficoInterno(''));
check('ate_interno=1 sola → interno', esTraficoInterno('ate_interno=1'));
check('ate_interno=1 entre otras → interno', esTraficoInterno('_fbp=fb.1.1.2; ate_interno=1; _ga=GA1'));
check('ate_interno=1 al final → interno', esTraficoInterno('_fbp=fb.1.1.2; ate_interno=1'));
check('ate_interno=0 (desmarcado a propósito) → cliente', !esTraficoInterno('ate_interno=0'));
check('otra cookie que TERMINA en ate_interno no cuenta', !esTraficoInterno('xate_interno=1'));
check('valor que empieza con 1 no cuenta (ate_interno=10)', !esTraficoInterno('ate_interno=10'));
check('la sesión del CRM sola no alcanza (la marca la pone el middleware)', !esTraficoInterno('session=eyJ...'));
check('dura 400 días (el tope de Chrome)', TRAFICO_INTERNO_MAX_AGE_S === 400 * 86400);

// ── 2. /api/web/track REAL ──────────────────────────────────────────────────
console.log('\n/api/web/track (ruta real, Prisma y Meta simulados)');
const { POST } = await import('../../src/app/api/web/track/route.ts');

let ipN = 0;
async function postear(cookie, eventos) {
  registrados.length = 0;
  aMeta.length = 0;
  const headers = {
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0 (iPhone) check',
    'x-forwarded-for': `10.0.0.${++ipN}`,
    referer: 'https://atelieroptica.com.ar/checkout',
  };
  if (cookie) headers.cookie = cookie;
  const req = new Request('https://atelieroptica.com.ar/api/web/track', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      events: eventos.map((type) => ({ type, sessionId: 'sid-check', value: 150000, quantity: 1, meta: { eventId: `ev-${type}` } })),
    }),
  });
  silenciar();
  try {
    const res = await POST(req);
    await asentar();
    return { status: res.status, registrados: [...registrados], aMeta: [...aMeta] };
  } finally {
    restaurar();
  }
}

const EMBUDO = ['view_content', 'add_to_cart', 'begin_checkout', 'whatsapp_click'];

const cliente = await postear('_fbp=fb.1.1700000000.123', EMBUDO);
check('cliente: responde 204', cliente.status === 204);
check('cliente: los 4 eventos entran a la analítica propia', cliente.registrados.length === 4);
check('cliente: los 4 llegan a Meta', cliente.aMeta.length === 4);
check('cliente: InitiateCheckout llega a Meta', cliente.aMeta.includes('InitiateCheckout'));
check('cliente: el clic a WhatsApp llega como Contact', cliente.aMeta.includes('Contact'));

const equipo = await postear('_fbp=fb.1.1700000000.123; ate_interno=1; _ga=GA1.1', EMBUDO);
check('equipo: responde 204 igual (medir nunca falla de cara al usuario)', equipo.status === 204);
check('equipo: NADA le llega a Meta', equipo.aMeta.length === 0);
check('equipo: NADA entra a la analítica propia (decisión de Ishtar, 25/9)', equipo.registrados.length === 0);

const equipoSinFbp = await postear('ate_interno=1', ['begin_checkout']);
check('equipo sin cookie del píxel: tampoco (el CAPI igual manda con IP + user-agent)', equipoSinFbp.aMeta.length === 0);

const desmarcado = await postear('_fbp=fb.1.1700000000.123; ate_interno=0', ['begin_checkout']);
check('desmarcado (ate_interno=0): vuelve a medirse como cliente', desmarcado.aMeta.includes('InitiateCheckout') && desmarcado.registrados.length === 1);

const sesionMayorista = await postear('_fbp=fb.1.1700000000.123; session=cualquiera', ['view_content']);
check('una sesión sin la marca (p. ej. una óptica mayorista) se mide como antes', sesionMayorista.aMeta.includes('ViewContent'));

// ── 3. middleware REAL: el CRM marca solo ───────────────────────────────────
console.log('\nmiddleware (el CRM marca el navegador)');
const { NextRequest } = await import('next/server');
const { encrypt } = await import('../../src/lib/auth.ts');
const { middleware } = await import('../../src/middleware.ts');

const sesion = async (role) => encrypt({ id: `u-${role}`, email: 'x@x', name: `Prueba ${role}`, role });
const pedir = (ruta, cookie) =>
  middleware(new NextRequest(`https://atelieroptica.com.ar${ruta}`, { headers: cookie ? { cookie } : {} }));
const setCookie = (res) => res.headers.get('set-cookie') ?? '';
const marca = (res) => /(?:^|,\s*)ate_interno=1;/.test(setCookie(res));

const admin = await pedir('/admin/ventas', `session=${await sesion('ADMIN')}`);
check('ADMIN abre /admin: el navegador queda marcado', marca(admin));
check('la marca dura 400 días', /Max-Age=34560000/i.test(setCookie(admin)));
check('la marca vale para todo el sitio (Path=/)', /Path=\//i.test(setCookie(admin)));
check('la marca NO es HttpOnly (el navegador la lee para no cargar el píxel)', !/HttpOnly/i.test(setCookie(admin)));

const staff = await pedir('/admin', `session=${await sesion('STAFF')}`);
check('STAFF abre /admin: también queda marcado', marca(staff));

const yaMarcado = await pedir('/admin', `session=${await sesion('ADMIN')}; ate_interno=1`);
check('ya marcado: no se manda Set-Cookie en cada request del panel', !/ate_interno/.test(setCookie(yaMarcado)));

const desmarcadoAdrede = await pedir('/admin', `session=${await sesion('ADMIN')}; ate_interno=0`);
check('desmarcado a propósito (/interno?quitar=1): el CRM no lo vuelve a marcar', !/ate_interno/.test(setCookie(desmarcadoAdrede)));

const optica = await pedir('/admin', `session=${await sesion('OPTICA')}`);
check('una óptica mayorista (OPTICA) NO se marca: es un cliente', !/ate_interno/.test(setCookie(optica)));

const sinSesion = await pedir('/admin', null);
check('sin sesión: no se marca', !/ate_interno/.test(setCookie(sinSesion)));

const sesionTrucha = await pedir('/admin', 'session=eyJhbGciOiJIUzI1NiJ9.e30.firma-falsa');
check('sesión inválida: no se marca', !/ate_interno/.test(setCookie(sesionTrucha)));

const visitante = await pedir('/tienda', null);
check('un visitante de la tienda no se marca', !/ate_interno/.test(setCookie(visitante)));

// ── 4. /interno REAL ────────────────────────────────────────────────────────
console.log('\n/interno (marcar un celular o una compu)');
const { GET: interno } = await import('../../src/app/interno/route.ts');
const abrir = (ruta, cookie) =>
  interno(new Request(`https://atelieroptica.com.ar${ruta}`, { headers: cookie ? { cookie } : {} }));

const marcar = await abrir('/interno');
check('/interno: marca el navegador por 400 días', /ate_interno=1;/.test(setCookie(marcar)) && /Max-Age=34560000/i.test(setCookie(marcar)));
check('/interno: la marca no es HttpOnly', !/HttpOnly/i.test(setCookie(marcar)));
check('/interno: lo confirma en pantalla', (await marcar.text()).includes('Listo: este navegador es del equipo'));
check('/interno: no se cachea', marcar.headers.get('cache-control') === 'no-store');
check('/interno: no se indexa', /noindex/.test(marcar.headers.get('x-robots-tag') ?? ''));

const quitar = await abrir('/interno?quitar=1', 'ate_interno=1');
check('/interno?quitar=1: pasa a ate_interno=0 por 24 h', /ate_interno=0;/.test(setCookie(quitar)) && /Max-Age=86400/i.test(setCookie(quitar)));
check('/interno?quitar=1: el "0" no cuenta como interno', !esTraficoInterno('ate_interno=0'));

const ver = await abrir('/interno?ver=1', 'ate_interno=1');
check('/interno?ver=1: no cambia nada', setCookie(ver) === '');
check('/interno?ver=1: dice cómo está', (await ver.text()).includes('Este navegador es del equipo'));
const verCliente = await abrir('/interno?ver=1', null);
check('/interno?ver=1 sin marca: dice que cuenta como cliente', (await verCliente.text()).includes('cuenta como cliente'));

// ── 5. En el navegador: ni píxel ni gtag ────────────────────────────────────
console.log('\nNavegador (TrackingScripts + tracking.ts)');

// 5a. La guarda de los scripts inline, ejecutada de verdad.
const corre = (cookie) => {
  const ctx = { document: { cookie }, corrio: false };
  vm.runInNewContext(conGuardaInterno('corrio = true;'), ctx);
  return ctx.corrio;
};
check('script inline: en un navegador del equipo NO corre', !corre('_fbp=x; ate_interno=1'));
check('script inline: en un cliente corre', corre('_fbp=x'));
check('script inline: sin cookies corre', corre(''));
check('script inline: desmarcado corre', corre('ate_interno=0'));

// 5b. Cada <Script> de TrackingScripts pasa por la guarda (uno nuevo sin ella
//     volvería a mandar el ruido del equipo).
const trackingScripts = leer('src/components/Storefront/TrackingScripts.tsx');
// Solo etiquetas reales (con atributos), no un "<Script>" nombrado en un comentario.
const scripts = (trackingScripts.match(/<Script\s+\w+=/g) ?? []).length;
const guardados = (trackingScripts.match(/\{conGuardaInterno\(/g) ?? []).length;
check(`TrackingScripts: los ${scripts} <Script> pasan por conGuardaInterno`, scripts > 0 && scripts === guardados);
check('TrackingScripts: gtag se cuelga de window (no una declaración dentro del if)', trackingScripts.includes('window.gtag = function gtag(') && !/"function gtag\(/.test(trackingScripts));

// 5c. tracking.ts REAL con un window de mentira.
const llamadas = [];
const almacen = new Map();
globalThis.window = {
  location: { search: '', pathname: '/checkout', host: 'atelieroptica.com.ar' },
  fbq: (...a) => llamadas.push(['fbq', a[1]]),
  gtag: (...a) => llamadas.push(['gtag', a[1]]),
};
globalThis.document = { cookie: '', referrer: '' };
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, String(v)), removeItem: (k) => almacen.delete(k) },
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { userAgent: 'Mozilla/5.0 (iPhone)', sendBeacon: () => true },
});

const { trackInitiateCheckout, trackWhatsAppClick } = await import('../../src/lib/tracking.ts');
const carrito = [{ productId: 'p1', brand: 'Atelier', model: 'Altair', price: 150000, quantity: 1 }];

document.cookie = '_fbp=x; ate_interno=1';
llamadas.length = 0;
trackInitiateCheckout(carrito, 150000);
trackWhatsAppClick('flotante');
check('equipo: InitiateCheckout no va al píxel ni a gtag', llamadas.length === 0);

document.cookie = '_fbp=x';
llamadas.length = 0;
trackInitiateCheckout(carrito, 150000);
trackWhatsAppClick('flotante');
check('cliente: InitiateCheckout va al píxel', llamadas.some(([t, ev]) => t === 'fbq' && ev === 'InitiateCheckout'));
check('cliente: begin_checkout va a gtag', llamadas.some(([t, ev]) => t === 'gtag' && ev === 'begin_checkout'));
check('cliente: el WhatsApp va al píxel como Contact', llamadas.some(([t, ev]) => t === 'fbq' && ev === 'Contact'));

// ── 6. Las compras no miran la marca ────────────────────────────────────────
console.log('\nCompras (una compra real del equipo sigue siendo una compra)');
const CAMINO_DE_COMPRA = [
  'src/services/meta-conversions.service.ts',
  'src/app/api/checkout/payway/route.ts',
  'src/lib/checkout/finalize-web-payment.ts',
  'src/services/ads.service.ts',
];
for (const archivo of CAMINO_DE_COMPRA) {
  const src = leer(archivo);
  check(`${archivo} no filtra por la marca del equipo`, !/trafico-interno|ate_interno|esTraficoInterno/.test(src));
}

console.log(`\n✅ ${passed} verificaciones OK: el equipo no le cuenta a Meta, los clientes sí, las compras siempre.\n`);
// rate-limiter.ts deja un setInterval de limpieza vivo a nivel de módulo: sin
// esto el proceso no termina nunca y el CI queda colgado.
process.exit(0);

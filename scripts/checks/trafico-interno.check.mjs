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
//  - Una óptica mayorista (Ishtar, 25/9/2026) tampoco le cuenta su recorrido
//    a Meta —es un público B2B—, pero SÍ entra en la analítica propia y gtag
//    carga igual. La marcan el login y /api/auth/me.
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
const usuarios = new Map();
globalThis.prisma = {
  user: { findUnique: async ({ where }) => usuarios.get(where.email) ?? null },
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

const { esTraficoInterno, esNavegadorMayorista, conGuardaInterno, conGuardaSinMeta, TRAFICO_INTERNO_MAX_AGE_S } =
  await import('../../src/lib/trafico-interno.ts');
const { encrypt } = await import('../../src/lib/auth.ts');
const sesion = async (role) => encrypt({ id: `u-${role}`, email: 'x@x', name: `Prueba ${role}`, role });

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
check('ate_mayorista=1 → mayorista', esNavegadorMayorista('_fbp=x; ate_mayorista=1'));
check('ate_mayorista no es interno (sí entra en la analítica propia)', !esTraficoInterno('ate_mayorista=1'));
check('ate_interno no es mayorista', !esNavegadorMayorista('ate_interno=1'));

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

const sesionTruchaTrack = await postear('_fbp=fb.1.1700000000.123; session=eyJhbGciOiJIUzI1NiJ9.e30.firma-falsa', ['view_content']);
check('una sesión inválida o vencida se mide como cliente', sesionTruchaTrack.aMeta.includes('ViewContent') && sesionTruchaTrack.registrados.length === 1);

const equipoConSesion = await postear(`_fbp=fb.1.1700000000.123; session=${await sesion('STAFF')}`, EMBUDO);
check('equipo con sesión y SIN la cookie todavía: nada a Meta', equipoConSesion.aMeta.length === 0);
check('equipo con sesión y SIN la cookie todavía: nada a la analítica propia', equipoConSesion.registrados.length === 0);

const optica = await postear(`_fbp=fb.1.1700000000.123; session=${await sesion('OPTICA')}`, EMBUDO);
check('óptica mayorista logueada: NADA le llega a Meta', optica.aMeta.length === 0);
check('óptica mayorista logueada: SÍ entra a la analítica propia (los 4)', optica.registrados.length === 4);

const opticaSinSesion = await postear('_fbp=fb.1.1700000000.123; ate_mayorista=1', ['begin_checkout']);
check('navegador mayorista sin sesión (cerró sesión): nada a Meta, sí a la analítica', opticaSinSesion.aMeta.length === 0 && opticaSinSesion.registrados.length === 1);

// ── 3. middleware REAL: el CRM marca solo ───────────────────────────────────
console.log('\nmiddleware (el CRM marca el navegador)');
const { NextRequest } = await import('next/server');
const { middleware } = await import('../../src/middleware.ts');

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

const opticaAdmin = await pedir('/admin', `session=${await sesion('OPTICA')}`);
check('una óptica mayorista (OPTICA) NO se marca como equipo: es un cliente', !/ate_interno/.test(setCookie(opticaAdmin)));

const sinSesion = await pedir('/admin', null);
check('sin sesión: no se marca', !/ate_interno/.test(setCookie(sinSesion)));

const sesionTrucha = await pedir('/admin', 'session=eyJhbGciOiJIUzI1NiJ9.e30.firma-falsa');
check('sesión inválida: no se marca', !/ate_interno/.test(setCookie(sesionTrucha)));

const visitante = await pedir('/tienda', null);
check('un visitante de la tienda no se marca', !/ate_interno/.test(setCookie(visitante)));

// ── 3b. login y /api/auth/me REALES: la óptica queda marcada ────────────────
console.log('\nLogin y /api/auth/me (marcan a la óptica mayorista)');
const bcrypt = (await import('bcryptjs')).default;
const clave = bcrypt.hashSync('clave-de-prueba', 4);
usuarios.set('optica@prueba', { id: 'u1', email: 'optica@prueba', name: 'Óptica', role: 'OPTICA', password: clave });
usuarios.set('staff@prueba', { id: 'u2', email: 'staff@prueba', name: 'Staff', role: 'STAFF', password: clave });
const { POST: login } = await import('../../src/app/api/auth/login/route.ts');
const entrar = (email) => login(new Request('https://atelieroptica.com.ar/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.0.${++ipN}` },
  body: JSON.stringify({ email, password: 'clave-de-prueba' }),
}));
/** El Set-Cookie de UNA cookie (el header junta todas, y el Expires trae comas). */
const cookiePuesta = (res, nombre) => res.headers.getSetCookie().find((c) => c.startsWith(`${nombre}=`)) ?? '';
const loginOptica = await entrar('optica@prueba');
check('login de una óptica: entra', loginOptica.status === 200);
const marcaOptica = cookiePuesta(loginOptica, 'ate_mayorista');
check('login de una óptica: marca el navegador como mayorista por 400 días', /^ate_mayorista=1;/.test(marcaOptica) && /Max-Age=34560000/i.test(marcaOptica));
check('la marca de mayorista no es HttpOnly (el navegador la lee para no cargar el píxel)', !/HttpOnly/i.test(marcaOptica));
check('la sesión sigue siendo HttpOnly', /HttpOnly/i.test(cookiePuesta(loginOptica, 'session')));
const loginStaff = await entrar('staff@prueba');
check('login del equipo: NO lo marca como mayorista', loginStaff.status === 200 && !/ate_mayorista/.test(setCookie(loginStaff)));

const { GET: yo } = await import('../../src/app/api/auth/me/route.ts');
const preguntar = (cookie) => yo(new NextRequest('https://atelieroptica.com.ar/api/auth/me', { headers: cookie ? { cookie } : {} }));
const meOptica = await preguntar(`session=${await sesion('OPTICA')}`);
check('/api/auth/me con sesión de óptica: responde su rol', meOptica.status === 200 && (await meOptica.json()).role === 'OPTICA');
check('/api/auth/me con sesión de óptica: marca el navegador (sesiones de antes del login nuevo)', /ate_mayorista=1;/.test(setCookie(meOptica)));
const meOpticaMarcada = await preguntar(`session=${await sesion('OPTICA')}; ate_mayorista=1`);
check('/api/auth/me ya marcado: no repite el Set-Cookie', !/ate_mayorista/.test(setCookie(meOpticaMarcada)));
const meStaff = await preguntar(`session=${await sesion('STAFF')}`);
check('/api/auth/me del equipo: no lo marca como mayorista', meStaff.status === 200 && !/ate_mayorista/.test(setCookie(meStaff)));
const meSinSesion = await preguntar(null);
check('/api/auth/me sin sesión: 401 y sin marca', meSinSesion.status === 401 && setCookie(meSinSesion) === '');

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
check('gtag (guarda del equipo): en una óptica mayorista corre igual', corre('ate_mayorista=1'));
const correPixel = (cookie) => {
  const ctx = { document: { cookie }, corrio: false };
  vm.runInNewContext(conGuardaSinMeta('corrio = true;'), ctx);
  return ctx.corrio;
};
check('píxel: en una óptica mayorista NO corre', !correPixel('_fbp=x; ate_mayorista=1'));
check('píxel: en el equipo NO corre', !correPixel('ate_interno=1'));
check('píxel: en un cliente corre', correPixel('_fbp=x') && correPixel(''));

// 5b. Cada <Script> de TrackingScripts pasa por la guarda (uno nuevo sin ella
//     volvería a mandar el ruido del equipo).
const trackingScripts = leer('src/components/Storefront/TrackingScripts.tsx');
// Solo etiquetas reales (con atributos), no un "<Script>" nombrado en un comentario.
const scripts = (trackingScripts.match(/<Script\s+\w+=/g) ?? []).length;
const guardados = (trackingScripts.match(/\{conGuarda(?:Interno|SinMeta)\(/g) ?? []).length;
check(`TrackingScripts: los ${scripts} <Script> pasan por una guarda`, scripts > 0 && scripts === guardados);
check('TrackingScripts: el píxel de Meta usa la guarda que también frena a mayoristas',
  /id="meta-pixel"[^>]*>\s*\{conGuardaSinMeta\(/.test(trackingScripts));
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

document.cookie = '_fbp=x; ate_mayorista=1';
llamadas.length = 0;
trackInitiateCheckout(carrito, 150000);
trackWhatsAppClick('flotante');
check('óptica mayorista: nada al píxel aunque ya estuviera cargado en la pestaña', !llamadas.some(([t]) => t === 'fbq'));
check('óptica mayorista: gtag sí (la decisión fue sacarla de Meta)', llamadas.some(([t, ev]) => t === 'gtag' && ev === 'begin_checkout'));

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

console.log(`\n✅ ${passed} verificaciones OK: ni el equipo ni las mayoristas le cuentan a Meta, los clientes sí, las compras siempre.\n`);
// rate-limiter.ts deja un setInterval de limpieza vivo a nivel de módulo: sin
// esto el proceso no termina nunca y el CI queda colgado.
process.exit(0);

#!/usr/bin/env node
/**
 * El precio de oferta, fijado en TODAS las superficies que lo muestran o lo
 * cobran.
 *
 * POR QUÉ EXISTE
 * La regla ("vale si está cargado, es mayor a cero y es MENOR al de lista")
 * vive en `src/lib/precio-oferta.ts`, pero llegar a usarla en todos lados costó
 * tres bugs distintos, los tres del mismo tipo — el componente sabía resolver
 * la oferta y el dato nunca le llegaba:
 *
 *   · 7/9/26 — el carrusel del home ni siquiera recibía `salePrice`: una rebaja
 *     de verdad era invisible en la pantalla que más gente ve.
 *   · 8/9/26 — se le puso el cartel "26% OFF 🔥" a esa misma tarjeta, pero el
 *     NÚMERO seguía saliendo del precio de lista: Rigel C3, rebajado de
 *     $215.000 a $160.000, anunciaba "26% OFF" al lado de $182.750.
 *   · 8/9/26 — `LISTADO_SELECT` no traía `salePrice`, así que /receta,
 *     /lentes-de-sol y /clip-on mostraban $182.750 por el mismo anteojo que
 *     /tienda vendía a $136.000.
 *
 * Los tres se ven igual desde afuera: un precio más caro que el real en la
 * página que más tráfico tiene. Este check los vuelve imposibles de repetir en
 * silencio.
 *
 * Corre sin base y sin red.
 * Uso: node --experimental-strip-types scripts/checks/precio-oferta.check.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { precioConOferta } from '../../src/lib/precio-oferta.ts';
import { promoVisible } from '../../src/lib/promo-visible.ts';
import { effectiveFramePrice } from '../../src/lib/checkout/checkout-pricing.ts';
import { PricingService } from '../../src/services/PricingService.ts';
import { problemasDelCartel, revisarCartel, CARTEL_PROMO_POR_DEFECTO, cartelQueSePuedeMostrar } from '../../src/lib/promo-cuotas.ts';
import { revisarConfiguracion } from '../../src/lib/web-settings-reglas.ts';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '../..');

const casos = [];
let fallas = 0;
const ok = (nombre) => casos.push({ nombre, ok: true });
const mal = (nombre, detalle) => { fallas++; casos.push({ nombre, ok: false, detalle }); };
const esperar = (nombre, real, esperado) => {
    if (JSON.stringify(real) === JSON.stringify(esperado)) ok(nombre);
    else mal(nombre, `esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(real)}`);
};

// ── 1. La regla, con sus bordes ──────────────────────────────────────────────
esperar('oferta real: final es el rebajado',
    precioConOferta({ price: 215000, salePrice: 160000 }),
    { lista: 215000, final: 160000, enOferta: true, descuentoPct: 26 });

esperar('sin oferta: final es el de lista',
    precioConOferta({ price: 160000, salePrice: null }),
    { lista: 160000, final: 160000, enOferta: false, descuentoPct: 0 });

esperar('salePrice IGUAL al de lista no es oferta',
    precioConOferta({ price: 160000, salePrice: 160000 }),
    { lista: 160000, final: 160000, enOferta: false, descuentoPct: 0 });

esperar('salePrice MAYOR al de lista no es oferta (un aumento disfrazado)',
    precioConOferta({ price: 160000, salePrice: 200000 }),
    { lista: 160000, final: 160000, enOferta: false, descuentoPct: 0 });

esperar('salePrice en cero no es oferta',
    precioConOferta({ price: 160000, salePrice: 0 }),
    { lista: 160000, final: 160000, enOferta: false, descuentoPct: 0 });

esperar('producto nulo no rompe',
    precioConOferta(null),
    { lista: 0, final: 0, enOferta: false, descuentoPct: 0 });

// ── 2. Lo que se MUESTRA y lo que se COBRA tienen que dar lo mismo ───────────
// `effectiveFramePrice` es lo que cobra el checkout. Si alguna vez difiere de
// `precioConOferta().final` para un cliente minorista, la web muestra un precio
// y la tarjeta cobra otro.
for (const [price, salePrice] of [[215000, 160000], [160000, null], [160000, 0], [160000, 200000], [200000, 140000]]) {
    const muestra = precioConOferta({ price, salePrice }).final;
    const cobra = effectiveFramePrice({ price, salePrice, wholesalePrice: 0 }, false);
    if (muestra === cobra) ok(`muestra y cobra coinciden (lista ${price} · oferta ${salePrice ?? '—'}): $${cobra}`);
    else mal(`muestra y cobra DIFIEREN (lista ${price} · oferta ${salePrice ?? '—'})`, `web $${muestra} vs checkout $${cobra}`);
}

// ── 3. Cada superficie de cara al cliente pasa por la regla ──────────────────
// Estático a propósito: lo que falló las tres veces no fue el cálculo sino que
// una pantalla nueva (o una consulta) se olvidara de la oferta.
const DEBEN_USAR_LA_REGLA = [
    ['src/components/Storefront/HomeProductCarousel.tsx', 'carrusel del home'],
    ['src/components/Storefront/CategoryGrid.tsx', 'grilla de /receta, /lentes-de-sol y /clip-on'],
    ['src/app/tienda/TiendaClient.tsx', 'grilla de /tienda'],
    ['src/app/producto/[slug]/ProductClient.tsx', 'ficha del producto'],
];
for (const [archivo, queEs] of DEBEN_USAR_LA_REGLA) {
    const src = readFileSync(resolve(raiz, archivo), 'utf8');
    if (src.includes('precioConOferta')) ok(`${queEs}: usa precioConOferta()`);
    else mal(`${queEs}: NO usa precioConOferta()`, `${archivo} calcula el precio por su cuenta`);
}

// ── 4. Las consultas que alimentan esas pantallas traen `salePrice` ─────────
// Este es el error exacto que se repitió: el componente sabía, el dato no venía.
const queries = readFileSync(resolve(raiz, 'src/lib/catalog/queries.ts'), 'utf8');
for (const nombre of ['HOME_SELECT', 'TIENDA_SELECT', 'LISTADO_SELECT']) {
    const bloque = queries.slice(queries.indexOf(`export const ${nombre}`));
    const cuerpo = bloque.slice(0, bloque.indexOf('} as const;'));
    if (/salePrice:\s*true/.test(cuerpo)) ok(`${nombre} trae salePrice`);
    else mal(`${nombre} NO trae salePrice`, 'la pantalla que use este select va a mostrar el precio de lista para un producto rebajado');
}

// ── 4-bis. Cada listado PASA `salePrice` a la grilla ────────────────────────
// El select puede traerlo y el mapeo de la página perderlo igual: cada listado
// arma su propio objeto a mano. Pasó en los tres a la vez — /lentes-de-sol y
// /receta con mapeo propio, /clip-on a través de ListadoCategoria.
const PASAN_SALEPRICE = [
    ['src/app/lentes-de-sol/page.tsx', '/lentes-de-sol'],
    ['src/app/receta/page.tsx', '/receta'],
    ['src/components/Storefront/ListadoCategoria.tsx', 'ListadoCategoria (/clip-on)'],
];
for (const [archivo, queEs] of PASAN_SALEPRICE) {
    const src = readFileSync(resolve(raiz, archivo), 'utf8');
    if (/salePrice:\s*wp\.product\.salePrice/.test(src)) ok(`${queEs}: le pasa salePrice a la grilla`);
    else mal(`${queEs}: NO le pasa salePrice a la grilla`, `${archivo} arma el producto sin la oferta, así que la grilla muestra el precio de lista`);
}

// ── 5. Donde hay oferta, se VE: UNA sola promo por tarjeta y por ficha ──────
// Pedido de Ishtar (8/9): "la idea es que la oferta se vea". Hasta el 15/10 eso
// era cartel de % + precio de lista tachado + "15% OFF transf." en la misma
// tarjeta, y en la ficha además un chip rojo sobre la foto: tres precios y dos
// descuentos que se leían como si se sumaran (auditoría de fichas del 15/10,
// plan tienda Fase 1.3). Ahora la oferta se ve con el sello de la rebaja
// ("26% OFF 🔥"), que es la ÚNICA promo cuando hay rebaja: ni tachado ni 15 %
// al lado. Sin rebaja, el 15 % explica el número. La regla vive en
// src/lib/promo-visible.ts y todas las superficies la leen de ahí.
{
    const conRebaja = promoVisible({ enOferta: true, descuentoPct: 26 }, 15);
    if (conRebaja.sello === '26% OFF' && !/\d+%/.test(conRebaja.etiquetaTransferencia) && !/\d+%/.test(conRebaja.etiquetaTransferenciaCorta)) ok('promoVisible con rebaja: el sello es la única promo, la etiqueta no repite el 15 %');
    else mal('promoVisible con rebaja', JSON.stringify(conRebaja));
    const sinRebaja = promoVisible({ enOferta: false, descuentoPct: 0 }, 15);
    if (sinRebaja.sello === null && sinRebaja.etiquetaTransferencia === '15% OFF por transferencia' && sinRebaja.etiquetaTransferenciaCorta === '15% OFF transf.') ok('promoVisible sin rebaja: sin sello, el 15 % explica el número');
    else mal('promoVisible sin rebaja', JSON.stringify(sinRebaja));
}
const MUESTRAN_LA_OFERTA = [
    ['src/components/Storefront/HomeProductCarousel.tsx', 'carrusel del home', true],
    ['src/components/Storefront/CategoryGrid.tsx', 'grilla de categoría', true],
    ['src/app/tienda/TiendaClient.tsx', 'grilla de /tienda', true],
    ['src/app/producto/[slug]/ProductClient.tsx', 'ficha de producto', false],
    ['src/components/Storefront/StorefrontNavbar.tsx', 'buscador', false],
];
for (const [archivo, queEs, conCartelSobreLaFoto] of MUESTRAN_LA_OFERTA) {
    const src = readFileSync(resolve(raiz, archivo), 'utf8');
    const cartel = conCartelSobreLaFoto ? /OFF\s*🔥/.test(src) : true;
    const usaLaRegla = src.includes('promoVisible(');
    // El tachado del precio de transferencia sin oferta era la segunda promo.
    const tachaLaOferta = /transferenciaSinOferta[\s\S]{0,300}line-through/.test(src);
    // El 15 % escrito a mano al lado del precio, fuera de la regla.
    const quinceAMano = /\{descuentoTransferenciaPct\}% OFF transf\.|\{cashDiscount\}% OFF por transferencia|Transferencia \{descuentoTransferenciaPct\}% OFF/.test(src);
    if (cartel && usaLaRegla && !tachaLaOferta && !quinceAMano) ok(`${queEs}: una sola promo visible (promo-visible.ts)`);
    else mal(`${queEs}: más de una promo a la vista`, `cartel: ${cartel ? 'sí' : 'NO'} · usa promoVisible: ${usaLaRegla ? 'sí' : 'NO'} · tacha la oferta: ${tachaLaOferta ? 'SÍ' : 'no'} · 15 % a mano: ${quinceAMano ? 'SÍ' : 'no'}`);
}
// El chip rojo "-9% OFF" sobre la foto de la ficha: fuera.
{
    const ficha = readFileSync(resolve(raiz, 'src/app/producto/[slug]/ProductClient.tsx'), 'utf8');
    if (!/-\{pctOff\}% OFF|-\{[a-zA-Z.]+\}% OFF/.test(ficha)) ok('ficha: sin chip de % sobre la foto');
    else mal('ficha: volvió el chip de % sobre la foto', 'la rebaja se dice una sola vez, al lado del precio');
}

// ── 6. Los números de la TARJETA salen de UN lugar (10/10/2026) ─────────────
// El buscador mostraba el de tarjeta ($215.000) y la grilla el de
// transferencia ($182.750) por el mismo anteojo; los relacionados de la ficha
// con oferta, el de tarjeta en rojo; el home y el carrito, el 15 % y las 6
// cuotas escritos a mano (no seguían a /admin/web).
{
    const v = PricingService.vidrieraDeProducto({ price: 215000, salePrice: 160000 }, { descuentoTransferenciaPct: 15, cuotasSinInteres: 6 });
    if (v.enOferta && v.transferencia === 136000 && v.transferenciaSinOferta === 182750 && v.valorCuota === Math.round(160000 / 6) && v.precio === 160000) ok('vidrieraDeProducto con oferta: transferencia 136.000, tachado 182.750, cuota sobre 160.000');
    else mal('vidrieraDeProducto con oferta', JSON.stringify(v));
    const s = PricingService.vidrieraDeProducto({ price: 215000 }, { descuentoTransferenciaPct: 10, cuotasSinInteres: 3 });
    if (!s.enOferta && s.transferencia === 193500 && s.transferenciaSinOferta === null && s.cuotas === 3 && s.valorCuota === Math.round(215000 / 3)) ok('vidrieraDeProducto sin oferta sigue al % y a las cuotas de /admin/web');
    else mal('vidrieraDeProducto sin oferta', JSON.stringify(s));
}
const TARJETAS = [
    ['src/app/tienda/TiendaClient.tsx', 'grilla de /tienda'],
    ['src/components/Storefront/CategoryGrid.tsx', 'grilla de categoría'],
    ['src/components/Storefront/HomeProductCarousel.tsx', 'carrusel del home'],
    ['src/app/producto/[slug]/ProductClient.tsx', 'relacionados de la ficha'],
    ['src/components/Storefront/StorefrontNavbar.tsx', 'buscador'],
];
for (const [archivo, queEs] of TARJETAS) {
    const src = readFileSync(resolve(raiz, archivo), 'utf8');
    const usa = src.includes('PricingService.vidrieraDeProducto(');
    const aMano = /\(1 - discountRate\)|web_promo_cash_discount \|\| 15\) \/ 100|preciosVidriera\([^)]*,\s*15\)|6 cuotas sin interés de \$/.test(src);
    if (usa && !aMano) ok(`${queEs}: los números salen de vidrieraDeProducto`);
    else mal(`${queEs}: calcula la tarjeta por su lado`, `usa vidrieraDeProducto: ${usa ? 'sí' : 'NO'} · cálculo a mano: ${aMano ? 'SÍ' : 'no'}`);
}
{
    const carrito = readFileSync(resolve(raiz, 'src/components/Storefront/CartSidebar.tsx'), 'utf8');
    if (!/preciosVidriera\([^)]*,\s*15\)|>6 cuotas sin interés</.test(carrito)) ok('carrito: el % y las cuotas salen de /admin/web (usePromo2x1)');
    else mal('carrito: el 15 % o las 6 cuotas siguen escritos a mano', 'usar descuentoTransferenciaPct / cuotasSinInteres de usePromo2x1');
}

// ── 7. El cartel de arriba no promete lo que la tienda no cumple (10/10/2026) ─
// Dos niveles: "efectivo" es inequívoco (no se guarda y no se muestra);
// "12 sin interés" lo detecta una lectura del texto que puede equivocarse
// (al guardar pide confirmación; al mostrar no reemplaza nada).
{
    const vivo = '6 Cuotas Sin Interés • Hasta 12 Pagos • 15% OFF en Efectivo o Transferencia • Envío Gratis';
    const rv = revisarCartel(vivo);
    if (rv.bloqueantes.length === 1 && rv.dudosos.length === 0) ok('el cartel que había en producción ("en Efectivo o Transferencia") se bloquea');
    else mal('el cartel de producción no se bloquea como corresponde', JSON.stringify(rv));
    const doce = ['Hasta 12 cuotas sin interés', 'Hasta 12 cuotas, sin interés', 'Sin interés hasta en 12 cuotas', '12 s/interés', '12 CSI', 'Doce cuotas sin interés',
        'Hasta 12x sin interés', 'Cuotas x12 sin interés', '3/6/12 cuotas sin interés', '3,6,12 sin interés', 'Hasta 12 cuotas • Sin interés', '12 cuotas sin-interés',
        '12 cuotas libres de interés', 'Hasta 12 cuotas fijas sin interés', '12 cuotas de $5.000 sin interés', 'Hasta 12 cuotas - Sin interés', 'Hasta 12 cuotas. Sin interés', '12 cuotas con todas las tarjetas sin interés', 'Sin interés en 3, 6 y 12 cuotas',
        // Ronda 6: la excepción de "fijas" y el número cortado ("15%" → "1", "48 hs" → "4").
        'Hasta 12 cuotas fijas sin interés, 15% OFF por transferencia', '12 cuotas fijas sin interés, 20% de descuento', 'Hasta 12 cuotas fijas sin interés en 48 hs',
        '12 cuotas fijas y sin interés', 'Hasta 12 cuotas mensuales sin interés', 'Hasta 12 cuotas bancarias sin interés', '12 cuotas con tu tarjeta sin interés',
        '12 cuotas en todas las tarjetas sin interés', 'Hasta 12 cuotas (sin interés)', '¡12 cuotas sin interés!', 'Cuotas sin interés: 6 o 12', '12 y 6 cuotas sin interés', '12 cuotas sin costo financiero', '12 cuotas tasa 0'];
    const validos = [CARTEL_PROMO_POR_DEFECTO, '3 y 6 cuotas sin interés, y hasta 12 cuotas fijas', 'Hasta 12 cuotas fijas y 3 o 6 sin interés', 'Hasta el 12/10: 6 cuotas sin interés',
        'Solo hasta el 12 de octubre: 3 y 6 cuotas sin interés', 'Armazones desde $12 mil en 6 cuotas sin interés', '6 cuotas sin interés de $12.000', 'Envío en 24 hs • 6 cuotas sin interés',
        'Hasta 12 cuotas fijas • Sin interés en 3 y 6 cuotas', 'Hasta 12 cuotas fijas • Débito sin recargo', 'Garantía de 12 meses • Cuotas sin interés',
        'Más de 20 años de experiencia • Cuotas sin interés', 'Hot Sale del 13 al 15 de mayo • Cuotas sin interés', 'Hasta el 24/12 • Cuotas sin interés en 3 y 6', 'Hasta 12 cuotas fijas sin interés en 3 y 6', '6 cuotas de $25.000 sin interés • hasta 12 fijas', 'Envío gratis - 6 cuotas sin interés', 'Cuotas sin interés en 120 días', 'Hasta 12 cuotas fijas sin interés en 3 y 6, 15% OFF', 'Hasta 12 cuotas fijas • 3 y 6 sin interés (con todas las tarjetas)'];
    const seEscapan = doce.filter((t) => revisarCartel(t).dudosos.length === 0);
    const seMarcan = validos.filter((t) => problemasDelCartel(t).length > 0);
    if (!seEscapan.length) ok(`las ${doce.length} formas de "12 sin interés" se detectan`); else mal('formas de "12 sin interés" que pasan', seEscapan.join(' | '));
    if (!seMarcan.length) ok(`los ${validos.length} carteles legítimos (fechas, garantía, horas, orden inverso) no se marcan`); else mal('carteles legítimos marcados', seMarcan.join(' | '));
    const rc = revisarConfiguracion('web_announcement_text', vivo), ro = revisarConfiguracion('web_store_phone', 'efectivo');
    if (rc.bloqueantes.length > 0 && ro.bloqueantes.length === 0 && ro.dudosos.length === 0) ok('revisarConfiguracion aplica la regla al cartel y a ninguna otra clave');
    else mal('revisarConfiguracion no aplica bien la regla', '');
    const ruta = readFileSync(resolve(raiz, 'src/app/api/settings/route.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const revisa = ruta.indexOf('revisarConfiguracion(key, value)');
    const r400 = ruta.indexOf('status: 400', revisa), r409 = ruta.indexOf('status: 409', revisa);
    const escribe = ruta.indexOf('systemSetting.upsert');
    if (revisa > -1 && r400 > revisa && r409 > revisa && escribe > Math.max(r400, r409) && /confirmado !== true/.test(ruta)) ok('la ruta revisa ANTES de escribir: 400 lo inequívoco, 409 lo dudoso sin confirmación');
    else mal('la ruta de configuración no revisa antes de escribir', `revisa ${revisa} · 400 ${r400} · 409 ${r409} · upsert ${escribe}`);
    // Al mostrar: lo inequívoco ya guardado deja de verse; lo dudoso NO se tapa.
    if (cartelQueSePuedeMostrar(vivo) === CARTEL_PROMO_POR_DEFECTO && cartelQueSePuedeMostrar('') === CARTEL_PROMO_POR_DEFECTO
        && cartelQueSePuedeMostrar('Garantía de 12 meses • Cuotas sin interés') === 'Garantía de 12 meses • Cuotas sin interés'
        && cartelQueSePuedeMostrar('Hasta 12 cuotas sin interés') === 'Hasta 12 cuotas sin interés') ok('al mostrar, solo lo inequívoco reemplaza el cartel (un falso positivo no tapa uno legítimo)');
    else mal('el cartel al mostrarse no respeta los dos niveles', '');
    const barra = readFileSync(resolve(raiz, 'src/components/Storefront/StorefrontNavbar.tsx'), 'utf8');
    if (/cartelQueSePuedeMostrar\(webSettings\?\.web_announcement_text\)/.test(barra)) ok('la barra de la tienda muestra el cartel con cartelQueSePuedeMostrar');
    else mal('la barra muestra el cartel guardado sin revisarlo', 'src/components/Storefront/StorefrontNavbar.tsx');
}

// ── 8. El bot cotiza con la oferta, igual que la tienda (10/10/2026) ───────
// Cotizaba a lista: con 58 de 160 armazones en oferta, el pie de la foto decía
// un precio más alto que la ficha que linkeaba.
{
    const sinComentarios = (r) => readFileSync(resolve(raiz, r), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const pricing = sinComentarios('src/app/api/bot/pricing/route.ts');
    const selects = (pricing.match(/salePrice:\s*true/g) || []).length;
    if (/PricingService\.vidrieraDeProducto\(\s*\{\s*price:[^}]*salePrice:\s*esCristal\s*\?\s*null\s*:\s*p\.salePrice/.test(pricing) && selects >= 3 && !/preciosVidriera\(p\.price/.test(pricing))
        ok('/api/bot/pricing: armazones con su oferta (vidrieraDeProducto) y salePrice en las 3 consultas');
    else mal('/api/bot/pricing no cotiza con la oferta', `selects con salePrice: ${selects}`);
    if (/priceCash:\s*precios\.transferencia/.test(pricing) && /priceCredit:\s*precios\.precio/.test(pricing) && /creditMonths:\s*precios\.cuotas/.test(pricing))
        ok('/api/bot/pricing: contado = transferencia, tarjeta = precio con oferta, cuotas vigentes');
    else mal('/api/bot/pricing: los campos del bot no salen de vidrieraDeProducto', '');
    const orders = sinComentarios('src/app/api/bot/orders/route.ts');
    if (/precioConOferta\(dbProd\)\.final/.test(orders)) ok('presupuesto del bot: el armazón va con su oferta, como el cotizador del CRM');
    else mal('presupuesto del bot a precio de lista', 'src/app/api/bot/orders/route.ts');
    const tools = sinComentarios('wa-service/tools.js');
    if (/\$\{meses\} cuotas sin interés/.test(tools) && !/6 cuotas sin interés de \*\$/.test(tools)) ok('wa-service escribe las cuotas que manda el CRM (no un 6 fijo)');
    else mal('wa-service tiene las 6 cuotas escritas a mano', 'wa-service/tools.js');
}

// ── Salida ───────────────────────────────────────────────────────────────────
console.log(`\n▶ Precio de oferta — ${casos.length} comprobaciones\n`);
for (const c of casos) {
    if (c.ok) console.log(`  ✅ ${c.nombre}`);
    else console.error(`  ❌ ${c.nombre}\n       ${c.detalle}`);
}
if (fallas) {
    console.error(`\n❌ ${fallas} problema(s). Un precio de oferta mal mostrado es un precio equivocado`);
    console.error(`   en la cara del cliente: o se anuncia más caro de lo que se cobra, o al revés.\n`);
    process.exit(1);
}
console.log(`\n✅ La oferta se resuelve con la misma regla en todas las superficies, y donde hay rebaja se ve.\n`);

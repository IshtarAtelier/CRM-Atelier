#!/usr/bin/env node
/**
 * Precios de los cristales de "Arma tus lentes": un solo cálculo, sin números
 * de respaldo, con el producto del sistema como única fuente.
 *
 * POR QUÉ EXISTE
 * Hasta el 26/9/2026 cada opción del configurador se priceaba buscando
 * productos por palabras clave, con el matcher copiado seis veces y tres tablas
 * de precios escritos a mano que tapaban cualquier hueco. Medido en producción
 * el 25/9: el cristal "Básico" se vendía a $20.000 (el sistema dice $34.480),
 * el teñido a $25.000 fijos (el sistema cobra $30.000/$40.000 por estilo) y el
 * "Multi Fotocromático" le adjuntaba al laboratorio un "Mi primer" que no
 * correspondía. Ninguna prueba lo veía.
 *
 * Este check fija:
 *   1. el cálculo (src/lib/cristales-web/calculo.ts) con casos reales, incluidos
 *      los carritos viejos que siguen guardados en los navegadores;
 *   2. que tienda y checkout usen ESE cálculo y no una copia;
 *   3. que no vuelva ningún número de respaldo ni el matcher por palabras clave.
 *
 * Corre sin base y sin red (va en el CI).
 * Uso: npm run check:cristales
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { calcularConfiguracion, precioPorOjo } from '../../src/lib/cristales-web/calculo.ts';
import {
    CLAVES_OPCION,
    avisosDeVinculo,
    claveDeCristal,
    describirConfiguracion,
    esArchivado,
    precioMultifocalDesdeDe,
    productoEncajaEnGrupo,
    tenidoDeConfig,
    variluxHabilita2x1,
} from '../../src/lib/cristales-web/claves.ts';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const casos = [];
let fallas = 0;
const ok = (nombre) => casos.push({ nombre, ok: true });
const mal = (nombre, detalle) => { fallas++; casos.push({ nombre, ok: false, detalle }); };
const esperar = (nombre, real, esperado) => {
    if (JSON.stringify(real) === JSON.stringify(esperado)) ok(nombre);
    else mal(nombre, `esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(real)}`);
};

// ── Fixture: las opciones como las publica GET /api/web/pricing ─────────────
const op = (clave, precio, extra = {}) => {
    const [grupo, codigo] = clave.split('.');
    return {
        clave, grupo, codigo, etiqueta: extra.etiqueta ?? codigo, descripcion: null, badge: null, destacados: [], orden: 0,
        disponible: precio !== null, motivo: precio === null ? 'SIN_PRODUCTO' : null, precio,
        nombreProducto: precio === null ? null : `Producto ${codigo}`, is2x1: extra.is2x1 ?? false,
        productId: precio === null ? null : `id-${codigo}`,
    };
};
const OPCIONES = Object.fromEntries([
    op('MONOFOCAL.ORGANICO_BLANCO', 34480),
    op('MONOFOCAL.ORGANICO_AR', 49500, { etiqueta: 'Antirreflex (Evita Brillos)' }),
    op('MONOFOCAL.ORGANICO_BLUE', 75314, { etiqueta: 'Super Blue' }),
    op('MONOFOCAL.POLI_BLUE', null),
    op('BIFOCAL.ORGANICO_BLANCO', 152088),
    op('MULTIFOCAL.SMART_FREE', 332577),
    op('MULTIFOCAL.VARILUX', 1404103, { is2x1: true, etiqueta: 'Varilux Premium' }),
    op('MULTIFOCAL.FOTOCROMATICO', 462281),
    op('TENIDO.COMPACTO', 30000, { etiqueta: 'Compacto' }),
    op('TENIDO.DEGRADE', 40000, { etiqueta: 'Degradé' }),
].map(o => [o.clave, o]));
const calc = (lensConfig, basePrice = 160000, opciones = OPCIONES) => calcularConfiguracion({ basePrice, lensConfig, opciones });
const lc = (x) => ({ lensType: null, treatment: null, color: null, prescriptionFile: null, ...x });

// ── 1. El cálculo ────────────────────────────────────────────────────────────
esperar('solo armazón: el total es el armazón',
    calc(lc({ lensType: 'NONE' })), { ok: true, total: 160000, armazon: 160000, cristal: null, tenido: null, bonificado2x1: false });

const ar = calc(lc({ lensType: 'MONOFOCAL', treatment: 'ORGANICO_AR' }));
esperar('monofocal antirreflex: armazón + precio del producto vinculado', ar.ok && [ar.total, ar.cristal.productId], [209500, 'id-ORGANICO_AR']);

const poli = calc(lc({ lensType: 'MONOFOCAL', treatment: 'POLI_BLUE' }));
esperar('opción sin producto vinculado: se rechaza, NUNCA un precio de respaldo', [poli.ok, typeof poli.error], [false, 'string']);

const inventada = calc(lc({ lensType: 'MONOFOCAL', treatment: 'ORGANICO_BLANCO_TENIDO' }));
esperar('opción que no existe (carrito viejo con una clave borrada): se rechaza', inventada.ok, false);

esperar('bifocal con "UNICO" (carritos anteriores al 26/9): es la opción bifocal',
    claveDeCristal(lc({ lensType: 'BIFOCAL', treatment: 'UNICO' })).clave, 'BIFOCAL.ORGANICO_BLANCO');

const solCompacto = calc(lc({ lensType: 'NONE', treatment: 'ORGANICO_BLANCO', color: 'Gris', tintStyle: 'COMPACTO' }));
esperar('sol sin aumento compacto: armazón + orgánico blanco + teñido compacto',
    solCompacto.ok && [solCompacto.total, solCompacto.cristal.clave, solCompacto.tenido.clave, solCompacto.tenido.tono],
    [160000 + 34480 + 30000, 'MONOFOCAL.ORGANICO_BLANCO', 'TENIDO.COMPACTO', 'Gris']);

const solMulti = calc(lc({ lensType: 'MULTIFOCAL', treatment: 'SMART_FREE', color: 'Sepia', tintStyle: 'DEGRADE' }));
esperar('sol multifocal degradé: multifocal de entrada + teñido degradé',
    solMulti.ok && solMulti.total, 160000 + 332577 + 40000);

esperar('carrito viejo "Naranja (DEGRADÉ)": se lee tono y estilo',
    tenidoDeConfig(lc({ color: 'Naranja (DEGRADÉ)' })), { tono: 'Naranja', estilo: 'DEGRADE' });
esperar('carrito viejo "Gris (COMPACTO)": se cobra como compacto',
    calc(lc({ lensType: 'MONOFOCAL', treatment: 'ORGANICO_BLANCO', color: 'Gris (COMPACTO)' })).total, 160000 + 34480 + 30000);
esperar('"SEGÚN MUESTRA" no se vende en la web: se rechaza',
    calc(lc({ lensType: 'NONE', color: 'Gris (SEGÚN MUESTRA)' })).ok, false);

esperar('segundo par del 2x1 Varilux: todo en $0',
    calc(lc({ lensType: 'MULTIFOCAL', treatment: 'VARILUX', secondPair2x1: true })).total, 0);
esperar('el 2x1 solo se ofrece si el Varilux vinculado es un producto 2x1',
    [variluxHabilita2x1(OPCIONES), variluxHabilita2x1({ ...OPCIONES, 'MULTIFOCAL.VARILUX': { ...OPCIONES['MULTIFOCAL.VARILUX'], is2x1: false } })],
    [true, false]);

esperar('el par se parte por ojo como en el mostrador', [precioPorOjo(75314), precioPorOjo(34481)], [37657, 17241]);

// ── 2. Reglas del producto vinculado ─────────────────────────────────────────
esperar('archivado: criterio laxo del cotizador', [esArchivado('[ARCHIVADO] X'), esArchivado(' [archivado] X'), esArchivado('X')], [true, true, false]);
esperar('encaje por grupo',
    [
        productoEncajaEnGrupo('MONOFOCAL', { category: 'Cristal', type: 'Cristal Monofocal', name: 'Stock · Orgánico Blanco 1.49' }),
        productoEncajaEnGrupo('MONOFOCAL', { category: 'Cristal', type: 'Cristal Multifocal', name: 'x' }),
        productoEncajaEnGrupo('TENIDO', { category: 'Tratamiento', type: 'Tratamiento Colores de Cristal', name: 'Teñido Compacto · Grupo Óptico' }),
        productoEncajaEnGrupo('TENIDO', { category: 'Tratamiento', type: null, name: 'Biconvexo' }),
    ],
    [true, false, true, false]);
esperar('aviso: "Mi primer" no puede ser un multifocal publicado',
    avisosDeVinculo('MULTIFOCAL.SMART_FREE', { name: 'MI PRIMER VARILUX COMFORT', is2x1: false }).length > 0, true);
esperar('desde de multifocales = el más barato disponible', precioMultifocalDesdeDe(Object.values(OPCIONES)), 332577);
esperar('sin multifocales disponibles no hay "desde" (nunca un número inventado)',
    precioMultifocalDesdeDe([{ grupo: 'MULTIFOCAL', disponible: false, precio: null }]), null);
esperar('descripción única: carrito, mails y checkout dicen lo mismo',
    [
        describirConfiguracion(lc({ lensType: 'MONOFOCAL', treatment: 'ORGANICO_BLUE' }), OPCIONES),
        describirConfiguracion(lc({ lensType: 'NONE', treatment: 'ORGANICO_BLANCO', color: 'Gris', tintStyle: 'COMPACTO' }), OPCIONES),
        describirConfiguracion(lc({ lensType: 'MULTIFOCAL', treatment: 'VARILUX', etiqueta: 'Varilux Premium' })),
    ],
    ['Monofocal · Super Blue', 'Sin aumento · Teñido Gris compacto', 'Multifocal · Varilux Premium']);

// ── 3. Estático: una sola fuente, ningún respaldo ────────────────────────────
const leer = (rel) => readFileSync(resolve(raiz, rel), 'utf8');
const DEBEN_USAR_EL_CALCULO = {
    'src/components/Storefront/LensConfigurator.tsx': /calcularConfiguracion\(/,
    'src/lib/checkout/checkout-pricing.ts': /calcularConfiguracion\(/,
    'src/app/api/checkout/payway/route.ts': /calcularItemDeCarrito\(/,
    'src/app/api/web/pricing/route.ts': /mapaOpcionesPublico\(/,
    'src/lib/pricing/multifocal-desde.ts': /resolverOpcionesDeCristal\(/,
    'scripts/social/generar-multifocal.mjs': /resolverOpcionesDeCristal\(/,
};
for (const [archivo, patron] of Object.entries(DEBEN_USAR_EL_CALCULO)) {
    if (patron.test(leer(archivo))) ok(`${archivo} usa la fuente única`);
    else mal(`${archivo} usa la fuente única`, `no encontré ${patron}`);
}
if (existsSync(resolve(raiz, 'src/lib/config/crystal-mapping.ts'))) mal('el matcher por palabras clave no vuelve', 'existe src/lib/config/crystal-mapping.ts');
else ok('el matcher por palabras clave no vuelve');

// Números de respaldo: `|| 20000`, `?? 45000`, o una tabla `ORGANICO_AR: 45000`.
const RESPALDO = /(\|\||\?\?)\s*\d{4,}|\b(ORGANICO_[A-Z_]+|POLI_BLUE|SMART_FREE|VARILUX|FOTOCROMATICO|TINT)\s*:\s*\d{4,}/;
for (const archivo of [
    'src/components/Storefront/LensConfigurator.tsx',
    'src/lib/checkout/checkout-pricing.ts',
    'src/app/api/web/pricing/route.ts',
    'src/app/api/checkout/payway/route.ts',
    'src/services/cristales-web.service.ts',
    'src/lib/cristales-web/calculo.ts',
    'src/lib/cristales-web/claves.ts',
]) {
    const lineas = leer(archivo).split('\n');
    const i = lineas.findIndex(l => RESPALDO.test(l) && !/^\s*(\/\/|\*)/.test(l));
    if (i === -1) ok(`${archivo} sin precios de respaldo`);
    else mal(`${archivo} sin precios de respaldo`, `línea ${i + 1}: ${lineas[i].trim().slice(0, 90)}`);
}

// La migración siembra exactamente las claves que conoce el código.
const migracion = leer('prisma/migrations/20260926_web_lens_option/migration.sql');
const faltan = CLAVES_OPCION.filter(c => !migracion.includes(`'${c}'`));
esperar('la migración siembra todas las claves del código', faltan, []);

// ── Resultado ────────────────────────────────────────────────────────────────
for (const c of casos) console.log(`${c.ok ? '✅' : '❌'} ${c.nombre}${c.ok ? '' : `\n     ${c.detalle}`}`);
console.log(`\n${casos.length - fallas}/${casos.length} en verde.`);
if (fallas) {
    console.error(`\n${fallas} falla(s). Ver docs/cristales-web.md.`);
    process.exit(1);
}

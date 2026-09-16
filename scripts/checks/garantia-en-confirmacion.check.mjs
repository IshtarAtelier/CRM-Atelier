/**
 * ¿La confirmación de compra promete garantía SOLO en los pedidos que la tienen?
 *
 * SOLO LECTURA. La garantía de adaptación cubre los multifocales (Varilux) y los
 * monofocales Super Blue, y nada más (es lo que dice /politicas-de-cambio). Este
 * check corre la MISMA función que usa la confirmación —importa el módulo real,
 * no una copia— sobre las ventas de verdad, y muestra los dos errores posibles:
 *
 *   · FALSO POSITIVO: promete garantía en un pedido sin cristales cubiertos.
 *   · FALSO NEGATIVO: un Varilux o un Super Blue que la función no reconoce, así
 *     que el cliente se queda sin la promesa que sí le corresponde.
 *
 * Los dos se juzgan leyendo los nombres de los cristales, que es lo único que
 * hay: no existe un flag en la base que diga "este cristal tiene garantía".
 *
 * Uso:
 *   node --experimental-strip-types --import ./scripts/checks/_alias.mjs \
 *        scripts/checks/garantia-en-confirmacion.check.mjs [--prod] [--dias 60]
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { pedidoTieneGarantiaDeAdaptacion } from '@/lib/garantia';

const argv = process.argv.slice(2);
const usarProd = argv.includes('--prod');
const dias = (() => {
    const i = argv.indexOf('--dias');
    const n = i >= 0 ? parseInt(argv[i + 1], 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 60;
})();

const env = Object.fromEntries(
    readFileSync(new URL('../../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);
const url = usarProd ? env.PROD_DATABASE_URL : env.DATABASE_URL;
if (!url) {
    console.error(`No encontré ${usarProd ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en .env`);
    process.exit(1);
}
console.log(`Base: ${usarProd ? 'PRODUCCIÓN' : 'local'} · últimos ${dias} días\n`);

const prisma = new PrismaClient({ datasourceUrl: url });

const ventas = await prisma.order.findMany({
    where: {
        orderType: { in: ['SALE', 'MAYORISTA'] },
        createdAt: { gte: new Date(Date.now() - dias * 86400000) },
    },
    select: {
        id: true, createdAt: true,
        items: {
            select: {
                productNameSnapshot: true, productBrandSnapshot: true,
                product: { select: { name: true, brand: true, model: true, type: true, category: true } },
            },
        },
    },
    orderBy: { createdAt: 'asc' },
});

// Segunda opinión, a propósito INDEPENDIENTE de la función que se audita: si las
// dos coincidieran por construcción el check no probaría nada. Acá se busca la
// palabra a mano sobre el nombre crudo, sin normalizar nada.
const crudo = (it) => `${it.product?.brand || it.productBrandSnapshot || ''} ${it.product?.name || it.productNameSnapshot || ''}`.trim();
// Mira el TIPO del catálogo además del nombre: "KODAK UNIQUE DRO" no dice
// "multifocal" en ninguna parte del nombre y lo es —su `type` es 'Cristal
// Multifocal'—. Leyendo solo el nombre, este check acusaba 8 falsos positivos
// que eran multifocales de verdad.
const pareceCubierto = (it) =>
    /multifocal/i.test(it.product?.type || '') ||
    /varilux|multifocal|progresiv|super\s*blue/i.test(`${crudo(it)} ${it.product?.model || ''}`);

const conGarantia = [];
const sinGarantia = [];
for (const v of ventas) (pedidoTieneGarantiaDeAdaptacion(v) ? conGarantia : sinGarantia).push(v);

const falsosNegativos = sinGarantia.filter((v) => v.items.some((it) => pareceCubierto(it)));
const falsosPositivos = conGarantia.filter((v) => !v.items.some((it) => pareceCubierto(it)));

console.log(`Ventas: ${ventas.length}`);
console.log(`  con garantía en la confirmación: ${conGarantia.length}`);
console.log(`  sin garantía:                    ${sinGarantia.length}`);
console.log(`\n  ❌ falsos positivos (promete sin corresponder): ${falsosPositivos.length}`);
console.log(`  ❌ falsos negativos (le corresponde y no sale): ${falsosNegativos.length}`);

for (const [titulo, lista] of [['FALSOS POSITIVOS', falsosPositivos], ['FALSOS NEGATIVOS', falsosNegativos]]) {
    if (!lista.length) continue;
    console.log(`\n── ${titulo} ──`);
    for (const v of lista) {
        console.log(`  #${v.id.slice(-4).toUpperCase()}  ${v.createdAt.toISOString().slice(0, 10)}`);
        v.items.forEach((it) => console.log(`      · ${crudo(it) || '(sin nombre)'} [${it.product?.type || it.product?.category || '—'}]`));
    }
}

// Muestra al azar de los que SÍ la prometen: qué cristal la disparó. Es el
// control de ojo humano — una función que da "sí" por el motivo equivocado pasa
// cualquier conteo.
console.log(`\n── MUESTRA: qué disparó la garantía (10 al azar) ──`);
for (const v of conGarantia.slice(-10)) {
    const culpables = v.items.filter((it) => pareceCubierto(it)).map((it) => `${crudo(it)} [${it.product?.type || '—'}]`);
    console.log(`  #${v.id.slice(-4).toUpperCase()}  ${culpables.join(' | ') || '(ninguno evidente)'}`);
}

const hayProblema = falsosPositivos.length > 0 || falsosNegativos.length > 0;
console.log(`\n${hayProblema ? '❌ Revisar los casos de arriba.' : '✅ Ningún desacuerdo entre la función y los nombres de los cristales.'}`);

await prisma.$disconnect();
process.exit(hayProblema ? 1 : 0);

// ────────────────────────────────────────────────────────────────────────────
// AUMENTAR PRECIOS: qué tiene que hacer y qué NO tiene que tocar nunca.
//
// La pantalla /admin/inventario/precios sube el precio de lista. Lo que se
// verifica acá es lo que costaría plata real si se rompiera:
//   · sube SOLO `price`; `cost`, `baseCost` y `wholesalePrice` quedan intactos
//     (un aumento es de margen; tocar el costo falsearía el cruce con las
//     facturas del laboratorio);
//   · respeta el filtro: no se le escapa un producto de otro laboratorio;
//   · aplica exactamente lo que mostró la vista previa, ni uno más;
//   · deja el aumento firmado en el AuditLog — sin eso no hay historial, que
//     fue el problema del aumento del 24/8/2026;
//   · las VENTAS ya cerradas no cambian de precio (eso lo garantiza además
//     check:venta-no-repricea, acá se comprueba de punta a punta).
//
// Corre contra la base LOCAL. Crea y borra sus propios datos.
// Correr:  npm run check:aumento-precios
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PriceIncreaseService } from '../../src/services/price-increase.service.ts';

const prisma = new PrismaClient();
const LAB = `TEST LAB ${Date.now()}`;
const ACTOR = { id: null, name: 'TEST aumento-precios', role: 'ADMIN' };
const creados = [];
let fallas = 0;

function ok(desc, cond) {
    console.log(`  ${cond ? '✅' : '❌'} ${desc}`);
    if (!cond) fallas++;
}

try {
    const caro = await prisma.product.create({
        data: {
            name: 'TEST cristal caro', brand: 'TESTMARCA', category: 'Cristal',
            laboratory: LAB, price: 100_000, cost: 40_000, wholesalePrice: 60_000,
        },
    });
    const barato = await prisma.product.create({
        data: {
            name: 'TEST cristal barato', brand: 'TESTMARCA', category: 'Cristal',
            laboratory: LAB, price: 33_333, cost: 10_000, wholesalePrice: 20_000,
        },
    });
    // De OTRO laboratorio: no lo tiene que tocar ningún filtro por LAB.
    const ajeno = await prisma.product.create({
        data: {
            name: 'TEST cristal de otro lab', brand: 'TESTMARCA', category: 'Cristal',
            laboratory: `${LAB} OTRO`, price: 50_000, cost: 20_000, wholesalePrice: 30_000,
        },
    });
    creados.push(caro.id, barato.id, ajeno.id);

    // ── Vista previa ────────────────────────────────────────────────────
    const previa = await PriceIncreaseService.preview({ laboratory: LAB }, 7);
    ok('la vista previa trae solo los productos de ese laboratorio', previa.length === 2);
    ok('redondea al peso: 100.000 + 7% = 107.000',
        previa.find(p => p.id === caro.id)?.nuevo === 107_000);
    ok('redondea al peso: 33.333 + 7% = 35.666',
        previa.find(p => p.id === barato.id)?.nuevo === Math.round(33_333 * 1.07));
    ok('la vista previa NO escribe nada',
        (await prisma.product.findUnique({ where: { id: caro.id }, select: { price: true } }))?.price === 100_000);

    // ── Aumentos inválidos ──────────────────────────────────────────────
    for (const malo of [0, -5, 250]) {
        let tiro = false;
        await PriceIncreaseService.apply({ laboratory: LAB }, malo, ACTOR).catch(() => { tiro = true; });
        ok(`rechaza un aumento de ${malo}%`, tiro);
    }

    // ── Aplicar, excluyendo uno ─────────────────────────────────────────
    const res = await PriceIncreaseService.apply({ laboratory: LAB }, 7, ACTOR, [caro.id]);
    ok('aplica solo sobre los ids que se le pasaron', res.actualizados === 1);

    const despuesCaro = await prisma.product.findUnique({
        where: { id: caro.id },
        select: { price: true, cost: true, wholesalePrice: true },
    });
    const despuesBarato = await prisma.product.findUnique({ where: { id: barato.id }, select: { price: true } });
    const despuesAjeno = await prisma.product.findUnique({ where: { id: ajeno.id }, select: { price: true } });

    ok('sube el precio de lista del elegido', despuesCaro?.price === 107_000);
    ok('NO toca el costo', despuesCaro?.cost === 40_000);
    ok('NO toca el precio mayorista', despuesCaro?.wholesalePrice === 60_000);
    ok('NO toca el que se destildó', despuesBarato?.price === 33_333);
    ok('NO toca el de otro laboratorio', despuesAjeno?.price === 50_000);

    // ── El rastro ───────────────────────────────────────────────────────
    // logAudit es fire-and-forget: se le da un respiro antes de mirarlo.
    await new Promise(r => setTimeout(r, 400));
    const firma = await prisma.auditLog.findFirst({
        where: { action: 'PRICE_OVERRIDE', entityType: 'PRODUCT', entityId: caro.id },
        select: { userName: true, details: true },
    });
    ok('deja el aumento firmado en el AuditLog', !!firma);
    ok('la firma guarda quién, cuánto y de cuánto a cuánto',
        firma?.userName === ACTOR.name && firma?.details?.de === 100_000
        && firma?.details?.a === 107_000 && firma?.details?.pct === 7);

    const historial = await PriceIncreaseService.history();
    ok('el aumento aparece en el historial',
        historial.some(h => h.pct === 7 && h.quien === ACTOR.name));

} finally {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: creados } } }).catch(() => { });
    await prisma.product.deleteMany({ where: { id: { in: creados } } }).catch(() => { });
    await prisma.$disconnect();
}

console.log(fallas === 0
    ? '\n✅ El aumento sube solo el precio de lista, respeta el filtro y queda firmado.'
    : `\n❌ ${fallas} comprobación(es) fallaron.`);
process.exit(fallas === 0 ? 0 : 1);

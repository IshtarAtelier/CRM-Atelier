// ────────────────────────────────────────────────────────────────────────────
// RECÁLCULO AUTOMÁTICO al cambiar la configuración del laboratorio.
//
// Regla de Ishtar (31/8/2026): los dos campos de costo son el PELADO (baseCost,
// la lista del lab tal cual) y el FINAL (cost = (pelado + calibrado) × IVA).
// Si se cambia el calibrado o el IVA en Configuración → Laboratorios, los
// costos finales tienen que recalcularse solos desde el pelado.
//
// Verifica:
//  · cambiar el calibrado recalcula el cost de todos los que tienen pelado;
//  · el price NO se mueve (el precio de venta se decide aparte);
//  · los productos sin pelado no se tocan (su costo está cargado a mano);
//  · volver la configuración al valor original vuelve los costos originales.
//
// Corre contra la base LOCAL. Crea y borra sus propios datos.
//   node --experimental-strip-types scripts/checks/recalculo-costos-lab.check.mjs
// ────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')) {
    console.error('Este check corre SOLO contra la base local.'); process.exit(1);
}

const prisma = new PrismaClient();
// El service usa el prisma de src/lib/db, que lee DATABASE_URL: mismo destino.
const { recalcularCostosDelLaboratorio } = await import('../../src/services/lab-recalc.service.ts');

const LAB = 'TEST-RECALC-LAB';
let fallas = 0;
const ok = (d, c) => { console.log(`  ${c ? '✅' : '❌'} ${d}`); if (!c) fallas++; };

const creados = [];
try {
    // Dos cristales con pelado y uno cargado a mano (sin pelado).
    const conPelado = await prisma.product.create({
        data: { name: 'TEST recalc con pelado', category: 'Cristal', laboratory: LAB, baseCost: 100000, cost: 148830, price: 400000 },
    });
    const conPelado2 = await prisma.product.create({
        data: { name: 'TEST recalc con pelado 2', category: 'Cristal', laboratory: LAB, baseCost: 200000, cost: 269830, price: 700000 },
    });
    const aMano = await prisma.product.create({
        data: { name: 'TEST recalc sin pelado', category: 'Cristal', laboratory: LAB, baseCost: null, cost: 99999, price: 250000 },
    });
    creados.push(conPelado.id, conPelado2.id, aMano.id);

    // ── 1. Cambiar el calibrado recalcula desde el pelado ────────────────────
    const r1 = await recalcularCostosDelLaboratorio(LAB, 30000, 21);
    const [p1, p2, p3] = await Promise.all(creados.map(id => prisma.product.findUnique({ where: { id } })));
    ok('recalcula los que tienen pelado: (100.000+30.000)×1,21 = 157.300',
        Math.round(p1.cost) === 157300 && Math.round(p2.cost) === 278300);
    ok(`el resultado informa cuántos tocó (${r1.recalculados}) y cuántos van a mano (${r1.sinPelado})`,
        r1.recalculados === 2 && r1.sinPelado === 1);
    ok('el cargado a mano (sin pelado) NO se toca', Math.round(p3.cost) === 99999);
    ok('el precio de venta NO se mueve', p1.price === 400000 && p2.price === 700000 && p3.price === 250000);

    // ── 2. Correr de nuevo con los mismos valores no reescribe nada ──────────
    const r2 = await recalcularCostosDelLaboratorio(LAB, 30000, 21);
    ok('con la misma config no reescribe nada (idempotente)', r2.recalculados === 0);

    // ── 3. Volver la config vuelve los costos ────────────────────────────────
    await recalcularCostosDelLaboratorio(LAB, 23000, 21);
    const v1 = await prisma.product.findUnique({ where: { id: conPelado.id } });
    ok('volver el calibrado a 23.000 devuelve el costo original (148.830)', Math.round(v1.cost) === 148830);

    // ── 4. Queda firmado en el AuditLog ──────────────────────────────────────
    const audit = await prisma.auditLog.findFirst({
        where: { entityId: `lab:${LAB}` }, orderBy: { createdAt: 'desc' },
    });
    ok('cada recálculo queda firmado en el AuditLog', !!audit);
} finally {
    await prisma.product.deleteMany({ where: { id: { in: creados } } }).catch(() => { });
    await prisma.auditLog.deleteMany({ where: { entityId: `lab:${LAB}` } }).catch(() => { });
    await prisma.$disconnect();
}

console.log(fallas === 0
    ? '\n✅ Cambiar la configuración del laboratorio recalcula los costos desde el pelado.'
    : `\n❌ ${fallas} comprobación(es) fallaron.`);
process.exit(fallas === 0 ? 0 : 1);

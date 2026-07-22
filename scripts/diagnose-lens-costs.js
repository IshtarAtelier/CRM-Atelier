/**
 * Diagnóstico de costos de cristales — SOLO LECTURA, no escribe nada.
 *
 * Busca costos que puedan haber quedado inflados por el viejo botón "Calcular Final"
 * (que re-aplicaba calibrado + IVA sobre un costo que ya los tenía).
 *
 * Dos detectores:
 *
 *  1. AUDITORÍA (evidencia directa). Cada edición de producto deja en AuditLog el
 *     costo antes y después. Si un cambio guardado cumple
 *         después = redondeo((antes + calibrado) × (1 + IVA))
 *     ese click aplicó la fórmula sobre un costo que ya era final. Queda el costo
 *     anterior para poder restaurarlo. Solo alcanza el período con auditoría.
 *
 *  2. MARKUP (indicio). La regla del negocio es precio ≥ costo × 2,4. Un costo
 *     inflado hunde el markup por debajo del piso. No prueba nada por sí solo
 *     (puede ser un precio desactualizado), pero marca dónde mirar.
 *
 * Uso:
 *   node scripts/diagnose-lens-costs.js           → base LOCAL
 *   node scripts/diagnose-lens-costs.js --prod    → base de PRODUCCIÓN (solo lectura)
 */

const { PrismaClient } = require('@prisma/client');

const USE_PROD = process.argv.includes('--prod');
const url = USE_PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
    console.error(USE_PROD ? 'Falta PROD_DATABASE_URL en el entorno' : 'Falta DATABASE_URL en el entorno');
    process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });

// El piso del negocio es 2,4×. Se marca solo lo que queda claramente por debajo:
// muchos productos están clavados en 2,40× a propósito (precio = costo × 2,4).
const MARKUP_FLOOR = 2.35;
const money = n => '$' + Math.round(n).toLocaleString('es-AR');

const applyFormula = (base, lab, is2x1) => {
    const calibrado = (lab.calibrado || 0) * (is2x1 ? 2 : 1);
    return Math.round((base + calibrado) * (1 + (lab.iva || 0) / 100));
};

async function main() {
    console.log(`\nBase: ${USE_PROD ? 'PRODUCCIÓN' : 'local'} — solo lectura\n`);

    const labs = await prisma.laboratoryConfig.findMany();
    const labByName = new Map(labs.map(l => [l.name.toUpperCase(), l]));

    const cristales = await prisma.product.findMany({
        where: { category: 'Cristal' },
        select: { id: true, name: true, brand: true, type: true, laboratory: true, cost: true, price: true, is2x1: true },
        orderBy: { name: 'asc' },
    });

    // ---- Detector 1: la auditoría muestra la fórmula aplicada sobre un costo ya final
    const audits = await prisma.auditLog.findMany({
        where: { entityType: 'PRODUCT', action: 'UPDATE' },
        orderBy: { createdAt: 'asc' },
    });

    const byId = new Map(cristales.map(p => [p.id, p]));
    const confirmados = [];
    for (const a of audits) {
        const d = a.details;
        const antes = d?.before?.cost;
        const despues = d?.after?.cost;
        if (typeof antes !== 'number' || typeof despues !== 'number' || despues <= antes) continue;
        const prod = byId.get(a.entityId);
        if (!prod) continue;
        const lab = labByName.get((prod.laboratory || '').toUpperCase());
        if (!lab) continue;
        const is2x1 = prod.is2x1 || (prod.name || '').toLowerCase().includes('2x1');
        if (Math.abs(applyFormula(antes, lab, is2x1) - despues) <= 1) {
            confirmados.push({ prod, fecha: a.createdAt, quien: a.userName || '—', antes, despues });
        }
    }

    console.log('1) FÓRMULA APLICADA SOBRE UN COSTO YA FINAL (según auditoría)');
    if (audits.length === 0) {
        console.log('   Sin registros de auditoría de productos en esta base.\n');
    } else if (confirmados.length === 0) {
        console.log(`   Ninguno en ${audits.length} ediciones auditadas.\n`);
    } else {
        for (const c of confirmados) {
            const nombre = `${c.prod.brand || ''} ${c.prod.name || ''}`.trim();
            console.log(`   ${nombre}`);
            console.log(`      ${c.fecha.toISOString().slice(0, 10)} · ${c.quien} · ${money(c.antes)} → ${money(c.despues)} (+${money(c.despues - c.antes)})`);
            console.log(`      hoy tiene ${money(c.prod.cost)}${Math.round(c.prod.cost) === Math.round(c.despues) ? ' ← sigue inflado, restaurar a ' + money(c.antes) : ''}`);
        }
        console.log('');
    }

    // ---- Detector 2: markup por debajo del piso
    const sospechosos = [];
    for (const p of cristales) {
        if (!p.cost || p.cost <= 0 || !p.price) continue;
        const markup = p.price / p.cost;
        if (markup >= MARKUP_FLOOR) continue;
        const lab = labByName.get((p.laboratory || '').toUpperCase());
        const is2x1 = p.is2x1 || (p.name || '').toLowerCase().includes('2x1');
        // Cuánto quedaría el costo si se le sacara una aplicación de la fórmula
        let siSeSacaUna = null;
        if (lab) {
            const calibrado = (lab.calibrado || 0) * (is2x1 ? 2 : 1);
            siSeSacaUna = Math.round(p.cost / (1 + (lab.iva || 0) / 100) - calibrado);
        }
        sospechosos.push({ p, markup, siSeSacaUna });
    }
    sospechosos.sort((a, b) => a.markup - b.markup);

    console.log(`2) MARKUP POR DEBAJO DE ${MARKUP_FLOOR}× (${sospechosos.length} de ${cristales.length} cristales)`);
    for (const s of sospechosos) {
        const nombre = `${s.p.brand || ''} ${s.p.name || ''}`.trim().slice(0, 52);
        const arreglo = s.siSeSacaUna && s.siSeSacaUna > 0
            ? ` · sacándole una vuelta de fórmula: ${money(s.siSeSacaUna)} (markup ${(s.p.price / s.siSeSacaUna).toFixed(2)}×)`
            : '';
        console.log(`   ${nombre.padEnd(54)} costo ${money(s.p.cost).padStart(11)} precio ${money(s.p.price).padStart(11)} markup ${s.markup.toFixed(2)}×${arreglo}`);
    }
    console.log('');

    await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });

#!/usr/bin/env node
/**
 * Dónde cae cada caso de post venta con el pipeline nuevo, y cuáles quedan raros.
 *
 * SOLO LEE. No escribe nada. La normalización (mover los casos que ya tienen nº
 * de operación pero siguen en "Reportado") vive aparte, en
 * scripts/maintenance/postventa-normalizar-estados.mjs.
 *
 * El pipeline nuevo tiene 5 columnas y dos entran solas:
 *   Reportado → En laboratorio → Listo para retirar → Entregado · a cobrar → Cerrado
 * "En laboratorio" entra al cargar el nº de operación; "Cerrado" al descontarse
 * de caja. Las columnas viejas "Finalizado (Lab)" y "Listo p/ Retirar" se
 * fusionaron: en la práctica se usaban igual.
 *
 * Uso:
 *   node scripts/checks/postventa-pipeline.check.mjs            (base local)
 *   DATABASE_URL="$PROD_DATABASE_URL" node scripts/checks/postventa-pipeline.check.mjs
 *
 * ⚠️ La segunda forma lee PRODUCCIÓN: pedir autorización antes.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Misma regla que src/lib/constants/postSale.ts — si cambia una, cambia la otra. */
function columna(c) {
    if (c.cashEntryId) return 'CLOSED';
    const status = c.status || 'SENT';
    if (status === 'DELIVERED') return (c.cost ?? 0) > 0 ? 'DELIVERED' : 'CLOSED';
    if (status === 'READY' || status === 'FINISHED') return 'READY';
    if (status === 'IN_PROGRESS') return 'IN_PROGRESS';
    return 'SENT';
}

const NOMBRE = {
    SENT: 'Reportado',
    IN_PROGRESS: 'En laboratorio',
    READY: 'Listo para retirar',
    DELIVERED: 'Entregado · a cobrar',
    CLOSED: 'Cerrado',
};

const plata = (n) => `$${Math.round(n || 0).toLocaleString('es-AR')}`;

async function main() {
    const casos = await prisma.postSaleCase.findMany({
        select: {
            id: true, status: true, cost: true, costSource: true, cashEntryId: true,
            newOrderNumber: true, caseType: true, coverage: true, responsible: true,
            createdAt: true,
            client: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
    });

    console.log(`\n${casos.length} casos de post venta.\n`);

    // ── Cómo queda repartido el tablero ──────────────────────────────────────
    const porColumna = {};
    for (const c of casos) {
        const col = columna(c);
        (porColumna[col] ||= []).push(c);
    }
    console.log('REPARTO CON EL PIPELINE NUEVO');
    for (const key of ['SENT', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CLOSED']) {
        console.log(`  ${String((porColumna[key] || []).length).padStart(4)}  ${NOMBRE[key]}`);
    }

    // ── De dónde vienen (estado guardado hoy) ────────────────────────────────
    const porEstado = {};
    for (const c of casos) porEstado[c.status || '(vacío)'] = (porEstado[c.status || '(vacío)'] || 0) + 1;
    console.log('\nESTADO GUARDADO HOY');
    for (const [k, v] of Object.entries(porEstado).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${String(v).padStart(4)}  ${k}`);
    }

    // ── Los que hay que mover, y los que hay que mirar a ojo ─────────────────
    const aMover = [];        // los arregla la normalización
    const aRevisar = [];      // estos los tiene que decidir una persona

    for (const c of casos) {
        const etiqueta = `${(c.client?.name || 'sin cliente').padEnd(24).slice(0, 24)} ${c.caseType || 'sin tipificar'}`;
        const tieneOp = Boolean((c.newOrderNumber || '').trim());

        // 1. Tiene nº de operación pero sigue en Reportado: lo mueve la normalización.
        if (tieneOp && (c.status === 'SENT' || c.status === 'PENDING' || !c.status)) {
            aMover.push(`${etiqueta} · OP ${c.newOrderNumber} · ${c.status || '(vacío)'} → IN_PROGRESS`);
            continue;
        }

        // 2. Ya se descontó de caja pero el caso nunca se marcó entregado. Cae en
        //    "Cerrado" igual (la plata mandó), pero conviene saber que pasó.
        if (c.cashEntryId && c.status !== 'DELIVERED') {
            aRevisar.push(`COBRADO SIN ENTREGAR   ${etiqueta} · ${plata(c.cost)} · estado ${c.status || '(vacío)'}`);
            continue;
        }

        // 3. Entregado y con plata, pero el laboratorio todavía no cerró el costo:
        //    el monto es la estimación del vendedor, no se puede cobrar aún.
        if (c.status === 'DELIVERED' && (c.cost ?? 0) > 0 && c.costSource !== 'LAB' && !c.cashEntryId) {
            aRevisar.push(`A COBRAR ESTIMADO      ${etiqueta} · ${plata(c.cost)} estimado · falta factura del lab`);
            continue;
        }

        // 4. El lab ya cerró el costo y nadie lo cobró, y el caso ni siquiera está
        //    entregado: plata quieta en una columna del medio.
        if (c.costSource === 'LAB' && !c.cashEntryId && c.status !== 'DELIVERED') {
            aRevisar.push(`PLATA SIN COBRAR       ${etiqueta} · ${plata(c.cost)} cerrado por el lab · estado ${c.status || '(vacío)'}`);
            continue;
        }

        // 5. Sin nº de operación pero marcado como si el lab lo tuviera.
        if (!tieneOp && ['IN_PROGRESS', 'FINISHED', 'READY'].includes(c.status)) {
            aRevisar.push(`SIN OP PERO AVANZADO   ${etiqueta} · estado ${c.status}`);
            continue;
        }
    }

    console.log(`\nSE MUEVEN SOLOS CON LA NORMALIZACIÓN (${aMover.length})`);
    aMover.slice(0, 40).forEach(l => console.log(`  ${l}`));
    if (aMover.length > 40) console.log(`  … y ${aMover.length - 40} más`);

    console.log(`\nPARA DECIDIR A MANO (${aRevisar.length})`);
    aRevisar.slice(0, 40).forEach(l => console.log(`  ${l}`));
    if (aRevisar.length > 40) console.log(`  … y ${aRevisar.length - 40} más`);

    console.log('');
}

main()
    .catch(e => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());

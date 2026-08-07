#!/usr/bin/env node
/**
 * ⚠️ ESTE SCRIPT ESCRIBE EN LA BASE.
 *
 * Ordena los casos de post venta viejos según el pipeline nuevo. Hace UNA sola
 * cosa, la única que no se arregla sola:
 *
 *   Un caso que YA tiene nº de operación pero sigue en "Reportado" pasa a
 *   "En laboratorio".
 *
 * Por qué solo eso: las otras dos correcciones del pipeline nuevo son derivadas
 * y no necesitan tocar datos. "Finalizado (Lab)" y "Listo p/ Retirar" se
 * fusionaron en la vista (el estado 'FINISHED' guardado se muestra ya como
 * "Listo para retirar"), y "Cerrado" se deduce de `cashEntryId`. Migrar esos dos
 * sería reescribir filas para decir lo que los datos ya dicen.
 *
 * De acá en adelante la transición la hace sola el servicio al guardar el número
 * (ver order.service.ts, "Cargar el nº de operación mueve el caso solo"); este
 * script es solo para los casos que quedaron de antes.
 *
 * Uso:
 *   node scripts/maintenance/postventa-normalizar-estados.mjs            (dry-run, base local)
 *   node scripts/maintenance/postventa-normalizar-estados.mjs --aplicar  (escribe)
 *   DATABASE_URL="$PROD_DATABASE_URL" node ... --aplicar                 (escribe en PRODUCCIÓN)
 *
 * Sin --aplicar no escribe nada: lista qué haría y sale.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');

async function main() {
    const url = process.env.DATABASE_URL || '';
    const esLocal = url.includes('localhost') || url.includes('127.0.0.1');
    console.log(`\nBase: ${esLocal ? 'LOCAL' : '⚠️  NO LOCAL (¿producción?)'}`);
    console.log(APLICAR ? 'Modo: APLICAR (escribe)\n' : 'Modo: dry-run (no escribe)\n');

    // Candidatos: con nº de operación cargado y todavía en el arranque del pipeline.
    // `status` es String con default 'SENT' (nunca null) y `newOrderNumber` es
    // String? — de ahí la forma de la consulta.
    const candidatos = await prisma.postSaleCase.findMany({
        where: {
            status: { in: ['SENT', 'PENDING'] },
            newOrderNumber: { not: null },
        },
        select: {
            id: true, status: true, newOrderNumber: true,
            client: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
    });

    // El `not: null` de arriba no filtra los que quedaron en cadena vacía.
    const conNumero = candidatos.filter(c => (c.newOrderNumber || '').trim() !== '');
    candidatos.length = 0;
    candidatos.push(...conNumero);

    if (candidatos.length === 0) {
        console.log('No hay casos para mover. Nada que hacer.\n');
        return;
    }

    console.log(`${candidatos.length} casos con nº de operación todavía en "Reportado":\n`);
    for (const c of candidatos) {
        console.log(`  ${(c.client?.name || 'sin cliente').padEnd(26).slice(0, 26)} OP ${c.newOrderNumber}  ${c.status || '(vacío)'} → IN_PROGRESS`);
    }

    if (!APLICAR) {
        console.log('\nDry-run: no se escribió nada. Volvé a correrlo con --aplicar.\n');
        return;
    }

    // Se mueve uno por uno y cada movimiento queda en el historial del caso, con
    // el mismo formato que usa el tablero. Un cambio de estado sin rastro de
    // quién ni por qué es exactamente lo que después nadie puede explicar.
    let movidos = 0;
    for (const c of candidatos) {
        await prisma.$transaction([
            prisma.postSaleCase.update({ where: { id: c.id }, data: { status: 'IN_PROGRESS' } }),
            prisma.postSaleStatusHistory.create({
                data: {
                    caseId: c.id,
                    fromStatus: c.status || 'SENT',
                    toStatus: 'IN_PROGRESS',
                    changedBy: 'Sistema (normalización de pipeline)',
                },
            }),
        ]);
        movidos++;
    }
    console.log(`\n✓ ${movidos} casos movidos a "En laboratorio", con su transición registrada.\n`);
}

main()
    .catch(e => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());

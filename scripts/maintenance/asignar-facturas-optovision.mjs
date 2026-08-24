/**
 * Asigna a mano las facturas de Optovisión que llegaron SIN nº de pedido en el
 * papel, o que traen VARIOS pedidos en una sola factura (la línea "Ped:" del
 * PDF). Sin esto quedan como "S/PEDIDO 3008-000XXXXX" en estado UNMATCHED y la
 * venta figura para siempre sin factura.
 *
 * Los números salen de dos lugares, los dos verificados con la administradora:
 *   - la planilla física (facturas sin nº de operación);
 *   - el PDF de la factura 3008-00062896, que trae tres pedidos:
 *     "Ped: TI-7101568(587979) /TI-7101583(588049) /TI-7101638(588966)".
 *     El importe de cada uno NO es un prorrateo: sale de sumar los renglones
 *     del propio PDF (cada cristal identifica a su venta), y los tres suman
 *     exactamente el total de la factura.
 *
 * ESCRIBE EN LA BASE DE PRODUCCIÓN. Por defecto solo muestra qué haría:
 *   node scripts/maintenance/asignar-facturas-optovision.mjs
 *   node scripts/maintenance/asignar-facturas-optovision.mjs --aplicar
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const url = process.env.PROD_DATABASE_URL;
if (!url) {
    console.error('Falta PROD_DATABASE_URL en el .env');
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const APLICAR = process.argv.includes('--aplicar');
const LAB = 'OPTOVISION';
const FIRMA = 'Ishtar (asignación manual de facturas de Optovisión)';

/**
 * `importe` es el TOTAL con IVA, que es lo comparable para Optovisión (Atelier
 * es monotributo y no recupera el IVA). Los de la 62896 salen de los renglones
 * del PDF; el resto, del resumen de cuenta.
 */
const ASIGNACIONES = [
    { factura: '3008-00067549', pedido: '596770', importe: 17173.72, fuente: 'planilla física' },
    { factura: '3008-00052707', pedido: '565417', importe: null, fuente: 'planilla física' },
    { factura: '3008-00070740', pedido: '3578632', importe: 220850.72, fuente: 'planilla física' },
    { factura: '3008-00063271', pedido: '588062', importe: 438071.93, fuente: 'planilla física' },
    { factura: '3008-00072463', pedido: '598454', importe: 28.25, fuente: 'planilla física' },
    { factura: '3008-00062896', pedido: '587979', importe: 536396.50, fuente: 'PDF, Varilux Physio (1 de 3)' },
    { factura: '3008-00062896', pedido: '588049', importe: 438071.90, fuente: 'PDF, Varilux Comfort Max (2 de 3)' },
    { factura: '3008-00062896', pedido: '588966', importe: 82361.51, fuente: 'PDF, Sapphire HR stock (3 de 3)' },
];

const pesos = n => n == null ? '—' : `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

async function main() {
    console.log(APLICAR ? 'APLICANDO CAMBIOS EN PRODUCCIÓN\n' : 'ENSAYO — no se escribe nada. Para aplicar: --aplicar\n');

    const plan = [];
    for (const a of ASIGNACIONES) {
        const nro = a.factura.split('-')[1].replace(/^0+/, '');

        // La venta que tiene ese pedido. Puede venir en un rango ("588062 - 588065").
        const [venta] = await prisma.$queryRaw`
            select o.id, o."labOrderNumber", c.name as cliente
            from "Order" o left join "Client" c on c.id = o."clientId"
            where o."isDeleted" = false and o."labOrderNumber" like ${'%' + a.pedido + '%'}
            limit 1`;

        // La entrada que hoy representa esa factura (clave inventada S/PEDIDO…)
        // y la que ya podría existir con el nº de pedido real.
        const porFactura = await prisma.$queryRaw`
            select id, "labOrderNumber", "billedTotal", status, "orderId", "sourceFile"
            from "LabCostEntry"
            where lab = ${LAB} and ("sourceFile" like ${'%' + nro + '%'} or "labOrderNumber" like ${'%' + nro + '%'})`;
        const [porPedido] = await prisma.$queryRaw`
            select id, "labOrderNumber", "billedTotal", status, "orderId", "sourceFile"
            from "LabCostEntry" where lab = ${LAB} and "labOrderNumber" = ${a.pedido}`;

        plan.push({ ...a, nro, venta: venta || null, existentes: porFactura, porPedido: porPedido || null });
    }

    // ── Informe ───────────────────────────────────────────────────────────
    const listas = [], dudosas = [];
    for (const p of plan) {
        const problemas = [];
        if (!p.venta) problemas.push('ninguna venta tiene ese nº de pedido');
        if (p.porPedido && p.porPedido.sourceFile && !p.porPedido.sourceFile.includes(p.nro)) {
            problemas.push(`ya hay una entrada con ese pedido, de otra factura (${p.porPedido.sourceFile})`);
        }
        // El importe del resumen contra el que ya está cargado en el sistema.
        const cargada = p.existentes.find(e => e.billedTotal != null);
        if (p.importe != null && cargada?.billedTotal != null
            && Math.abs(cargada.billedTotal - p.importe) > 1) {
            problemas.push(`el importe cargado (${pesos(cargada.billedTotal)}) no coincide con el del papel (${pesos(p.importe)})`);
        }
        if (p.importe == null) problemas.push('no figura en este resumen: no tengo el importe');

        console.log(`${p.factura}  →  pedido ${p.pedido}   ${pesos(p.importe)}   [${p.fuente}]`);
        console.log(`   venta:     ${p.venta ? `${p.venta.cliente} (${p.venta.labOrderNumber})` : 'NINGUNA'}`);
        console.log(`   en base:   ${p.existentes.length ? p.existentes.map(e => `${e.labOrderNumber} · ${pesos(e.billedTotal)} · ${e.status}`).join(' | ') : 'no hay entrada'}`);
        if (problemas.length) {
            problemas.forEach(x => console.log(`   ⚠ ${x}`));
            dudosas.push(p);
        } else {
            console.log(`   ✓ lista para asignar`);
            listas.push(p);
        }
        console.log();
    }

    console.log(`RESUMEN: ${listas.length} listas para asignar · ${dudosas.length} con algo que revisar\n`);
    if (!APLICAR) return;

    for (const p of listas) {
        const entrada = p.existentes[0];
        if (entrada) {
            await prisma.$executeRaw`
                update "LabCostEntry"
                set "labOrderNumber" = ${p.pedido}, "orderId" = ${p.venta.id},
                    "billedTotal" = ${p.importe}, "sourceFile" = ${`FA_${p.factura}.pdf`},
                    notes = ${`Pedido asignado a mano el 24/8/2026 (${p.fuente}). ${FIRMA}.`},
                    status = 'PENDING', "updatedAt" = now()
                where id = ${entrada.id}`;
        } else {
            await prisma.$executeRaw`
                insert into "LabCostEntry" (id, lab, "labOrderNumber", "orderId", "billedTotal",
                    source, "sourceFile", status, notes, "createdAt", "updatedAt")
                values (gen_random_uuid()::text, ${LAB}, ${p.pedido}, ${p.venta.id}, ${p.importe},
                    'MANUAL', ${`FA_${p.factura}.pdf`}, 'PENDING',
                    ${`Pedido asignado a mano el 24/8/2026 (${p.fuente}). ${FIRMA}.`}, now(), now())`;
        }
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'ORDER', ${p.venta.id},
                ${JSON.stringify({ factura: p.factura, pedido: p.pedido, importe: p.importe, fuente: p.fuente })}::jsonb, now())`;
        console.log(`  asignada ${p.factura} → pedido ${p.pedido} (${p.venta.cliente})`);
    }
    console.log(`\nListo: ${listas.length} facturas asignadas.`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());

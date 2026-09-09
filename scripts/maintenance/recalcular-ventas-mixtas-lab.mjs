/**
 * Recalcula la diferencia de costo de las VENTAS MIXTAS (pedidos en más de un
 * laboratorio), que quedaron con el número viejo.
 *
 * EL BUG (arreglado en el código el 25/8/2026, commit d5dde2f4): al comparar el
 * pedido de un lab se sumaba TAMBIÉN lo facturado por el OTRO lab de la misma
 * venta —y con la regla de IVA del lab equivocado— contra un costo de sistema
 * que solo incluye los cristales del primero. Caso de Gonzalez Victoria
 * (" 609861 -80537220"), un par de XPERIO en Optovisión y otro Orgánico Super
 * Blue en Grupo Óptico:
 *     $18.988 + $229.457 (Optovisión sin IVA) − $28.600 = +$219.845
 * Un sobrecosto de $219.845 que nunca existió: lo real es $9.612 A FAVOR.
 *
 * El arreglo evita que vuelva a pasar, pero NO reescribe lo ya guardado: la
 * diferencia se recalcula solo cuando llega una factura nueva para ese pedido,
 * y para un pedido viejo eso no pasa nunca. Ishtar lo encontró el 8/9/2026
 * mirando el informe semanal: "revisé y no es ese el monto que cobró el
 * laboratorio". Este script arregla los que quedaron.
 *
 * CÓMO RECALCULA (con los valores ya guardados, sin re-cruzar nada):
 *   diferencia = (suma de lo facturado por ESE lab en esa venta) − (costo de
 *   sistema de ESE lab, que la entrada ya tiene bien calculado).
 * Optovisión compara con IVA (billedTotal) y Grupo Óptico sin IVA (billedNet),
 * misma regla que cost-matching.ts.
 *
 * ESCRIBE EN PRODUCCIÓN. Por defecto solo muestra qué haría:
 *   node scripts/maintenance/recalcular-ventas-mixtas-lab.mjs
 *   node scripts/maintenance/recalcular-ventas-mixtas-lab.mjs --aplicar
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
const TOLERANCIA = 100; // mismo umbral que types.ts
const ars = n => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;

/** Optovisión compara con IVA; el resto, el neto. Igual que cost-matching.ts. */
const facturadoDe = (e) => e.lab === 'OPTOVISION'
    ? (e.billedTotal ?? e.billedNet ?? null)
    : (e.billedNet ?? e.billedTotal ?? null);

const estadoDe = (dif) => dif > TOLERANCIA ? 'OVERCOST' : dif < -TOLERANCIA ? 'UNDERCOST' : 'OK';

async function main() {
    console.log(APLICAR ? 'APLICANDO CAMBIOS EN PRODUCCIÓN\n' : 'ENSAYO — no se escribe nada. Para aplicar: --aplicar\n');

    const conVenta = await prisma.labCostEntry.findMany({
        where: { orderId: { not: null } },
        select: {
            id: true, lab: true, labOrderNumber: true, orderId: true, notes: true,
            billedNet: true, billedTotal: true, systemCost: true, difference: true, status: true,
            order: { select: { client: { select: { name: true } }, labOrderNumber: true } },
        },
    });

    // Ventas con pedidos en MÁS DE UN laboratorio.
    const porVenta = new Map();
    for (const e of conVenta) {
        if (!porVenta.has(e.orderId)) porVenta.set(e.orderId, []);
        porVenta.get(e.orderId).push(e);
    }
    const mixtas = [...porVenta.values()].filter(g => new Set(g.map(e => e.lab)).size > 1);
    console.log(`Ventas con pedidos en más de un laboratorio: ${mixtas.length}\n`);

    const cambios = [];
    for (const grupo of mixtas) {
        // Un reproceso no participa del cruce de costo: se deja como está.
        const porLab = new Map();
        for (const e of grupo) {
            if ((e.notes || '').includes('POSTVENTA (caso')) continue;
            if (!porLab.has(e.lab)) porLab.set(e.lab, []);
            porLab.get(e.lab).push(e);
        }
        for (const [lab, entradas] of porLab) {
            const facturado = entradas.reduce((a, e) => a + (facturadoDe(e) ?? 0), 0);
            const sistema = entradas[0].systemCost;
            if (sistema == null || facturado === 0) continue;
            const correcta = facturado - sistema;
            const estado = estadoDe(correcta);
            for (const e of entradas) {
                const dif = e.difference ?? 0;
                if (Math.abs(dif - correcta) <= 1 && e.status === estado) continue;
                cambios.push({ e, lab, facturado, sistema, correcta, estado });
            }
        }
    }

    if (cambios.length === 0) { console.log('Nada para corregir.'); return; }

    for (const c of cambios) {
        console.log(`${c.e.labOrderNumber} · ${c.lab} · ${c.e.order?.client?.name || '—'}  (venta "${c.e.order?.labOrderNumber}")`);
        console.log(`   facturado por ${c.lab}: ${ars(c.facturado)}   costo sistema de ${c.lab}: ${ars(c.sistema)}`);
        console.log(`   diferencia guardada: ${ars(c.e.difference)} [${c.e.status}]  →  CORRECTA: ${ars(c.correcta)} [${c.estado}]`);
        console.log();
    }
    console.log(`RESUMEN: ${cambios.length} entrada(s) a corregir\n`);
    if (!APLICAR) { console.log('Ensayo terminado. Nada se escribió.'); return; }

    for (const c of cambios) {
        await prisma.$executeRaw`
            update "LabCostEntry"
            set difference = ${c.correcta}, status = ${c.estado}, "updatedAt" = now()
            where id = ${c.e.id}`;
        console.log(`  corregida ${c.e.labOrderNumber}: ${ars(c.e.difference)} → ${ars(c.correcta)} [${c.estado}]`);
    }
    console.log('\nListo.');
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());

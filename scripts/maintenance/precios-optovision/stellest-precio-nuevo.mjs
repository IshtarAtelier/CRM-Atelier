/**
 * Actualiza el STELLEST al precio nuevo de Essilor y lo pone en markup ×2,85.
 *
 * Essilor avisó por WhatsApp (Noelia Vivas, 31/8/2026): Stellest pasa a
 * **$220.000 + IVA por par**. Ishtar lo aprobó el 9/9/2026: "perfecto, está
 * 2.85, está bien".
 *
 * QUÉ ESTABA MAL: el Stellest era el ÚNICO de los 607 cristales sin `baseCost`.
 * Sin el pelado no entra en ninguna recalculación —ni cuando cambia el
 * calibrado, ni cuando cambia el IVA— así que se quedó con el costo del precio
 * viejo ($204.000 de pelado) y nadie se enteró. Cargarle el pelado es la mitad
 * del arreglo: de acá en adelante se actualiza solo.
 *
 * LOS NÚMEROS:
 *   pelado  $220.000                         (lista Essilor)
 *   costo   (220.000 + 23.000) × 1,21 = $294.030
 *   precio  294.030 × 2,85            = $837.986
 *
 * El costo subió 7,05%. A ×2,50 el precio habría sido $735.075 —el mismo 7,05%,
 * o sea pasarle al cliente el aumento del laboratorio y nada más—. Ishtar
 * eligió ×2,85, el markup de los Varilux de alta gama: son $102.911 de margen
 * nuevo por encima de eso, y es una decisión comercial, no una cuenta.
 *
 *   node scripts/maintenance/precios-optovision/stellest-precio-nuevo.mjs --produccion
 *   node scripts/maintenance/precios-optovision/stellest-precio-nuevo.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (Stellest: precio nuevo de Essilor y markup ×2,85)';

const PELADO = 220000;
const CALIBRADO_OV = 23000;
const IVA_OV = 1.21;
const MARKUP = 2.85;

const pesos = n => n == null ? '—' : `$${Math.round(Number(n)).toLocaleString('es-AR')}`;

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url ?? '')) {
        console.error('DATABASE_URL no apunta a localhost. Para tocar produccion hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`Base: ${PRODUCCION ? 'PRODUCCION' : 'LOCAL'} | modo: ${APLICAR ? 'APLICAR' : 'ENSAYO'}\n`);
        const ps = await prisma.$queryRaw`
            select id, name, "baseCost", cost, price from "Product"
            where category = 'Cristal' and name ilike '%stellest%'`;
        if (ps.length !== 1) {
            console.error(`Esperaba UN Stellest y encontré ${ps.length}. No toco nada.`);
            ps.forEach(p => console.error(`   ${p.name}`));
            process.exitCode = 1; return;
        }
        const p = ps[0];
        const costo = Math.round((PELADO + CALIBRADO_OV) * IVA_OV);
        const precio = Math.round(costo * MARKUP);

        console.log(`  ${p.name}`);
        console.log(`  pelado  ${pesos(p.baseCost)}  ->  ${pesos(PELADO)}`);
        console.log(`  costo   ${pesos(p.cost)}  ->  ${pesos(costo)}   (+${((costo / Number(p.cost) - 1) * 100).toFixed(2)}%)`);
        console.log(`  precio  ${pesos(p.price)}  ->  ${pesos(precio)}   (+${((precio / Number(p.price) - 1) * 100).toFixed(2)}%)`);
        console.log(`  markup  x${(Number(p.price) / Number(p.cost)).toFixed(2)}  ->  x${MARKUP}`);
        console.log(`\n  Efectivo (-20%): ${pesos(precio * 0.8)}   Transferencia (-15%): ${pesos(precio * 0.85)}`);

        if (!APLICAR) { console.log('\nEnsayo: no se escribio nada. Para aplicarlo: --aplicar'); return; }

        await prisma.$executeRaw`
            update "Product" set "baseCost" = ${PELADO}, cost = ${costo}, price = ${precio}, "updatedAt" = now()
            where id = ${p.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${p.id},
                ${JSON.stringify({ producto: p.name, motivo: 'precio nuevo de Essilor $220.000 + IVA (aviso del 31/8/2026)',
                    peladoDe: p.baseCost, peladoA: PELADO, costoDe: Number(p.cost), costoA: costo,
                    precioDe: Number(p.price), precioA: precio, markup: MARKUP })}::jsonb, now())`;
        console.log('\nLISTO.');
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

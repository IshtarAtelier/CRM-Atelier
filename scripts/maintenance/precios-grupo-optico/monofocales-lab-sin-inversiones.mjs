/**
 * Las 3 inversiones de precio contra costo que quedaban en los monofocales de
 * laboratorio de Grupo Óptico (auditoria-precio-vs-costo.mjs, 10/9/2026).
 * Regla de Ishtar: el que cuesta más no puede salir más barato. Y la otra: a
 * los más vendidos no se les baja el precio. Por eso se mueven SOLO los que no
 * tienen ventas, y lo justo para ordenar la escalera:
 *
 *  · CNC Fotocromático Gris 1.56 y 1.60 (0 ventas, ×3) salían más baratos que
 *    el CNC Polarizado ($264.000, 4 ventas), que cuesta menos. Suben apenas por
 *    encima de él, con el 1.56 (más caro al lab) arriba del 1.60.
 *  · MyoFix Super Blue 1.60 (0 ventas) salía $562 más caro que el MyoFix Blue
 *    Light Essential (22 ventas), que cuesta $1.167 más. Baja por debajo de él.
 *
 *   node scripts/maintenance/precios-grupo-optico/monofocales-lab-sin-inversiones.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();
const CAMBIOS = [
    ['Monofocal TALLADO (CNC) · Orgánico Fotocromático Gris 1.56', 264600],
    ['Monofocal TALLADO (CNC) · Orgánico Fotocromático Gris 1.60', 264300],
    ['Control miopía MyoFix · Orgánico Super Blue Light 1.60', 607500],
];
const f = n => `$${Math.round(Number(n)).toLocaleString('es-AR')}`;

async function main() {
    const aplicar = process.argv.includes('--produccion') && process.argv.includes('--aplicar');
    const prisma = new PrismaClient({ datasources: { db: { url: aplicar ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL } } });
    try {
        for (const [nombre, precio] of CAMBIOS) {
            const ps = await prisma.$queryRaw`
                select p.id, p.cost, p.price, (select count(*)::int from "OrderItem" oi where oi."productId" = p.id) v
                from "Product" p where p.name = ${nombre} and p.laboratory = 'GRUPO OPTICO'`;
            if (ps.length !== 1) { console.log(`  ${nombre}: hay ${ps.length}, no lo toco`); continue; }
            const p = ps[0];
            if (p.v > 0) { console.log(`  ${nombre}: tiene ${p.v} ventas, no lo toco`); continue; }
            console.log(`  ${nombre.padEnd(62)} ${f(p.price)} -> ${f(precio)} (x${(precio / p.cost).toFixed(2)})`);
            if (!aplicar) continue;
            await prisma.$executeRaw`update "Product" set price = ${precio}, "updatedAt" = now() where id = ${p.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${'Ishtar (monofocales de lab sin inversiones de precio)'}, 'UPDATE', 'PRODUCT', ${p.id},
                    ${JSON.stringify({ producto: nombre, precioDe: Number(p.price), precioA: precio })}::jsonb, now())`;
        }
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

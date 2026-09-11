/**
 * Orgánico Blanco 1.49 de stock: el punto medio entre el precio que tenía y el
 * de ×4. Ishtar, 10/9/2026: "no lo subas tanto, hacé una media entre ambos".
 * Es su tercer cristal más vendido (188 ventas): ×4 era un +60%.
 *   $26.523 (antes) y $42.436 (×4)  ->  $34.480 (×3,25)
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();
const PRECIO = Math.round((26523 + 42436) / 2);
const NOMBRE = 'Stock · Orgánico Blanco 1.49';

async function main() {
    if (!process.argv.includes('--produccion') || !process.argv.includes('--aplicar')) { console.log(`Ensayo: ${NOMBRE} -> $${PRECIO}`); return; }
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });
    try {
        const [p] = await prisma.$queryRaw`select id, cost, price from "Product" where name = ${NOMBRE} and laboratory = 'GRUPO OPTICO'`;
        await prisma.$executeRaw`update "Product" set price = ${PRECIO}, "updatedAt" = now() where id = ${p.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${'Ishtar (orgánico blanco de stock: media entre el precio viejo y ×4)'}, 'UPDATE', 'PRODUCT', ${p.id},
                ${JSON.stringify({ producto: NOMBRE, precioDe: Number(p.price), precioA: PRECIO })}::jsonb, now())`;
        console.log(`${NOMBRE}: $${p.price} -> $${PRECIO} (x${(PRECIO / p.cost).toFixed(2)}) · efectivo $${Math.round(PRECIO * 0.8)}`);
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

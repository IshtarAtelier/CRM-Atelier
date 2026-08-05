/**
 * Qué marcas hay en el catálogo y cuántos productos publicables tiene cada una.
 *
 *   node scripts/checks/ver-marcas-catalogo.mjs              → base local
 *   node scripts/checks/ver-marcas-catalogo.mjs --produccion → PROD_DATABASE_URL
 *
 * SOLO LEE. No escribe una sola fila: es de la familia de scripts/checks/.
 *
 * Existe porque el snapshot de src/data/snapshots/ estaba tres semanas viejo y
 * traía todas las marcas como "Atelier", así que no servía para saber qué
 * productos de una marca concreta se pueden mostrar. Antes de armar piezas de
 * producto hay que saber contra qué se está trabajando.
 *
 * Contra producción va con `select` explícito, como exige el schema de prod:
 * el schema local está adelantado y traer la fila entera revienta.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const contraProduccion = process.argv.includes('--produccion');
const url = contraProduccion ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;

if (!url) {
    console.error(`Falta ${contraProduccion ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`);
    process.exit(1);
}

console.log(`\nLeyendo el catálogo de ${contraProduccion ? 'PRODUCCIÓN' : 'la base local'} (solo lectura)\n`);

const prisma = new PrismaClient({ datasources: { db: { url } } });

try {
    const productos = await prisma.product.findMany({
        select: { id: true, brand: true, model: true, stock: true, price: true },
    });

    const porMarca = new Map();
    for (const p of productos) {
        const m = p.brand?.trim() || '(sin marca)';
        if (!porMarca.has(m)) porMarca.set(m, { total: 0, conStock: 0, conPrecio: 0 });
        const acc = porMarca.get(m);
        acc.total++;
        if ((p.stock ?? 0) > 0) acc.conStock++;
        if ((p.price ?? 0) > 0) acc.conPrecio++;
    }

    console.log(`${productos.length} productos en total\n`);
    console.log('  total  stock  precio   marca');
    console.log('  ─────  ─────  ──────   ─────');
    [...porMarca.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .forEach(([marca, d]) => {
            console.log(
                `  ${String(d.total).padStart(5)}  ${String(d.conStock).padStart(5)}  ${String(d.conPrecio).padStart(6)}   ${marca}`
            );
        });
} catch (e) {
    console.error(`\n❌ ${e.message.slice(0, 300)}`);
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}

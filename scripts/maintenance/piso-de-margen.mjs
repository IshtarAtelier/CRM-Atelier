/**
 * PISO DE MARGEN de los cristales: ningún precio por debajo de costo × piso.
 *
 * Regla de Ishtar (30/8/2026): todo cristal tiene que rendir MÁS de ×2,5.
 * Después de sincronizar los costos con la lista nueva del laboratorio, 64 de
 * 197 quedaron entre ×2,33 y ×2,49 — el aumento del costo les comió el margen
 * que el +7% de precios no llegó a cubrir.
 *
 * Qué hace: para cada cristal con costo y precio cargados, si
 * `price < cost × piso`, sube el precio JUSTO hasta el piso (redondeo hacia
 * arriba al peso). No toca los que ya están por encima, no toca costos, y firma
 * cada cambio en el AuditLog (PRICE_OVERRIDE) como la pantalla de aumentos.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/piso-de-margen.mjs                      # ensayo local
 *   node scripts/maintenance/piso-de-margen.mjs --aplicar            # escribe local
 *   node scripts/maintenance/piso-de-margen.mjs --produccion --aplicar
 *   (--piso 2.5 para cambiar el piso)
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const iPiso = process.argv.indexOf('--piso');
const PISO = iPiso !== -1 && process.argv[iPiso + 1] ? Number(process.argv[iPiso + 1]) : 2.5;
const FIRMA = 'Ishtar (piso de margen de cristales)';

const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error('Falta la URL de la base en el .env'); process.exit(1); }
if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no apunta a localhost. Para producción hace falta --produccion.');
    process.exit(1);
}
if (!(PISO > 1 && PISO < 10)) { console.error(`Piso fuera de rango: ${PISO}`); process.exit(1); }

const prisma = new PrismaClient({ datasources: { db: { url } } });
const pesos = n => `$${Math.round(n).toLocaleString('es-AR')}`;

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR' : 'ENSAYO (no escribe)'} · piso: ×${PISO}\n`);

    const cristales = await prisma.$queryRaw`
        select id, name, laboratory, price, cost from "Product"
        where category = 'Cristal' and cost > 0 and price > 0
        order by price / cost asc`;

    // EXCEPCIÓN (Ishtar, 30/8/2026): la línea Sygnus / New Editions se precia
    // "unos puntitos abajo del Kodak" para que sea atractiva como entrada, y
    // eso puede dejarla bajo el piso — es una decisión comercial, no un error.
    // Su precio lo fija scripts/maintenance/precios-optovision/precios-sygnus.mjs.
    const esSygnus = p => /new\s*editions?|sygnus/i.test(p.name || '');
    const bajos = cristales
        .filter(p => !esSygnus(p))
        .map(p => ({ ...p, mk: p.price / p.cost, nuevo: Math.ceil(p.cost * PISO) }))
        .filter(p => p.mk < PISO);

    console.log(`${cristales.length} cristales con costo y precio · ${bajos.length} debajo del piso\n`);
    let plata = 0;
    for (const p of bajos) {
        plata += p.nuevo - p.price;
        const esPromo = /mi\s*primer/i.test(p.name);
        console.log(`  ×${p.mk.toFixed(2)}  ${String(p.name).slice(0, 46).padEnd(48)}` +
            `${pesos(p.price).padStart(12)} → ${pesos(p.nuevo).padStart(12)}  (+${pesos(p.nuevo - p.price)})` +
            (esPromo ? '  ← promo Mi Primer: el costo base es media lista' : ''));
    }
    console.log(`\n  Suma de los ajustes: +${pesos(plata)} sobre la lista de precios.`);

    if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

    for (const p of bajos) {
        await prisma.$executeRaw`
            update "Product" set price = ${p.nuevo}, "updatedAt" = now() where id = ${p.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'PRICE_OVERRIDE', 'PRODUCT', ${p.id},
                ${JSON.stringify({ de: p.price, a: p.nuevo, piso: PISO, markupPrevio: Number(p.mk.toFixed(3)), laboratorio: p.laboratory, producto: p.name })}::jsonb, now())`;
    }
    console.log(`\n✅ ${bajos.length} precio(s) llevados al piso de ×${PISO}. Los costos no se tocaron.`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());

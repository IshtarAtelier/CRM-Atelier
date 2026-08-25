/**
 * Trae los PRECIOS Y COSTOS de los productos de producción a la base LOCAL.
 *
 * Para poder trabajar los markups en desarrollo con los números de verdad, sin
 * tocar producción. Lee producción (solo lectura) y escribe en la base local.
 *
 * Copia únicamente las columnas de plata y las que identifican al producto:
 *   price · cost · baseCost · wholesalePrice · salePrice
 * No toca stock, imágenes, textos de la tienda ni nada más: acá lo que importa
 * son los precios, y cuanto menos se pise, menos se rompe.
 *
 * Por defecto NO escribe, solo informa la diferencia.
 *   node scripts/maintenance/traer-precios-de-produccion.mjs
 *   node scripts/maintenance/traer-precios-de-produccion.mjs --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const prodUrl = process.env.PROD_DATABASE_URL;
const localUrl = process.env.DATABASE_URL;

if (!prodUrl || !localUrl) {
    console.error('Faltan PROD_DATABASE_URL y/o DATABASE_URL en el .env');
    process.exit(1);
}
// Candado: si DATABASE_URL no apunta a la base local, esto escribiría en
// producción. Preferible plantarse que averiguarlo después.
if (!/localhost|127\.0\.0\.1/.test(localUrl)) {
    console.error('❌ DATABASE_URL no apunta a localhost. Este script solo escribe en la base LOCAL.');
    console.error(`   DATABASE_URL = ${localUrl.replace(/:[^:@]*@/, ':***@')}`);
    process.exit(1);
}

const prod = new PrismaClient({ datasources: { db: { url: prodUrl } } });
const local = new PrismaClient({ datasources: { db: { url: localUrl } } });

const pesos = n => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;

async function main() {
    console.log(`Origen: PRODUCCIÓN (solo lectura) → Destino: base LOCAL`);
    console.log(`Modo: ${APLICAR ? 'APLICAR (escribe en local)' : 'ENSAYO (no escribe)'}\n`);

    // Producción va con select explícito: el schema local está adelantado y
    // pedir la fila entera revienta (trampa conocida del proyecto).
    const enProd = await prod.$queryRaw`
        select id, name, brand, category, laboratory, price, cost, "baseCost",
               "wholesalePrice", "salePrice"
        from "Product"`;
    const enLocal = await local.$queryRaw`
        select id, price, cost, "baseCost", "wholesalePrice", "salePrice"
        from "Product"`;

    const localPorId = new Map(enLocal.map(p => [p.id, p]));
    console.log(`Producción: ${enProd.length} productos · Local: ${enLocal.length}`);

    const distintos = [], faltan = [];
    const igual = (a, b) => (a ?? null) === (b ?? null);
    for (const p of enProd) {
        const l = localPorId.get(p.id);
        if (!l) { faltan.push(p); continue; }
        if (!igual(p.price, l.price) || !igual(p.cost, l.cost) || !igual(p.baseCost, l.baseCost)
            || !igual(p.wholesalePrice, l.wholesalePrice) || !igual(p.salePrice, l.salePrice)) {
            distintos.push({ prod: p, local: l });
        }
    }
    const sobran = enLocal.filter(l => !enProd.some(p => p.id === l.id));

    console.log(`  con precios distintos: ${distintos.length}`);
    console.log(`  que no están en local: ${faltan.length}  (se crean)`);
    console.log(`  que solo están en local: ${sobran.length}  (no se tocan)\n`);

    for (const d of distintos.slice(0, 15)) {
        console.log(`  ${String(d.prod.name || '').slice(0, 44).padEnd(46)}` +
            `lista ${pesos(d.local.price).padStart(12)} → ${pesos(d.prod.price).padStart(12)}` +
            `   costo ${pesos(d.local.cost).padStart(11)} → ${pesos(d.prod.cost).padStart(11)}`);
    }
    if (distintos.length > 15) console.log(`  … y ${distintos.length - 15} más`);

    if (!APLICAR) {
        console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar');
        return;
    }

    let tocados = 0;
    for (const d of distintos) {
        await local.$executeRaw`
            update "Product"
            set price = ${d.prod.price}, cost = ${d.prod.cost}, "baseCost" = ${d.prod.baseCost},
                "wholesalePrice" = ${d.prod.wholesalePrice}, "salePrice" = ${d.prod.salePrice}
            where id = ${d.prod.id}`;
        tocados++;
    }
    // Los que no existen en local se crean con lo mínimo indispensable para
    // poder trabajar precios: sin esto, media lista queda afuera del cuadro.
    let creados = 0;
    for (const p of faltan) {
        await local.$executeRaw`
            insert into "Product" (id, name, brand, category, laboratory, price, cost,
                                   "baseCost", "wholesalePrice", "salePrice", "createdAt", "updatedAt")
            values (${p.id}, ${p.name}, ${p.brand}, ${p.category}, ${p.laboratory}, ${p.price},
                    ${p.cost}, ${p.baseCost}, ${p.wholesalePrice}, ${p.salePrice}, now(), now())
            on conflict (id) do nothing`;
        creados++;
    }
    console.log(`\n✅ ${tocados} producto(s) actualizados y ${creados} creados en la base local.`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(async () => { await prod.$disconnect(); await local.$disconnect(); });

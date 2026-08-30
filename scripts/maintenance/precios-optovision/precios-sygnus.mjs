/**
 * PRECIOS DE LA LÍNEA SYGNUS / NEW EDITIONS: unos puntitos abajo del Kodak.
 *
 * Decisión de Ishtar (30/8/2026): Sygnus es la puerta de entrada y tiene que
 * ser ATRACTIVA — se precia un 5% debajo del Kodak Precise equivalente aunque
 * eso la deje bajo el piso general de ×2,5 (excepción comercial explícita,
 * también anotada en piso-de-margen.mjs). Donde no hay gemelo Kodak
 * (Alto Índice, Espejado, Polarizado, BLC), va ×2,57 como el resto.
 *
 * El COSTO no se toca acá: sale de la lista con la regla confirmada —
 * lente sin AR + UN Numax ($72.240) para acceder al 2x1 + calibrado, × IVA —
 * y lo escribe sincronizar-costos.mjs.
 *
 * Por defecto ensayo contra la base LOCAL.
 *   node scripts/maintenance/precios-optovision/precios-sygnus.mjs
 *   node scripts/maintenance/precios-optovision/precios-sygnus.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { emparejar } from './emparejador.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const DESCUENTO_VS_KODAK = 0.95;
const MARKUP_SIN_GEMELO = 2.57;
const FIRMA = 'Ishtar (precios Sygnus: 5% abajo del Kodak)';

const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error('Falta la URL de la base en el .env'); process.exit(1); }
if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no apunta a localhost. Para producción hace falta --produccion.');
    process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });
const pesos = n => `$${Math.round(n).toLocaleString('es-AR')}`;

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR' : 'ENSAYO (no escribe)'}\n`);
    const opto = await prisma.$queryRaw`
        select id, name, price, cost, "baseCost", is2x1 from "Product"
        where category = 'Cristal' and laboratory = 'OPTOVISION'`;
    const { ok } = emparejar(opto);
    const ne = ok.filter(x => x.familia === 'Sygnus NEW EDITION');
    const kodak = opto.filter(x => /KODAK PRECISE/i.test(x.name));
    const gemelo = nombre => {
        const n = nombre.toLowerCase();
        const b = re => kodak.find(k => re.test(k.name));
        if (/orma.*transitions/.test(n)) return b(/ORMA TRANSITIONS/i);
        if (/airwear.*xperio/.test(n)) return b(/AIRWEAR 1.59 XPERIO/i);
        if (/airwear.*blue/.test(n)) return b(/AIRWEAR 1.59 BLUE/i);
        if (/airwear/.test(n)) return b(/AIRWEAR 1.59 2x1/i);
        if (/stylis.*blue/.test(n)) return b(/STYLIS 1.67 BLUE/i);
        if (/stylis/.test(n)) return b(/STYLIS 1.67 2x1/i);
        if (/orma.*blue|blue.*orma/.test(n)) return b(/ORMA BLUE UV/i);
        return null;
    };

    const cambios = ne.map(x => {
        const k = gemelo(x.name);
        const nuevo = k ? Math.round(k.price * DESCUENTO_VS_KODAK) : Math.round(x.costoNuevo * MARKUP_SIN_GEMELO);
        return { ...x, kodak: k, nuevo };
    }).filter(x => Math.round(x.price) !== x.nuevo);

    console.log(`${ne.length} Sygnus/New Editions emparejados · ${cambios.length} cambian de precio\n`);
    for (const x of cambios) {
        console.log(`  ${String(x.name).slice(0, 46).padEnd(48)}${pesos(x.price).padStart(12)} → ${pesos(x.nuevo).padStart(12)}` +
            `  ×${(x.nuevo / x.costoNuevo).toFixed(2)}  ${x.kodak ? `(95% de ${pesos(x.kodak.price)})` : '(×2,57 sin gemelo)'}`);
    }
    if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

    for (const x of cambios) {
        await prisma.$executeRaw`
            update "Product" set price = ${x.nuevo}, "updatedAt" = now() where id = ${x.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'PRICE_OVERRIDE', 'PRODUCT', ${x.id},
                ${JSON.stringify({ de: x.price, a: x.nuevo, ancla: x.kodak?.name ?? 'markup 2,57', producto: x.name })}::jsonb, now())`;
    }
    console.log(`\n✅ ${cambios.length} precio(s) Sygnus fijados abajo del Kodak.`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());

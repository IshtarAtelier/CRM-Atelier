/**
 * Aumento de precio de lista de los cristales, por laboratorio.
 * ESCRIBE en la base (solo con --aplicar).
 *
 * POR QUÉ 7%
 * Relevamiento de precios de la competencia (24/8/2026, Ishtar) contra Lens,
 * Óptica Valencia, Urban Glass, Tutanoski, Paesani, Peretti — comparando
 * SOLO contra los que también dan 2x1 (Lens y Valencia, la comparación
 * justa). Con un 7% el Comfort Max y el XR Design quedan justo debajo del
 * techo de mercado (Valencia) sin pasarlo. Solo se sube `price` (P.
 * Minorista): `wholesalePrice`, `cost` y `baseCost` NO se tocan — es un
 * aumento de margen, no un ajuste de costo.
 *
 * CUIDADO CON EL NOMBRE DEL LABORATORIO. En `Product.laboratory` los valores
 * son 'OPTOVISION' y 'GRUPO OPTICO' (CON ESPACIO). El guión bajo
 * ('GRUPO_OPTICO') es otra cosa: es `LabCostEntry.lab`, el de la conciliación
 * de facturas. Filtrar por el equivocado no da error — no matchea nada y el
 * script informa "0 productos" como si estuviera todo bien. Por eso los labs
 * se validan contra los que existen en la base antes de tocar nada.
 *
 * Uso (por defecto NO escribe: muestra qué haría):
 *   node scripts/maintenance/aumento-precios-cristales.mjs
 *   node scripts/maintenance/aumento-precios-cristales.mjs --aplicar
 *   node scripts/maintenance/aumento-precios-cristales.mjs --lab "GRUPO OPTICO" --pct 7
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const iPct = process.argv.indexOf('--pct');
const PORCENTAJE = (iPct !== -1 && process.argv[iPct + 1] ? Number(process.argv[iPct + 1]) : 7) / 100;
const iLab = process.argv.indexOf('--lab');
const LABS_PEDIDOS = iLab !== -1 && process.argv[iLab + 1]
    ? [process.argv[iLab + 1]]
    : ['OPTOVISION', 'GRUPO OPTICO'];
const FIRMA = 'Ishtar (aumento de precio de lista de cristales)';

const url = process.env.PROD_DATABASE_URL;
if (!url) {
    console.error('Falta PROD_DATABASE_URL en el .env');
    process.exit(1);
}
if (!Number.isFinite(PORCENTAJE) || PORCENTAJE <= 0 || PORCENTAJE > 0.5) {
    console.error(`Porcentaje fuera de rango: ${PORCENTAJE * 100}%. Se espera entre 0 y 50.`);
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
    console.log(`Base: ⚠️  PRODUCCIÓN · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}` +
        ` · aumento: ${(PORCENTAJE * 100).toFixed(0)}%\n`);

    // Los laboratorios que EXISTEN, para no filtrar por un nombre que no está
    // y creer que se aplicó (el error que dejó el aumento del 24/8 sin efecto).
    const existentes = await prisma.$queryRaw`
        select laboratory as lab, count(*)::int as n
        from "Product" where category = 'Cristal' and laboratory is not null
        group by 1 order by 2 desc`;
    console.log('Laboratorios con cristales en la base:');
    for (const l of existentes) console.log(`   "${l.lab}" — ${l.n} cristales`);

    const nombres = new Set(existentes.map(l => l.lab));
    const faltantes = LABS_PEDIDOS.filter(l => !nombres.has(l));
    if (faltantes.length) {
        console.error(`\n❌ Estos laboratorios NO existen en la base: ${faltantes.map(l => `"${l}"`).join(', ')}`);
        console.error('   No se toca nada. Revisar el nombre exacto en la lista de arriba.');
        process.exitCode = 1;
        return;
    }

    let totalCambios = 0;
    for (const lab of LABS_PEDIDOS) {
        const productos = await prisma.$queryRaw`
            select id, name, brand, price from "Product"
            where category = 'Cristal' and laboratory = ${lab}
            order by brand asc, price asc`;
        const cambios = productos
            .filter(p => p.price > 0)
            .map(p => ({ ...p, nuevo: Math.round(p.price * (1 + PORCENTAJE)) }));

        console.log(`\n${lab} — ${cambios.length} cristales con precio (de ${productos.length})`);
        for (const c of cambios) {
            console.log(`   $${c.price.toLocaleString('es-AR').padStart(11)} → $${c.nuevo.toLocaleString('es-AR').padStart(11)}   ` +
                `${String(c.brand || '')} ${String(c.name || '').slice(0, 44)}`);
        }
        const sinPrecio = productos.length - cambios.length;
        if (sinPrecio) console.log(`   (${sinPrecio} sin precio de lista: no se tocan)`);
        totalCambios += cambios.length;

        if (!APLICAR) continue;
        for (const c of cambios) {
            await prisma.$executeRaw`
                update "Product" set price = ${c.nuevo}, "updatedAt" = now() where id = ${c.id}`;
            // Rastro: sin esto no hay forma de saber después si el aumento se
            // aplicó, que fue exactamente el problema del 24/8.
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'PRICE_OVERRIDE', 'PRODUCT', ${c.id},
                    ${JSON.stringify({ lab, de: c.price, a: c.nuevo, pct: PORCENTAJE * 100 })}::jsonb, now())`;
        }
        console.log(`   ✅ ${cambios.length} precios actualizados en ${lab}.`);
    }

    console.log(`\nTOTAL: ${totalCambios} cristales ${APLICAR ? 'actualizados' : 'a actualizar'}.`);
    if (!APLICAR) {
        console.log('Ensayo: no se escribió nada. Para aplicarlo: --aplicar');
    } else {
        console.log('Las cuotas y el precio de contado se recalculan solos: salen del precio de lista.');
    }
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());

/**
 * Lleva a ×4 las familias de MULTIFOCALES de Grupo Óptico.
 *
 * Regla de Ishtar (8/9/2026): "todas las familias de multifocales de Grupo los
 * quiero ×4. Si Smart FREE tiene otro markup MAYOR, dejalo sin modificación."
 * O sea: ×4 es un PISO, no un valor exacto — el que ya está más arriba se queda
 * donde está. Es la misma lógica que usamos en Optovisión: nivelar lo que quedó
 * corto sin resignar el margen que ya se estaba cobrando.
 *
 * Alcance: las seis líneas Smart Lens (ONE, NEW, FREE, PRO, EXCLUSIVE, AI LENS).
 * No toca stock, monofocales, bifocales, ocupacionales ni control de miopía:
 * esas familias tienen su propio criterio y se decidieron aparte.
 *
 * QUÉ TOCA: `price`. Nunca el costo.
 *
 *   node scripts/maintenance/precios-grupo-optico/markup-multifocales-go.mjs
 *   node scripts/maintenance/precios-grupo-optico/markup-multifocales-go.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { pathToFileURL } from 'node:url';
import { emparejar } from './emparejador-go.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const PISO = 4;
const FIRMA = 'Ishtar (multifocales de Grupo Óptico a ×4)';

/** Las seis líneas Smart Lens. El resto de las familias no se toca. */
const MULTIFOCALES = [
    'Multifocal Smart Lens ONE',
    'Multifocal Smart Lens NEW',
    'Multifocal Smart Lens FREE',
    'Multifocal Smart Lens PRO',
    'Multifocal Smart Lens EXCLUSIVE',
    'Multifocal Smart Lens AI LENS',
];

const $ = n => '$' + Math.round(n).toLocaleString('es-AR');

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!url) { console.error('Falta la URL de la base en el .env'); process.exitCode = 1; return; }
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
        console.error('❌ DATABASE_URL no apunta a localhost. Para producción hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO'}`);
        console.log(`Piso de markup: ×${PISO} · el que ya está más arriba NO se toca\n`);

        // `origin` es obligatorio: sin él el emparejador manda al lugar equivocado
        // los lentes de stock, y de paso cambia qué cae en cada familia.
        const ps = await prisma.$queryRaw`
            select id, name, "lensIndex", origin, price, cost
            from "Product" where category = 'Cristal' and laboratory = 'GRUPO OPTICO'`;
        const { ok } = emparejar(ps);
        const alcanzados = ok.filter(x => MULTIFOCALES.includes(x.seccion) && x.cost > 0);
        const suben = alcanzados.filter(x => x.price / x.cost < PISO - 0.005);

        console.log(`${alcanzados.length} multifocales en sistema · ${suben.length} por debajo de ×${PISO}\n`);
        if (suben.length) {
            console.log(`  ${'Producto'.slice(0, 52).padEnd(54)}${'mk hoy'.padStart(8)}${'HOY'.padStart(13)}${'NUEVO'.padStart(13)}${'sube'.padStart(12)}`);
            for (const x of suben.sort((a, b) => (a.price / a.cost) - (b.price / b.cost))) {
                const nuevo = Math.ceil(x.cost * PISO);
                console.log(`  ${String(x.name).trim().slice(0, 52).padEnd(54)}${('×' + (x.price / x.cost).toFixed(2)).padStart(8)}${$(x.price).padStart(13)}${$(nuevo).padStart(13)}${('+' + $(nuevo - x.price)).padStart(12)}`);
            }
            const total = suben.reduce((a, x) => a + (Math.ceil(x.cost * PISO) - x.price), 0);
            console.log(`\n  suman +${$(total)}`);
        }
        const quedan = alcanzados.length - suben.length;
        console.log(`\n  ${quedan} quedan como están (su markup ya supera ×${PISO}).`);

        if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

        for (const x of suben) {
            const nuevo = Math.ceil(x.cost * PISO);
            await prisma.$executeRaw`
                update "Product" set price = ${nuevo}, "updatedAt" = now() where id = ${x.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${x.id},
                    ${JSON.stringify({ producto: String(x.name).trim(), familia: x.seccion, precioDe: Math.round(x.price),
                        precioA: nuevo, markupDe: +(x.price / x.cost).toFixed(2), markupA: PISO, costo: Math.round(x.cost) })}::jsonb, now())`;
        }
        console.log(`\n✅ ${suben.length} precio(s) llevados al piso de ×${PISO}. Los costos no se tocaron.`);
    } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(err => { console.error(err); process.exitCode = 1; });
}

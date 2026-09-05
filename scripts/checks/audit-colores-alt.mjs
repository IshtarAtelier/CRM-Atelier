// ────────────────────────────────────────────────────────────────────────────
// Auditoría SOLO LECTURA: qué valores de COLOR se sacarían del alt de cada foto
// si se usara `parseFrameSpecs()` para armar un filtro de color en la tienda.
//
// NO escribe nada. Por defecto pega a la base LOCAL (DATABASE_URL). Para correr
// contra producción: AUDIT_DB_URL="$PROD_DATABASE_URL" node <este archivo>
//
// Por qué existe: antes de construir un filtro de color hay que saber si el
// dato de origen (texto libre escrito a mano) da valores consistentes o si cada
// producto trae una variación distinta ("negro", "Negro mate", "negro brillante"),
// que volvería el filtro inservible por tener 80 opciones en vez de 10.
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { parseFrameSpecs, pickDescriptiveAlt } from '../../src/lib/catalog/frame-specs.ts';

const url = process.env.AUDIT_DB_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url } } });

const main = async () => {
    const rows = await prisma.webProduct.findMany({
        where: { isActive: true, product: { publishToWeb: true, category: { not: 'Cristal' } } },
        select: { name: true, imageAlts: true },
        orderBy: { name: 'asc' },
    });

    const conteo = new Map();
    const sinColor = [];
    const ejemplos = [];

    for (const wp of rows) {
        const alt = pickDescriptiveAlt(wp.imageAlts);
        const { color } = parseFrameSpecs(alt);
        if (!color) { sinColor.push(wp.name); continue; }
        const key = color.toLowerCase().trim();
        conteo.set(key, (conteo.get(key) || 0) + 1);
        if (ejemplos.length < 5) ejemplos.push({ name: wp.name, alt, color });
    }

    console.log(`Base auditada: ${url.replace(/:[^:@]+@/, ':****@')}`);
    console.log(`Productos: ${rows.length} | con color parseado: ${rows.length - sinColor.length} | sin color: ${sinColor.length}\n`);

    const ordenado = [...conteo.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`VALORES DISTINTOS DE COLOR: ${ordenado.length}\n`);
    for (const [color, n] of ordenado) console.log(`  ${String(n).padStart(3)}  ${color}`);

    if (sinColor.length) {
        console.log(`\nSIN COLOR (${sinColor.length}):`);
        for (const n of sinColor.slice(0, 20)) console.log(`  · ${n}`);
    }

    console.log('\nEJEMPLOS (alt completo → color parseado):');
    for (const e of ejemplos) console.log(`  "${e.alt}"\n    → "${e.color}"\n`);

    await prisma.$disconnect();
};

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });

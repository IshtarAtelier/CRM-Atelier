/**
 * AUDITA que ningún cristal que CUESTA más salga MÁS BARATO que otro de su misma
 * familia. SOLO LEE.
 *
 * Ishtar, 10/9/2026: "no pueden haber cristales que valen más con markup menor
 * quedando en menos valor". Pasó con el Super Blue 1.60 Rango Extendido, que
 * salía más barato que el Super Blue común aunque al lab le cuesta más.
 *
 * FAMILIA = misma línea del mismo laboratorio: lo que va antes del primer " · "
 * o " - " del nombre ("Stock", "Multifocal Smart FREE", "VARILUX PHYSIO"…).
 * Comparar entre familias no tiene sentido: un Varilux y un Smart no son el
 * mismo producto aunque cuesten parecido.
 *
 *   node scripts/checks/auditoria-precio-vs-costo.mjs --produccion
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();
const PRODUCCION = process.argv.includes('--produccion');
const f = n => `$${Math.round(Number(n)).toLocaleString('es-AR')}`;

const familia = n => String(n).split(/ · | - /)[0].replace(/^MI PRIMER /, 'MI PRIMER ').trim();

async function main() {
    const prisma = new PrismaClient({ datasources: { db: { url: PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL } } });
    try {
        const ps = await prisma.$queryRaw`
            select id, name, laboratory, cost, price, is2x1,
                   (select count(*)::int from "OrderItem" oi where oi."productId" = p.id) ventas
            from "Product" p
            where category = 'Cristal' and cost > 0 and price > 0 and name not like '[ARCHIVADO]%'`;
        const grupos = {};
        for (const p of ps) (grupos[`${p.laboratory} | ${familia(p.name)}`] ??= []).push(p);

        let total = 0;
        for (const [g, v] of Object.entries(grupos).sort()) {
            const inv = [];
            for (const a of v) for (const b of v) {
                // a cuesta más que b, pero sale más barato
                if (Number(a.cost) > Number(b.cost) * 1.001 && Number(a.price) < Number(b.price)) inv.push([a, b]);
            }
            if (!inv.length) continue;
            total += inv.length;
            console.log(`\n### ${g} — ${inv.length} inversión(es)`);
            for (const [a, b] of inv.slice(0, 8)) {
                console.log(`   ${a.name.slice(0, 58)}`);
                console.log(`      cuesta ${f(a.cost)} (x${(a.price / a.cost).toFixed(2)}) y vale ${f(a.price)}  ${a.ventas ? `[${a.ventas} ventas]` : ''}${a.is2x1 ? ' [2x1]' : ''}`);
                console.log(`   < ${b.name.slice(0, 58)}`);
                console.log(`      cuesta ${f(b.cost)} (x${(b.price / b.cost).toFixed(2)}) y vale ${f(b.price)}  ${b.ventas ? `[${b.ventas} ventas]` : ''}${b.is2x1 ? ' [2x1]' : ''}`);
            }
            if (inv.length > 8) console.log(`   … y ${inv.length - 8} más`);
        }
        console.log(`\n${total === 0 ? '✅ Ninguna inversión' : `❌ ${total} inversiones de precio contra costo`} en ${ps.length} cristales`);
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

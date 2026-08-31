/**
 * DOS ARREGLOS DE DATOS del catálogo de cristales, de los dos laboratorios.
 *
 * 1) EL ÍNDICE, ESCRITO DE UNA SOLA FORMA. Hoy conviven "1.5" y "1.50" como si
 *    fueran cosas distintas: el filtro por índice del cotizador los muestra
 *    separados y quien busca 1.50 no ve los que dicen 1.5. Se normaliza a dos
 *    decimales (1.50, 1.67), salvo el mineral 1.523 que sí lleva tres.
 *
 * 2) TODOS LOS MULTIFOCALES SON DE LABORATORIO (Ishtar, 31/8/2026): "en
 *    confección, todos los multifocales en ambos laboratorios son de
 *    laboratorio". Un progresivo se talla a medida de la receta, no sale de un
 *    blank de stock — nunca puede ser STOCK. Vale para Optovisión y para Grupo
 *    Óptico por igual.
 *
 * Por qué importa la confección: el checkout la usa para decidir si pide las
 * medidas del armazón (A, B, Pte, ED) que necesita el laboratorio. Un
 * multifocal marcado STOCK se manda a fabricar sin esas medidas.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/normalizar-indices-y-confeccion.mjs
 *   node scripts/maintenance/normalizar-indices-y-confeccion.mjs --aplicar
 *   node scripts/maintenance/normalizar-indices-y-confeccion.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (índices normalizados y multifocales a laboratorio)';

const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(`Falta ${PRODUCCION ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`); process.exit(1); }
if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no apunta a localhost. Para tocar producción hace falta --produccion.');
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

/** "1.5" → "1.50" · "1,67" → "1.67" · "1.523" queda con sus tres decimales. */
function indiceCanonico(v) {
    const t = String(v ?? '').trim().replace(',', '.');
    if (!t) return null;
    const n = parseFloat(t);
    if (!Number.isFinite(n)) return null;
    // El mineral es 1.523: si el tercer decimal no es cero, se respeta.
    const tres = n.toFixed(3);
    return tres.endsWith('0') ? n.toFixed(2) : tres;
}

const esMultifocal = p => /multifocal|progresiv/i.test(`${p.type || ''} ${p.name || ''}`);

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}\n`);

    const ps = await prisma.$queryRaw`
        select id, name, type, laboratory, origin, "lensIndex" from "Product"
        where category = 'Cristal' order by laboratory, name`;

    const idx = [], conf = [];
    for (const p of ps) {
        const canon = indiceCanonico(p.lensIndex);
        if (canon && canon !== String(p.lensIndex)) idx.push({ ...p, canon });
        if (esMultifocal(p) && p.origin !== 'LABORATORIO') conf.push(p);
    }

    // ── Informe del índice ───────────────────────────────────────────────────
    const antes = {}, despues = {};
    ps.forEach(p => { const k = String(p.lensIndex ?? '—'); antes[k] = (antes[k] || 0) + 1; });
    ps.forEach(p => { const k = indiceCanonico(p.lensIndex) ?? '—'; despues[k] = (despues[k] || 0) + 1; });
    console.log('ÍNDICES — como están hoy y como quedan');
    const claves = [...new Set([...Object.keys(antes), ...Object.keys(despues)])]
        .sort((a, b) => (parseFloat(a) || 99) - (parseFloat(b) || 99));
    for (const k of claves) {
        const a = antes[k] || 0, d = despues[k] || 0;
        if (a === d) continue;
        console.log(`   ${k.padEnd(8)} ${String(a).padStart(4)} → ${String(d).padStart(4)}${a === 0 ? '   (se unifican acá)' : d === 0 ? '   (desaparece)' : ''}`);
    }
    console.log(`\n   ${idx.length} producto(s) con el índice a normalizar`);

    // ── Informe de la confección ─────────────────────────────────────────────
    console.log(`\nMULTIFOCALES QUE NO DICEN "LABORATORIO": ${conf.length}`);
    const porLab = {};
    conf.forEach(p => { const k = p.laboratory || '(sin lab)'; (porLab[k] ??= []).push(p); });
    for (const [lab, v] of Object.entries(porLab)) {
        console.log(`\n   ${lab} (${v.length}):`);
        v.slice(0, 10).forEach(p => console.log(`      ${p.origin ?? 'sin confección'} → LABORATORIO   ${String(p.name).slice(0, 52)}`));
        if (v.length > 10) console.log(`      …y ${v.length - 10} más`);
    }

    if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

    for (const p of idx) {
        await prisma.$executeRaw`update "Product" set "lensIndex" = ${p.canon}, "updatedAt" = now() where id = ${p.id}`;
    }
    for (const p of conf) {
        await prisma.$executeRaw`update "Product" set origin = 'LABORATORIO', "updatedAt" = now() where id = ${p.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${p.id},
                ${JSON.stringify({ producto: p.name, confeccion: { de: p.origin, a: 'LABORATORIO' }, motivo: 'todo multifocal se talla a medida' })}::jsonb, now())`;
    }
    console.log(`\n✅ ${idx.length} índice(s) normalizados · ${conf.length} multifocal(es) marcados como LABORATORIO.`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());

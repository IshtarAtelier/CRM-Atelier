/**
 * Corrige los rangos de los cristales de OPTOVISIÓN contra la lista.
 *
 * POR QUÉ HACÍA FALTA: los rangos de Optovisión nunca se habían transcripto
 * fuera de la sección Sygnus, así que no había contra qué contrastarlos. Cuando
 * se transcribieron (páginas 5 a 24, leídas como imagen) aparecieron cristales
 * con el rango de otro: el KODAK SOFTWEAR ORMA figuraba -12/+12 cuando la lista
 * dice -10/+6, y los Stylis -12/+8 y -11/+8 cuando dice -14/+8.
 *
 * 🔴 OJO, ACÁ NO VALE LA REGLA DE GRUPO ÓPTICO. En Grupo Óptico el rango es del
 * MATERIAL + ÍNDICE y no del diseño. En Essilor/Optovisión NO: el mismo Stylis
 * 1.67 va -14/+8 en Kodak Softwear y -11/+8 en Kodak Unique DRO y SV Digital.
 * Por eso cada fila se empareja por DISEÑO + MATERIAL, nunca por material solo.
 *
 * QUÉ NO TOCA:
 *  · El cilindro cuando la lista no lo publica (páginas 17 y 18 traen solo la
 *    columna "esférico"). Se deja como está: un dato faltante es mejor que uno
 *    inventado.
 *  · Cualquier producto que empareje con dos filas distintas o con ninguna. Se
 *    listan aparte para mirarlos a mano.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/rangos/aplicar-rangos-optovision.mjs --produccion
 *   node scripts/maintenance/rangos/aplicar-rangos-optovision.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (rangos de Optovisión contra la lista de agosto)';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FUENTES = ['rangos-paginas-5-16.json', 'rangos-paginas-17-24.json']
    .map(f => path.join(AQUI, '..', 'precios-optovision', f));

const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[®™]/g, '').replace(/[^a-z0-9. ]/g, ' ').replace(/\s+/g, ' ').trim();
/** Palabras que no distinguen nada y solo ensucian el emparejado. */
const RUIDO = new Set(['de', 'la', 'el', 'y', 'con', 'lentes', 'lente', 'par', 'deg', '2x1',
    // El antirreflejo y las promos no son parte del material: el mismo Orma se
    // vende con Crizal, con Numax o pelado, y su rango es el mismo.
    'ar', 'sin', 'antirreflejo', 'crizal', 'numax', 'multicot', 'prevencia', 'sapphire',
    'forte', 'trio', 'easy', 'clean', 'rock',
    // Restos del nombre que no describen nada.
    '2a', 'fila', 'pdf']);
const tokens = s => norm(s).split(' ').filter(t => t && !RUIDO.has(t));

function cargarFilas() {
    const filas = [];
    for (const f of FUENTES) {
        if (!existsSync(f)) { console.log(`  (falta ${path.basename(f)} — se ignora)`); continue; }
        const d = JSON.parse(readFileSync(f, 'utf8'));
        for (const [k, v] of Object.entries(d)) {
            if (k.startsWith('_')) continue;
            for (const fila of (v.filas ?? [])) filas.push({ ...fila, pagina: fila.pagina ?? k });
        }
    }
    return filas;
}

const r = (a, b) => `${a}/${b}`;

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url ?? '')) {
        console.error('DATABASE_URL no apunta a localhost. Para tocar produccion hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const filas = cargarFilas();
    console.log(`Base: ${PRODUCCION ? 'PRODUCCION' : 'LOCAL'} | modo: ${APLICAR ? 'APLICAR' : 'ENSAYO'}`);
    console.log(`${filas.length} renglones transcriptos de la lista\n`);

    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        const ps = await prisma.$queryRaw`
            select id, name, "lensIndex", "sphereMin", "sphereMax", "cylinderMin", "cylinderMax",
                   "additionMin", "additionMax"
            from "Product" where category = 'Cristal' and laboratory = 'OPTOVISION' order by name`;

        const cambios = [], ambiguos = [], sinFila = [];
        for (const p of ps) {
            // El nombre viene como "DISEÑO - MATERIAL + AR". Separarlo importa:
            // sin eso, un "KODAK PRECISE - AIRWEAR 1.59 TRANSITIONS GEN S" se
            // emparejaba con el renglón "Transitions Gen S / AIRWEAR 1.59" de la
            // página de MATERIALES y se llevaba el rango de otra línea.
            const corte = String(p.name).search(/\s[-·]\s/);
            const tDis = new Set(tokens(corte > 0 ? p.name.slice(0, corte) : p.name));
            const tMat = new Set(tokens(corte > 0 ? p.name.slice(corte + 3) : p.name));

            // El MATERIAL tiene que coincidir exacto, no por inclusión: si no,
            // un "STYLIS 1.67 TRANSITIONS GEN S" se lleva el rango del renglón
            // "STYLIS 1.67" a secas, que es otro cristal y otro rango.
            const mismoConjunto = (a, b) => a.length === b.size && a.every(t => b.has(t));
            const candidatas = filas.map(f => {
                const td = tokens(f.diseno), tm = tokens(f.material);
                if (!td.length || !tm.length) return null;
                if (!mismoConjunto(tm, tMat)) return null;
                const exacto = mismoConjunto(td, tDis);
                // "KODAK PRECISE" y "Kodak Precise Next" son la misma línea; pero
                // "VARILUX COMFORT" y "VARILUX COMFORT MAX" NO lo son. Por eso el
                // diseño más corto solo vale si NO existe una coincidencia exacta.
                const parcial = td.every(t => tDis.has(t)) || [...tDis].every(t => td.includes(t));
                if (!exacto && !parcial) return null;
                return { f, exacto };
            }).filter(Boolean);
            const exactas = candidatas.filter(c => c.exacto);
            const mejores = exactas.length ? exactas : candidatas;
            if (!mejores.length) { sinFila.push(p); continue; }
            const distintas = new Set(mejores.map(c => JSON.stringify([c.f.esf, c.f.cil, c.f.add])));
            if (distintas.size > 1) { ambiguos.push({ p, mejores }); continue; }

            const f = mejores[0].f;
            const esf = f.esf, cil = f.cil, add = f.add;
            const cambiaEsf = esf && (Number(p.sphereMin) !== esf[0] || Number(p.sphereMax) !== esf[1]);
            const cambiaCil = cil && (Number(p.cylinderMin) !== cil[0] || Number(p.cylinderMax) !== cil[1]);
            const cambiaAdd = add && (Number(p.additionMin) !== add[0] || Number(p.additionMax) !== add[1]);
            if (cambiaEsf || cambiaCil || cambiaAdd) cambios.push({ p, f, esf, cil, add, cambiaEsf, cambiaCil, cambiaAdd });
        }

        console.log(`${ps.length} cristales de Optovisión | ${cambios.length} a corregir | ${ambiguos.length} ambiguos | ${sinFila.length} sin renglón\n`);
        for (const c of cambios) {
            const partes = [];
            if (c.cambiaEsf) partes.push(`esf ${r(c.p.sphereMin, c.p.sphereMax)} -> ${r(...c.esf)}`);
            if (c.cambiaCil) partes.push(`cil ${r(c.p.cylinderMin, c.p.cylinderMax)} -> ${r(...c.cil)}`);
            if (c.cambiaAdd) partes.push(`add ${r(c.p.additionMin, c.p.additionMax)} -> ${r(...c.add)}`);
            console.log(`  ${String(c.p.name).slice(0, 58).padEnd(60)} ${partes.join('  ')}   [${c.f.diseno} / ${c.f.material}, pág. ${c.f.pagina}]`);
        }
        if (ambiguos.length) {
            console.log(`\n  AMBIGUOS (no se tocan, mirar a mano):`);
            ambiguos.forEach(a => console.log(`    ${String(a.p.name).slice(0, 58).padEnd(60)} matchea ${a.mejores.length} filas con rangos distintos`));
        }
        if (sinFila.length) {
            console.log(`\n  SIN RENGLÓN en la transcripción (no se tocan): ${sinFila.length}`);
            sinFila.slice(0, 20).forEach(p => console.log(`    ${p.name}`));
        }

        if (!APLICAR) { console.log('\nEnsayo: no se escribio nada. Para aplicarlo: --aplicar'); return; }

        for (const c of cambios) {
            await prisma.$executeRaw`
                update "Product" set
                    "sphereMin" = coalesce(${c.cambiaEsf ? c.esf[0] : null}, "sphereMin"),
                    "sphereMax" = coalesce(${c.cambiaEsf ? c.esf[1] : null}, "sphereMax"),
                    "cylinderMin" = coalesce(${c.cambiaCil ? c.cil[0] : null}, "cylinderMin"),
                    "cylinderMax" = coalesce(${c.cambiaCil ? c.cil[1] : null}, "cylinderMax"),
                    "additionMin" = coalesce(${c.cambiaAdd ? c.add[0] : null}, "additionMin"),
                    "additionMax" = coalesce(${c.cambiaAdd ? c.add[1] : null}, "additionMax"),
                    "updatedAt" = now()
                where id = ${c.p.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${c.p.id},
                    ${JSON.stringify({ producto: c.p.name, renglon: `${c.f.diseno} / ${c.f.material}`, pagina: c.f.pagina,
                        esfDe: r(c.p.sphereMin, c.p.sphereMax), esfA: c.cambiaEsf ? r(...c.esf) : null,
                        cilDe: r(c.p.cylinderMin, c.p.cylinderMax), cilA: c.cambiaCil ? r(...c.cil) : null,
                        addDe: r(c.p.additionMin, c.p.additionMax), addA: c.cambiaAdd ? r(...c.add) : null })}::jsonb, now())`;
        }
        console.log(`\nLISTO: ${cambios.length} rango(s) corregidos.`);
    } finally { await prisma.$disconnect(); }
}

main().catch(e => { console.error(e); process.exitCode = 1; });

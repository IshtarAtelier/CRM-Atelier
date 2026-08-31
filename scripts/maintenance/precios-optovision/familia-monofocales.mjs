/**
 * LA FAMILIA COMPLETA de monofocales de la pág. 20, con nombres que no dejan
 * lugar a duda: cada material tiene su versión SIN ANTIRREFLEJO y su versión
 * CON CRIZAL PREVENCIA, y el nombre lo grita.
 *
 * POR QUÉ (Ishtar, 31/8/2026): "editá bien los nombres así queda bien claro, y
 * poné con y sin Crizal que quede la familia completa". El nombre viejo decía
 * "(Sin Crizal)" entre paréntesis al final — se leía como una aclaración menor
 * y no como lo que define el producto y su precio. Con un cristal que sale la
 * mitad según lleve o no el tratamiento, eso tiene que estar al frente.
 *
 * QUÉ HACE:
 *   · RENOMBRA los que ya existen al formato claro.
 *   · CREA los que faltan para que ninguna fila de la lista quede a medias.
 *   · Precia lo nuevo al piso de ×2,5 (la regla de Ishtar para todo cristal).
 *
 * QUÉ NO HACE: no toca el precio de los que ya existen — de eso se ocupa
 * piso-de-margen.mjs, que es el único lugar donde se mueven precios.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/precios-optovision/familia-monofocales.mjs
 *   node scripts/maintenance/precios-optovision/familia-monofocales.mjs --aplicar
 *   node scripts/maintenance/precios-optovision/familia-monofocales.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { datos, costoDe } from './emparejador.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const PISO = 2.5;
const FIRMA = 'Ishtar (familia de monofocales: nombres claros y completa)';

const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(`Falta ${PRODUCCION ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`); process.exit(1); }
if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no apunta a localhost. Para tocar producción hace falta --produccion.');
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const pesos = n => `$${Math.round(n).toLocaleString('es-AR')}`;
const PREVENCIA = datos.monofocales.tratamientos_sueltos.find(t => /PREVENCIA/i.test(t.nombre)).precio;

/**
 * El catálogo, explícito. Cada entrada dice de qué renglón de la lista sale, y
 * con qué nombre EXACTO se busca el producto que ya existe (para renombrarlo en
 * vez de duplicarlo). Explícito a propósito: emparejar por regex acá crearía
 * duplicados en silencio, que es el peor final posible para este script.
 */
const FAMILIA = [
    // ── Blue UV Filter System ────────────────────────────────────────────────
    { grupo: 'BlueUV Filter System', material: 'ORMA', idx: '1.50', base: 'Blue UV ORMA 1.50 Filter System',
      viejoSin: 'Blue UV ORMA - 1.50 Filter System (Sin Crizal)', viejoCon: 'Blue UV ORMA - 1.50 Filter System Con Crizal Prevencia' },
    { grupo: 'BlueUV Filter System', material: 'AIRWEAR 1.59', idx: '1.59', base: 'Blue UV AIRWEAR 1.59 Filter System',
      viejoSin: 'Blue UV Airwear - 1.59 Filter System (Sin Crizal)', viejoCon: 'Blue UV Airwear - 1.59 Filter System Con Crizal Prevencia' },
    { grupo: 'BlueUV Filter System', material: 'STYLIS 1.67', idx: '1.67', base: 'Blue UV STYLIS 1.67 Filter System',
      viejoSin: 'Blue UV Stylis - 1.67 Filter System (Sin Crizal)', viejoCon: 'Blue UV Stylis - 1.67 Filter System Con Crizal Prevencia' },

    // ── Transitions Gen S (fotocromáticos) ───────────────────────────────────
    // El de STOCK es lente terminada: no lleva Crizal aparte, por eso soloSin.
    // Las dos filas de ORMA se distinguen SOLO por el "(stock)" del rango: la
    // otra es la tallada. `esStock` elige cuál, en vez de buscar una palabra
    // "tallado" que la lista nunca escribe.
    { grupo: 'Transitions Gen S', material: 'ORMA', esStock: true, idx: '1.50', soloSin: true,
      base: 'Transitions Gen S ORMA 1.50 Fotocromático (stock)', viejoSin: 'TRANSITIONS GEN S - ORMA (Stock) SIN AR (Fotocromático)' },
    { grupo: 'Transitions Gen S', material: 'ORMA', esStock: false, idx: '1.50',
      base: 'Transitions Gen S ORMA 1.50 Fotocromático (tallado)', viejoSin: 'TRANSITIONS GEN S - ORMA (Tallado) SIN AR (Fotocromático)' },
    { grupo: 'Transitions Gen S', material: 'ORMA (colores)', idx: '1.50',
      base: 'Transitions Gen S ORMA 1.50 Fotocromático 8 colores', viejoSin: 'TRANSITIONS GEN S - ORMA (Colores) SIN AR (Fotocromático)' },
    { grupo: 'Transitions Gen S', material: 'AIRWEAR 1.59', idx: '1.59',
      base: 'Transitions Gen S AIRWEAR 1.59 Fotocromático', viejoSin: 'TRANSITIONS GEN S - AIRWEAR 1.59 SIN AR (Fotocromático)' },
    { grupo: 'Transitions Gen S', material: 'STYLIS 1.67', idx: '1.67',
      base: 'Transitions Gen S STYLIS 1.67 Fotocromático', viejoSin: 'TRANSITIONS GEN S - STYLIS 1.67 SIN AR (Fotocromático)' },

    // ── Xperio (polarizados) ─────────────────────────────────────────────────
    { grupo: 'Xperio', material: 'ORMA', idx: '1.50', base: 'Xperio ORMA 1.50 Polarizado',
      viejoCon: 'Monofocal XPERIO con crizal PREVENCIA' },
];

const nombreSin = f => `${f.base} — SIN ANTIRREFLEJO`;
const nombreCon = f => `${f.base} — CON CRIZAL PREVENCIA`;

/** El renglón de la lista, con su precio pelado y su rango. */
function renglon(f) {
    const g = datos.monofocales.grupos.find(x => x.familia === f.grupo);
    if (!g) return null;
    let cands = g.filas.filter(x => x.material === f.material);
    if (f.esStock !== undefined) cands = cands.filter(x => /stock/i.test(x.rango || '') === f.esStock);
    else if (cands.length > 1) cands = cands.filter(x => !/stock/i.test(x.rango || ''));
    return cands[0] ?? null;
}

function parsearRango(t) {
    if (!t) return {};
    const m = String(t).match(/([+-]?\d+(?:\.\d+)?)\s*[aA]\s*([+-]?\d+(?:\.\d+)?)/);
    const c = String(t).match(/cil\w*\s*[+-]?(\d+(?:\.\d+)?)/i);
    if (!m) return {};
    return {
        sphereMin: Math.min(+m[1], +m[2]), sphereMax: Math.max(+m[1], +m[2]),
        cylinderMin: c ? -Math.abs(+c[1]) : null, cylinderMax: c ? Math.abs(+c[1]) : null,
    };
}

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}\n`);
    console.log(`Crizal Prevencia $${PREVENCIA.toLocaleString('es-AR')} · calibrado $23.000 · IVA 21% · piso ×${PISO}\n`);

    const renombrar = [], crear = [], problemas = [];

    for (const f of FAMILIA) {
        const r = renglon(f);
        if (!r) { problemas.push(`${f.base}: no encuentro su renglón en la lista`); continue; }
        const rango = parsearRango(r.rango);

        for (const variante of ['sin', 'con']) {
            if (variante === 'con' && f.soloSin) continue;
            const nombre = variante === 'sin' ? nombreSin(f) : nombreCon(f);
            const lista = variante === 'sin' ? r.precio : r.precio + PREVENCIA;
            const costo = costoDe(lista);
            const viejo = variante === 'sin' ? f.viejoSin : f.viejoCon;

            const yaCon = await prisma.$queryRaw`select id, name, price, cost from "Product" where name = ${nombre}`;
            if (yaCon.length) continue;   // ya está con el nombre nuevo

            const existente = viejo ? (await prisma.$queryRaw`select id, name, price, cost from "Product" where name = ${viejo}`)[0] : null;
            if (existente) {
                renombrar.push({ id: existente.id, de: existente.name, a: nombre, costo, lista, rango, precio: existente.price });
            } else {
                crear.push({ nombre, costo, lista, rango, precio: Math.ceil(costo * PISO), idx: f.idx, variante });
            }
        }
    }

    if (renombrar.length) {
        console.log(`── ${renombrar.length} A RENOMBRAR (el precio no se toca) ──`);
        for (const x of renombrar) console.log(`  "${x.de}"\n   → "${x.a}"   costo ${pesos(x.costo)} · precio ${pesos(x.precio)} · ×${(x.precio / x.costo).toFixed(2)}\n`);
    }
    if (crear.length) {
        console.log(`── ${crear.length} A CREAR (preciados al piso de ×${PISO}) ──`);
        for (const x of crear) console.log(`  "${x.nombre}"\n   pelado ${pesos(x.lista)} → costo ${pesos(x.costo)} → precio ${pesos(x.precio)}\n`);
    }
    for (const p of problemas) console.log(`  ⚠️  ${p}`);
    if (!renombrar.length && !crear.length) console.log('Nada para hacer — la familia ya está completa y con los nombres claros.');

    if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

    for (const x of renombrar) {
        await prisma.$executeRaw`
            update "Product" set name = ${x.a}, cost = ${x.costo}, "baseCost" = ${Math.round(x.lista)},
                "sphereMin" = coalesce("sphereMin", ${x.rango.sphereMin ?? null}),
                "sphereMax" = coalesce("sphereMax", ${x.rango.sphereMax ?? null}),
                "cylinderMin" = coalesce("cylinderMin", ${x.rango.cylinderMin ?? null}),
                "cylinderMax" = coalesce("cylinderMax", ${x.rango.cylinderMax ?? null}),
                "updatedAt" = now()
            where id = ${x.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${x.id},
                ${JSON.stringify({ renombrado: { de: x.de, a: x.a }, costo: x.costo, pelado: Math.round(x.lista) })}::jsonb, now())`;
    }
    for (const x of crear) {
        const [{ id }] = await prisma.$queryRaw`select gen_random_uuid()::text as id`;
        await prisma.$executeRaw`
            insert into "Product" (id, name, category, laboratory, origin, type, brand, model, "lensIndex", "unitType",
                price, cost, "baseCost", is2x1, "sphereMin", "sphereMax", "cylinderMin", "cylinderMax", "createdAt", "updatedAt")
            values (${id}, ${x.nombre}, 'Cristal', 'OPTOVISION', 'LABORATORIO', 'Cristal Monofocal', 'Essilor',
                ${x.nombre.split(' — ')[0]}, ${x.idx}, 'PAR',
                ${x.precio}, ${x.costo}, ${Math.round(x.lista)}, false,
                ${x.rango.sphereMin ?? null}, ${x.rango.sphereMax ?? null},
                ${x.rango.cylinderMin ?? null}, ${x.rango.cylinderMax ?? null}, now(), now())`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${id},
                ${JSON.stringify({ creado: x.nombre, pelado: Math.round(x.lista), costo: x.costo, precio: x.precio })}::jsonb, now())`;
    }
    console.log(`\n✅ ${renombrar.length} renombrado(s) · ${crear.length} creado(s).`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());

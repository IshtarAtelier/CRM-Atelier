/**
 * ESCRIBE LOS RANGOS de graduación (esfera, cilindro, adición) que ya están
 * transcritos en la lista pero nunca se pasaron a los productos.
 *
 * De dónde salen: la columna "RANGO DE FABRICACIÓN" de la pág. 20 y la columna
 * "ESFÉRICO" de las páginas de diseños, más las fichas técnicas (el cilindro de
 * Eyezen y Myopilux, la adición de Myopilux). Todo eso ya vive en el JSON de la
 * lista: este script solo lo traduce a los cuatro campos de la base.
 *
 * POR QUÉ IMPORTA y no es prolijidad: sin rango, el vendedor no sabe si la
 * receta del cliente entra en ese cristal. Lo manda a fábrica, el laboratorio lo
 * rechaza, y la demora y el remake los come la óptica.
 *
 * NO INVENTA NADA. Si la lista no da el rango de un producto, ese producto
 * queda como está y se lista al final para preguntarle al laboratorio.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/precios-optovision/completar-rangos.mjs
 *   node scripts/maintenance/precios-optovision/completar-rangos.mjs --aplicar
 *   node scripts/maintenance/precios-optovision/completar-rangos.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { emparejar } from './emparejador.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (rangos de graduación desde la lista)';

const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(`Falta ${PRODUCCION ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`); process.exit(1); }
if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no apunta a localhost. Para tocar producción hace falta --produccion.');
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

/**
 * Traduce el rango escrito de la lista a números.
 * Formatos reales que aparecen:
 *   "+12.00 A -12.00 CIL 4.00"      → esf -12..+12, cil ±4
 *   "+4.00 A -4.00 CIL 2.00 (stock)" → idem, la aclaración se ignora
 *   "+6.00 A -10.00 CIL 6.00"        → esf -10..+6, cil ±6
 *   "+4.50 A -2.00"                  → esf -2..+4.5, sin cilindro
 *   "0 A -8.00 CIL 4.00"             → esf -8..0, cil ±4
 * Devuelve null si no lo entiende: prefiere no saber antes que inventar.
 */
export function parsearRango(texto) {
    if (!texto) return null;
    const t = String(texto).replace(',', '.');
    const m = t.match(/([+-]?\d+(?:\.\d+)?)\s*(?:a|A)\s*([+-]?\d+(?:\.\d+)?)/);
    if (!m) return null;
    const a = parseFloat(m[1]), b = parseFloat(m[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

    const cil = t.match(/cil\w*\s*[+-]?(\d+(?:\.\d+)?)/i);
    return {
        sphereMin: Math.min(a, b), sphereMax: Math.max(a, b),
        cylinderMin: cil ? -Math.abs(parseFloat(cil[1])) : null,
        cylinderMax: cil ? Math.abs(parseFloat(cil[1])) : null,
    };
}

/** La adición sale de la ficha técnica de cada familia, no del renglón. */
const ADICION = [
    [/myopilux/i, [1.5, 2.0]],
    [/interview/i, [0.8, 1.3]],          // degresión 0,80 y 1,30
    [/digitime|espace\s*plus/i, [0.75, 3.5]],
    [/comfort|physio|xr\s*design|xr\s*pro|liberty|precise|unique\s*dro|softwear/i, [0.75, 3.5]],
];
const vacio = v => v == null;

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}\n`);

    const productos = await prisma.$queryRaw`
        select id, name, type, price, cost, "baseCost", is2x1, "lensIndex",
            "sphereMin", "sphereMax", "cylinderMin", "cylinderMax", "additionMin", "additionMax"
        from "Product"
        where category = 'Cristal' and laboratory = 'OPTOVISION'
        order by name`;

    const { ok } = emparejar(productos);
    const porId = new Map(ok.map(o => [o.id, o]));

    const cambios = [], sinRango = [];
    for (const p of productos) {
        const emp = porId.get(p.id);
        const r = parsearRango(emp?.rango ?? emp?.esferico ?? null);
        const set = {};

        if (r) {
            if (vacio(p.sphereMin)) set.sphereMin = r.sphereMin;
            if (vacio(p.sphereMax)) set.sphereMax = r.sphereMax;
            if (vacio(p.cylinderMin) && r.cylinderMin != null) set.cylinderMin = r.cylinderMin;
            if (vacio(p.cylinderMax) && r.cylinderMax != null) set.cylinderMax = r.cylinderMax;
        }
        const add = ADICION.find(([re]) => re.test(p.name || ''))?.[1];
        const llevaAdicion = /multifocal|bifocal|progresiv|ocupacional/i.test(`${p.type || ''} ${p.name || ''}`);
        if (add && llevaAdicion) {
            if (vacio(p.additionMin)) set.additionMin = add[0];
            if (vacio(p.additionMax)) set.additionMax = add[1];
        }

        if (Object.keys(set).length) cambios.push({ ...p, set, de: emp?.rango ?? '(ficha técnica)' });
        else if (vacio(p.sphereMin) || vacio(p.cylinderMin)) sinRango.push(p);
    }

    console.log(`${productos.length} cristales · ${cambios.length} con rangos para completar\n`);
    for (const c of cambios) {
        const d = Object.entries(c.set).map(([k, v]) => `${k}=${v}`).join(' ');
        console.log(`  ${String(c.name).slice(0, 50).padEnd(52)}${d}`);
    }
    if (sinRango.length) {
        console.log(`\n  ⚠️  ${sinRango.length} que la lista no define — preguntar al laboratorio, NO inventar:`);
        for (const s of sinRango) console.log(`     ${s.name}`);
    }

    if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

    for (const c of cambios) {
        const s = c.set;
        await prisma.$executeRaw`
            update "Product" set
                "sphereMin"   = coalesce(${s.sphereMin ?? null}, "sphereMin"),
                "sphereMax"   = coalesce(${s.sphereMax ?? null}, "sphereMax"),
                "cylinderMin" = coalesce(${s.cylinderMin ?? null}, "cylinderMin"),
                "cylinderMax" = coalesce(${s.cylinderMax ?? null}, "cylinderMax"),
                "additionMin" = coalesce(${s.additionMin ?? null}, "additionMin"),
                "additionMax" = coalesce(${s.additionMax ?? null}, "additionMax"),
                "updatedAt" = now()
            where id = ${c.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${c.id},
                ${JSON.stringify({ producto: c.name, rangos: c.set, segunLaLista: c.de })}::jsonb, now())`;
    }
    console.log(`\n✅ ${cambios.length} producto(s) con sus rangos. No se tocó ni un precio ni un costo.`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());

/**
 * Sube al sistema todo lo que falta de Grupo Óptico fuera de los multifocales:
 * stock, monofocales de laboratorio (CNC y digital), bifocales, ocupacionales y
 * control de miopía.
 *
 * EL MARKUP DE CADA FAMILIA (Ishtar, 8/9/2026: "con el markup sano que hablamos,
 * que tengan relación con su familia y tratando de que tenga una relación sana,
 * sin bajar ningún item que sea muy vendible"):
 *   · Las familias que YA tienen productos cargados heredan la mediana de sus
 *     hermanos. Así el alta nueva sale al mismo precio relativo que lo que ya
 *     se vende, y no aparece un producto desalineado en la misma góndola.
 *   · Las dos líneas sin ningún producto cargado llevan un número decidido:
 *     Monofocal de laboratorio DIGITAL ×3 (Ishtar) — es superior al CNC, que
 *     está en ×2,50; y Ultra Relax ×2,95, el markup de su pariente más cercano,
 *     el Ocupacional Office.
 *
 * Este script SOLO da de alta. No toca el precio de nada que ya exista, así que
 * no puede bajarle el precio a un producto que se venda bien.
 *
 * Idempotente: chequea por RENGLÓN de la lista vía el emparejador, nunca por el
 * texto del nombre.
 *
 *   node scripts/maintenance/precios-grupo-optico/subir-resto-go.mjs
 *   node scripts/maintenance/precios-grupo-optico/subir-resto-go.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { emparejar, datos as d } from './emparejador-go.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const CALIBRADO = 7272;
const FIRMA = 'Ishtar (resto del catálogo de Grupo Óptico)';

/** Markup fijo de las líneas que no tienen ningún hermano de referencia. */
const MARKUP_DECIDIDO = {
    'Monofocal de laboratorio DIGITAL': 3,
    'Ultra Relax (monofocal digital)': 2.95,
};

/** Cada sección: de dónde salen sus filas, qué columna es el precio y qué tipo es. */
const SECCIONES = [
    { sec: 'Lente de stock / rango extendido', filas: () => d.stock_y_rango_extendido.filas, campo: 'precio', tipo: 'Cristal Monofocal', origen: 'STOCK' },
    { sec: 'Monofocal de laboratorio (CNC)', filas: () => d.monofocal_laboratorio.filas, campo: 'cnc', tipo: 'Cristal Monofocal', origen: 'LABORATORIO' },
    { sec: 'Monofocal de laboratorio DIGITAL', filas: () => d.monofocal_laboratorio.filas, campo: 'ultra', tipo: 'Cristal Monofocal', origen: 'LABORATORIO' },
    { sec: 'Bifocal Flat Top / Kriptock', filas: () => d.bifocales.filas, campo: 'cnc', tipo: 'Cristal Bifocal', origen: 'LABORATORIO' },
    { sec: 'Bifocal digital invisible (Kriptock Invisible)', filas: () => d.ocupacional_y_digitales.kriptock_invisible.filas, campo: 'precio', tipo: 'Cristal Bifocal', origen: 'LABORATORIO', add: [0.75, 3.5] },
    { sec: 'Ocupacional Office', filas: () => d.ocupacional_y_digitales.office.filas, campo: 'precio', tipo: 'Cristal Ocupacional', origen: 'LABORATORIO', add: [0.75, 3.5] },
    { sec: 'Ultra Relax (monofocal digital)', filas: () => d.ocupacional_y_digitales.ultra_relax.filas, campo: 'precio', tipo: 'Cristal Ocupacional', origen: 'LABORATORIO' },
    { sec: 'Control de miopía Smart MyoFix', filas: () => d.control_miopia.filas, campo: 'myofix', tipo: 'Cristal Control Miopico', origen: 'LABORATORIO', add: [0.75, 3.5] },
    { sec: 'Control de miopía Smart MyoLens', filas: () => d.control_miopia.filas, campo: 'myolens', tipo: 'Cristal Control Miopico', origen: 'LABORATORIO', add: [0.75, 3.5] },
];

/** Nombre corto de la sección, para el nombre del producto. */
const CORTO = {
    'Lente de stock / rango extendido': 'Stock',
    'Monofocal de laboratorio (CNC)': 'Monofocal laboratorio',
    'Monofocal de laboratorio DIGITAL': 'Monofocal digital',
    'Bifocal Flat Top / Kriptock': 'Bifocal Flat Top',
    'Bifocal digital invisible (Kriptock Invisible)': 'Kriptock Invisible',
    'Ocupacional Office': 'Ocupacional Office',
    'Ultra Relax (monofocal digital)': 'Ultra Relax',
    'Control de miopía Smart MyoFix': 'MyoFix',
    'Control de miopía Smart MyoLens': 'MyoLens',
};

const $ = n => '$' + Math.round(n).toLocaleString('es-AR');
const mediana = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

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
        console.log(`Solo ALTAS. Ningún precio existente se toca.\n`);

        const ps = await prisma.$queryRaw`
            select id, name, "lensIndex", origin, price, cost
            from "Product" where category = 'Cristal' and laboratory = 'GRUPO OPTICO'`;
        const { ok } = emparejar(ps);

        const mkDeFamilia = {};
        for (const x of ok) (mkDeFamilia[x.seccion] ??= []).push(x.price / x.cost);

        const cubierto = new Set(ok.map(x => `${x.seccion}||${x.renglon}` +
            (x.seccion === 'Lente de stock / rango extendido' ? `||${/rango\s*extendido/i.test(x.name) ? 'RANGO EXTENDIDO' : 'STOCK'}` : '')));

        const altas = [];
        for (const S of SECCIONES) {
            const propios = mkDeFamilia[S.sec];
            const markup = MARKUP_DECIDIDO[S.sec] ?? (propios ? +mediana(propios).toFixed(2) : 3);
            const fuente = MARKUP_DECIDIDO[S.sec] ? 'decidido' : `mediana de ${propios?.length ?? 0}`;
            for (const f of S.filas().filter(f => f[S.campo] != null)) {
                const renglon = `${f.producto}${f.ar ? ` (${f.ar})` : ''}`;
                const clave = `${S.sec}||${renglon}` + (S.origen === 'STOCK' ? `||${f.disponibilidad}` : '');
                if (cubierto.has(clave)) continue;
                const costo = f[S.campo] + CALIBRADO;
                const sufijo = f.disponibilidad === 'RANGO EXTENDIDO' ? ' — Rango Extendido' : '';
                const modelo = `${CORTO[S.sec]} - ${renglon} ${f.indice ?? ''}`.trim() + sufijo;
                altas.push({
                    sec: S.sec, name: modelo, model: modelo, tipo: S.tipo, origen: S.origen,
                    indice: String(f.indice ?? ''), pelado: f[S.campo], costo,
                    precio: Math.ceil(costo * markup), markup, fuente,
                    esf: f.esf ?? null, cil: f.cil ?? null, add: f.add ?? S.add ?? null,
                });
            }
        }

        for (const S of SECCIONES) {
            const g = altas.filter(a => a.sec === S.sec);
            if (!g.length) continue;
            const v = g.map(a => a.precio).sort((a, b) => a - b);
            console.log(`  ${CORTO[S.sec].padEnd(24)}${String(g.length).padStart(3)} altas · ×${String(g[0].markup).padEnd(5)} (${g[0].fuente})  ${$(v[0])} a ${$(v[v.length - 1])}`);
        }
        console.log(`\n  TOTAL: ${altas.length} altas`);

        if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

        for (const a of altas) {
            const id = randomUUID();
            await prisma.$executeRaw`
                insert into "Product" (id, name, category, laboratory, type, brand, model, "lensIndex", "unitType",
                    origin, price, cost, "baseCost", is2x1, "sphereMin", "sphereMax", "cylinderMin", "cylinderMax",
                    "additionMin", "additionMax", "imagenesCatalogo", "publishToWeb", "createdAt", "updatedAt")
                values (${id}, ${a.name}, 'Cristal', 'GRUPO OPTICO', ${a.tipo}, 'Smart', ${a.model},
                    ${a.indice || null}, 'PAR', ${a.origen}, ${a.precio}, ${a.costo}, ${a.pelado}, false,
                    ${a.esf?.[0] ?? null}, ${a.esf?.[1] ?? null}, ${a.cil?.[0] ?? null}, ${a.cil?.[1] ?? null},
                    ${a.add?.[0] ?? null}, ${a.add?.[1] ?? null}, '{}', false, now(), now())`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'CREATE', 'PRODUCT', ${id},
                    ${JSON.stringify({ producto: a.name, familia: a.sec, pelado: a.pelado, calibrado: CALIBRADO,
                        costo: a.costo, markup: a.markup, origenDelMarkup: a.fuente, precio: a.precio })}::jsonb, now())`;
        }
        console.log(`\n✅ ${altas.length} cristal(es) dados de alta.`);
    } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(err => { console.error(err); process.exitCode = 1; });
}

/**
 * Sube al sistema la familia COMPLETA de multifocales de Grupo Óptico, y deja
 * cada línea en su markup.
 *
 * Decisiones de Ishtar (8/9/2026), después de mirar los precios contra el resto
 * del catálogo:
 *   · Smart ONE va a ×4,5 (no ×4): a ×4 su cristal más simple caía en $295.624,
 *     por debajo de la promo Mi Primer ($459.408) y de cualquier armazón del
 *     local. La línea de entrada no puede salir menos que la promoción.
 *   · Las otras cinco líneas (NEW, FREE, PRO, EXCLUSIVE, AI LENS) van a ×4 como
 *     PISO: el que ya está por encima se queda donde está — son los 24 Smart
 *     FREE que llegan hasta ×4,93 y que Ishtar decidió no bajar.
 *
 * Fórmula del costo: pelado de la lista + $7.272 de calibrado. Grupo Óptico NO
 * factura IVA (verificado contra 377 facturas: billedTotal == billedNet).
 *
 * EL 2x1 ES SOLO DEL SMART FREE. Es la única línea de Grupo Óptico con la promo;
 * las otras cinco se venden por par simple. Auditado en producción: los 25 FREE
 * cargados lo tienen, las otras nueve familias no. Las altas lo heredan de su
 * línea, no del nombre.
 *
 * Idempotente: chequea por RENGLÓN de la lista (familia + material + índice +
 * Essential), vía el emparejador — nunca por el texto del nombre, que es lo que
 * hizo aparecer 63 duplicados fantasma cuando se cargó Optovisión.
 *
 *   node scripts/maintenance/precios-grupo-optico/subir-multifocales-go.mjs
 *   node scripts/maintenance/precios-grupo-optico/subir-multifocales-go.mjs --produccion --aplicar
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
const FIRMA = 'Ishtar (familia de multifocales de Grupo Óptico)';

/** Las seis líneas, con su markup y de dónde sale el precio en el JSON. */
const LINEAS = [
    { nom: 'ONE',       sec: 'Multifocal Smart Lens ONE',       campo: 'one',       markup: 4.5 },
    { nom: 'NEW',       sec: 'Multifocal Smart Lens NEW',       campo: 'new',       markup: 4 },
    { nom: 'FREE',      sec: 'Multifocal Smart Lens FREE',      campo: 'free',      markup: 4 },
    { nom: 'PRO',       sec: 'Multifocal Smart Lens PRO',       campo: 'pro',       markup: 4 },
    { nom: 'EXCLUSIVE', sec: 'Multifocal Smart Lens EXCLUSIVE', campo: 'exclusive', markup: 4 },
    { nom: 'AI LENS',   sec: 'Multifocal Smart Lens AI LENS',   campo: 'ai_lens',   markup: 4 },
    // DRIVE sale de su propia tabla en la lista, no de la grilla de diseños, y
    // va a ×4,7 como las premium: es una lente especializada para conducir.
    { nom: 'DRIVE',     sec: 'Multifocal Smart Lens DRIVE',     campo: 'precio',    markup: 4.7, filas: 'drive' },
];
/** La adición que cubren todos los progresivos Smart Lens. */
const ADICION = [0.75, 3.5];

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
        console.log(`ONE ×4,5 · NEW/FREE/PRO/EXCLUSIVE/AI LENS ×4 como piso · calibrado $${CALIBRADO.toLocaleString('es-AR')}, sin IVA\n`);

        // `origin` es obligatorio en el select: sin él el emparejador clasifica mal.
        const ps = await prisma.$queryRaw`
            select id, name, "lensIndex", origin, price, cost
            from "Product" where category = 'Cristal' and laboratory = 'GRUPO OPTICO'`;
        const { ok } = emparejar(ps);
        const cubierto = new Set(ok.map(x => `${x.seccion}||${x.renglon}`));

        const ajustes = [], altas = [];
        for (const L of LINEAS) {
            // Lo que YA está: sube solo si quedó por debajo del markup de su línea.
            for (const x of ok.filter(o => o.seccion === L.sec && o.cost > 0)) {
                if (x.price / x.cost >= L.markup - 0.005) continue;
                ajustes.push({ id: x.id, nom: String(x.name).trim(), linea: L.nom,
                    hoy: Math.round(x.price), nuevo: Math.ceil(x.cost * L.markup),
                    mkHoy: x.price / x.cost, markup: L.markup });
            }
            // Lo que falta: alta nueva con la ficha completa.
            const origen = L.filas === 'drive' ? d.multifocales.drive : d.multifocales.filas;
            for (const f of origen.filter(f => f[L.campo] != null)) {
                const renglon = `${f.producto}${f.ar ? ` (${f.ar})` : ''}`;
                if (cubierto.has(`${L.sec}||${renglon}`)) continue;
                const costo = f[L.campo] + CALIBRADO;
                const es2x1 = L.nom === 'FREE';   // SOLO el Smart FREE lleva 2x1
                const modelo = `SMART ${L.nom} - ${renglon} ${f.indice}`;
                altas.push({
                    name: `Multifocal ${modelo}${es2x1 ? ' 2x1' : ''}`,
                    model: modelo, linea: L.nom, indice: String(f.indice),
                    pelado: f[L.campo], costo, precio: Math.ceil(costo * L.markup), markup: L.markup,
                    is2x1: es2x1, esf: f.esf ?? null, cil: f.cil ?? null, add: f.add ?? ADICION,
                });
            }
        }

        console.log(`━━ AJUSTES DE PRECIO (ya están en el sistema): ${ajustes.length}`);
        for (const a of ajustes)
            console.log(`   ${a.nom.slice(0, 50).padEnd(52)}×${a.mkHoy.toFixed(2)} → ×${a.markup}   ${$(a.hoy)} → ${$(a.nuevo)}`);

        console.log(`\n━━ ALTAS NUEVAS: ${altas.length}`);
        for (const L of LINEAS) {
            const g = altas.filter(a => a.linea === L.nom);
            if (!g.length) continue;
            const v = g.map(a => a.precio).sort((x, y) => x - y);
            console.log(`   Smart ${L.nom.padEnd(10)} ${String(g.length).padStart(3)} altas · ×${L.markup} · ${$(v[0])} a ${$(v[v.length - 1])}${L.nom === 'FREE' ? ' · con 2x1' : ''}`);
        }

        if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

        for (const a of ajustes) {
            await prisma.$executeRaw`update "Product" set price = ${a.nuevo}, "updatedAt" = now() where id = ${a.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${a.id},
                    ${JSON.stringify({ producto: a.nom, linea: `Smart ${a.linea}`, precioDe: a.hoy, precioA: a.nuevo,
                        markupDe: +a.mkHoy.toFixed(2), markupA: a.markup })}::jsonb, now())`;
        }
        console.log(`\n✅ ${ajustes.length} precio(s) ajustados.`);

        for (const a of altas) {
            const id = randomUUID();
            await prisma.$executeRaw`
                insert into "Product" (id, name, category, laboratory, type, brand, model, "lensIndex", "unitType",
                    origin, price, cost, "baseCost", is2x1, "sphereMin", "sphereMax", "cylinderMin", "cylinderMax",
                    "additionMin", "additionMax", "imagenesCatalogo", "publishToWeb", "createdAt", "updatedAt")
                values (${id}, ${a.name}, 'Cristal', 'GRUPO OPTICO', 'Cristal Multifocal', 'Smart', ${a.model},
                    ${a.indice}, 'PAR', 'LABORATORIO', ${a.precio}, ${a.costo}, ${a.pelado}, ${a.is2x1},
                    ${a.esf?.[0] ?? null}, ${a.esf?.[1] ?? null}, ${a.cil?.[0] ?? null}, ${a.cil?.[1] ?? null},
                    ${a.add?.[0] ?? null}, ${a.add?.[1] ?? null}, '{}', false, now(), now())`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'CREATE', 'PRODUCT', ${id},
                    ${JSON.stringify({ producto: a.name, linea: `Smart ${a.linea}`, pelado: a.pelado,
                        calibrado: CALIBRADO, costo: a.costo, markup: a.markup, precio: a.precio, is2x1: a.is2x1 })}::jsonb, now())`;
        }
        console.log(`✅ ${altas.length} cristal(es) dados de alta con la ficha completa.`);
    } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(err => { console.error(err); process.exitCode = 1; });
}

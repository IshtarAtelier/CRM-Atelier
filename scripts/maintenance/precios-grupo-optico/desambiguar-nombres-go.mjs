/**
 * Mete en el nombre lo que DISTINGUE a cada renglón de la lista de Grupo Óptico
 * cuando el material y el índice no alcanzan.
 *
 * El problema (8/9/2026): la lista tiene renglones que comparten material e
 * índice y se diferencian por otra cosa — cuatro "Mineral Blanco 1.523" que solo
 * se distinguen por el rango de graduación, y varios "Orgánico Blanco" que se
 * distinguen por el diámetro (hasta Ø65, Ø70, Ø75). Al darlos de alta con el
 * nombre "Familia - Material Índice" quedaron cuatro productos con nombre
 * idéntico, y el emparejador ya no podía volver a encontrar su renglón: pedía
 * material + índice y le respondían cuatro filas distintas, así que agarraba la
 * primera. Eso hacía que 32 productos "no coincidieran con la lista" en la
 * auditoría, aunque su costo estuviera bien guardado.
 *
 * Cómo se resuelve sin adivinar: el `baseCost` de cada producto ES su renglón.
 * Ese número identifica la fila exacta dentro de su sección, así que se busca
 * por ahí y se le agrega al nombre el dato que la distingue —el rango, o el
 * diámetro que ya viene en el nombre del producto de la lista—.
 *
 * También completa el índice de los bifocales Flat Top, que la lista no publica
 * por renglón: es el del material (1.49 orgánico, 1.59 policarbonato, 1.523
 * mineral).
 *
 * QUÉ TOCA: `name`, `model` y `lensIndex`. Ni un precio, ni un costo.
 *
 *   node scripts/maintenance/precios-grupo-optico/desambiguar-nombres-go.mjs
 *   node scripts/maintenance/precios-grupo-optico/desambiguar-nombres-go.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { pathToFileURL } from 'node:url';
import { datos as d } from './emparejador-go.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (nombres desambiguados en Grupo Óptico)';

/** Todas las filas de la lista, con el precio pelado como identificador. */
function filasDeLaLista() {
    const out = [];
    const push = (filas, campo) => filas.filter(f => f[campo] != null)
        .forEach(f => out.push({ pelado: f[campo], rango: f.rango ?? null, producto: f.producto, indice: f.indice ?? null }));
    push(d.stock_y_rango_extendido.filas, 'precio');
    push(d.monofocal_laboratorio.filas, 'cnc');
    push(d.monofocal_laboratorio.filas, 'ultra');
    push(d.bifocales.filas, 'cnc');
    push(d.ocupacional_y_digitales.kriptock_invisible.filas, 'precio');
    push(d.ocupacional_y_digitales.office.filas, 'precio');
    push(d.ocupacional_y_digitales.ultra_relax.filas, 'precio');
    push(d.control_miopia.filas, 'myofix');
    push(d.control_miopia.filas, 'myolens');
    return out;
}

/** El índice que corresponde al material, cuando la lista no lo publica. */
const INDICE_POR_MATERIAL = [
    [/mineral/i, '1.523'], [/policarbonato/i, '1.59'], [/stylis|1[.,]67/i, '1.67'],
    [/alto\s*[ií]ndice\s*1[.,]74|1[.,]74/i, '1.74'], [/alto\s*[ií]ndice|1[.,]60/i, '1.60'],
    [/blue\s*light|1[.,]56/i, '1.56'], [/org[áa]nico|blanco/i, '1.49'],
];

/** Un rango largo, resumido para que entre en el nombre. */
const cortoRango = r => String(r)
    .replace(/Esf\/Cil/gi, '').replace(/Esf/gi, '').replace(/\s+/g, ' ')
    .replace(/,00/g, '').trim().slice(0, 30);

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!url) { console.error('Falta la URL de la base en el .env'); process.exitCode = 1; return; }
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
        console.error('❌ DATABASE_URL no apunta a localhost. Para producción hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO'}\n`);
        const ps = await prisma.$queryRaw`
            select id, name, model, "lensIndex", "baseCost" from "Product"
            where category = 'Cristal' and laboratory = 'GRUPO OPTICO' order by name`;
        const lista = filasDeLaLista();

        // Qué nombres se repiten: solo esos necesitan el desempate.
        const cuenta = {};
        for (const p of ps) cuenta[p.name.trim()] = (cuenta[p.name.trim()] ?? 0) + 1;

        const cambios = [];
        const usadas = new Map();
        for (const p of ps) {
            const nom = p.name.trim();
            let nuevo = nom, indice = p.lensIndex;

            if ((cuenta[nom] ?? 0) > 1 && p.baseCost != null) {
                // El pelado identifica la fila… salvo cuando DOS renglones valen
                // lo mismo y solo cambia el rango (los dos Mineral Blanco de
                // $20.904). Entonces se reparten en orden: al primer producto de
                // ese precio le toca la primera fila, al segundo la segunda.
                const candidatas = lista.filter(f => Math.round(f.pelado) === Math.round(p.baseCost) && f.rango);
                const yaUsadas = usadas.get(Math.round(p.baseCost)) ?? 0;
                const fila = candidatas[Math.min(yaUsadas, candidatas.length - 1)];
                if (fila?.rango) {
                    nuevo = `${nom} · ${cortoRango(fila.rango)}`;
                    usadas.set(Math.round(p.baseCost), yaUsadas + 1);
                }
            }
            if (!String(indice ?? '').trim()) {
                indice = INDICE_POR_MATERIAL.find(([re]) => re.test(nom))?.[1] ?? null;
            }
            if (nuevo !== nom || indice !== p.lensIndex) cambios.push({ id: p.id, nom, nuevo, indice, indiceViejo: p.lensIndex });
        }

        console.log(`${cambios.length} a corregir:\n`);
        cambios.forEach(c => {
            if (c.nuevo !== c.nom) console.log(`  "${c.nom.slice(0, 44)}"\n   → "${c.nuevo.slice(0, 64)}"`);
            if (c.indice !== c.indiceViejo) console.log(`  "${c.nom.slice(0, 44)}"  índice: ${c.indiceViejo || '(vacío)'} → ${c.indice}`);
        });

        // Después del cambio no puede quedar ningún nombre repetido.
        const despues = new Set(ps.map(p => (cambios.find(c => c.id === p.id)?.nuevo ?? p.name.trim())));
        console.log(`\n  nombres únicos después: ${despues.size} de ${ps.length} ${despues.size === ps.length ? '✅' : '❌ siguen repetidos'}`);

        if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

        for (const c of cambios) {
            await prisma.$executeRaw`
                update "Product" set name = ${c.nuevo}, model = ${c.nuevo},
                    "lensIndex" = coalesce(${c.indice}, "lensIndex"), "updatedAt" = now()
                where id = ${c.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${c.id},
                    ${JSON.stringify({ nombreDe: c.nom, nombreA: c.nuevo, indiceDe: c.indiceViejo, indiceA: c.indice,
                        motivo: 'El material y el índice no alcanzaban para distinguir el renglón de la lista.' })}::jsonb, now())`;
        }
        console.log(`\n✅ ${cambios.length} nombre(s) corregidos. No se tocó ni un precio ni un costo.`);
    } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(err => { console.error(err); process.exitCode = 1; });
}

/**
 * CORRIGE los rangos de graduación mal cargados.
 *
 * Ishtar, 9/9/2026: "volvé a revisar que los rangos sean correctos … auditá
 * TODO, que no quede ningún dato sin subir, que sea perfecto".
 *
 * POR QUÉ IMPORTA: el rango es lo que usa el filtro por receta del cotizador.
 * Un rango mal cargado no se ve en ninguna pantalla — el cristal simplemente
 * NO APARECE cuando el vendedor tipea la graduación del cliente. Cuatro
 * ocupacionales tenían la esfera de -12 a -0,25 (el rango de un cristal de
 * control de miopía): eran invisibles para cualquier présbita hipermétrope,
 * que es justo a quien se le vende un ocupacional.
 *
 * LAS TRES REGLAS QUE APLICA:
 *
 * 1. GRUPO ÓPTICO, multifocales y ocupacionales — el rango es del MATERIAL +
 *    ÍNDICE, no del diseño. Está verificado: el mismo Blue Light 1.56 tiene
 *    idéntico -12/+8 en FREE, ONE y NEW. Sale de la tabla "Monofocal
 *    Laboratorio" (pág. 4) y depende solo del índice:
 *        1.49 / 1.56 / 1.60 -> esf -12/+8   ·  1.67 -> esf -14,50/+8
 *        1.74              -> esf -15/+8    ·  policarbonato 1.59 -> esf -14/+8
 *    Cilindro ±6, con tres excepciones que la lista da más angostas y que hay
 *    que respetar: el Fotocromático Smart Color (esf -8/+5, cil ±5), los
 *    polarizados y el Gris 3 Espejado 1.49 (esf -5/+7, cil ±4) y el
 *    policarbonato FOTOCROMÁTICO, que llega a -13 y no a -14.
 *    Lo que había: 24 con el rango del BIFOCAL Flat Top (esf -4/+5,5), 13
 *    policarbonatos con el del bifocal de poli (esf -5/+6,5) y 4 con el de
 *    control de miopía (esf -12/-0,25).
 *
 * 2. GRUPO ÓPTICO, lentes de stock — transcriptos uno por uno de la página 3
 *    leída como imagen. Estaban CRUZADOS: al "stock" le habían puesto el rango
 *    del "rango extendido" y al revés. Se le ofrecía al cliente una lente de
 *    stock en graduaciones que el laboratorio no tiene.
 *
 * 3. OPTOVISIÓN, los 29 SYGNUS — tenían el cilindro en blanco. La lista (págs.
 *    23-24) dice ±6,00 en los 29 renglones.
 *
 * NO TOCA precios ni costos. Solo los campos de rango y, en un caso, el índice.
 *
 * QUÉ NO ARREGLA, a propósito:
 *  · `Stock · Orgánico Super Blue Asf. 1.74 · Rango Extendido`, con cilindro
 *    -15: el error está en el PDF del laboratorio, que en ese renglón escribe
 *    "-12,25 / -15,00" cuando los otros dos pares son "-2,00". Hay que
 *    preguntarle a Grupo Óptico, no corregirlo a ojo.
 *  · Los ~195 cristales de Optovisión que no son Sygnus: sus rangos no están
 *    transcriptos en ningún archivo del repo, así que no hay contra qué
 *    contrastarlos. Inventarlos sería peor que dejarlos.
 *  · Los 5 de LA CÁMARA: no hay lista de ese laboratorio.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/rangos/corregir-rangos-cristales.mjs --produccion
 *   node scripts/maintenance/rangos/corregir-rangos-cristales.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (rangos corregidos contra las listas de laboratorio)';

/**
 * Rango del MATERIAL + ÍNDICE, tabla "Monofocal Laboratorio" (pág. 4). El orden
 * de las reglas importa: gana la primera que matchea, así el Smart Color y los
 * polarizados —que la lista da más angostos— no caen en la regla general, y el
 * policarbonato FOTOCROMÁTICO (-13) no se confunde con el resto de los
 * policarbonatos (-14).
 */
function rangoGO(nombre, indice) {
    const n = String(nombre);
    const idx = String(indice ?? '');
    if (/smart color/i.test(n)) return { esf: [-8, 5], cil: [-5, 5] };
    if (/polarizado|gris 3 espejado/i.test(n)) return { esf: [-5, 7], cil: [-4, 4] };
    if (/policarbonato/i.test(n)) return /fotocrom/i.test(n)
        ? { esf: [-13, 8], cil: [-6, 6] }
        : { esf: [-14, 8], cil: [-6, 6] };
    if (idx.startsWith('1.74')) return { esf: [-15, 8], cil: [-6, 6] };
    if (idx.startsWith('1.67')) return { esf: [-14.5, 8], cil: [-6, 6] };
    return { esf: [-12, 8], cil: [-6, 6] };
}

/**
 * Los lentes de stock de Grupo Óptico, por su precio pelado (llave única).
 * Transcripto de la página 3 del PDF leída como imagen: "Esf +/- 6,00 //
 * Esf/Cil +6,00 / -2,00 // -6,00 / +2,00" se lee esfera -6/+6 con cilindro ±2.
 */
const STOCK_GO = {
    3337:  { esf: [-6, 6], cil: [-2, 2], que: 'Organico Blanco 1,49 stock' },
    9944:  { esf: [-4, 4], cil: [-4, 4], que: 'Organico Blanco 1,49 rango extendido' },
    5013:  { esf: [-6, 6], cil: [-2, 2], que: 'Organico Blanco c/AR 1,56 stock' },
    11367: { esf: [-4, 4], cil: [-4, 4], que: 'Organico Blanco c/AR 1,56 rango extendido' },
    6830:  { esf: [-6, 6], cil: [-2, 2], que: 'Organico Blue c/AR 1,56 stock' },
    13551: { esf: [-4, 4], cil: [-4, 4], que: 'Organico Blue c/AR 1,56 rango extendido' },
    20765: { esf: [-6, 6], cil: [-2, 2], que: 'Organico Super Blue Asf. c/AR 1,60 stock' },
    23164: { esf: [-10, 6], cil: [-4, 4], que: 'Organico Super Blue Asf. c/AR 1,60 rango extendido' },
    18554: { esf: [-4, 4], cil: [-2, 2], que: 'Organico Fotocromatico c/AR Gris 1,56 stock' },
    15145: { esf: [-6, 6], cil: [-2, 2], que: 'Policarbonato c/AR 1,59 stock' },
    12982: { esf: [-4, 4], cil: [-2, 2], que: 'Policarbonato Blanco 1,59 stock' },
};

/**
 * El Flat Top de policarbonato estaba cargado con el rango Y el índice del Flat
 * Top ORGÁNICO. Un policarbonato es 1.59; su hermano Kriptock ya está así.
 */
const BIFOCAL_POLI = { baseCost: 53799, indice: '1.59', esf: [-5, 6.5], cil: [-6, 6], add: [1, 3] };

const r = (a, b) => `${a}/${b}`;

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!url) { console.error('Falta la URL de la base en el .env'); process.exitCode = 1; return; }
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
        console.error('DATABASE_URL no apunta a localhost. Para tocar produccion hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`Base: ${PRODUCCION ? 'PRODUCCION' : 'LOCAL'} | modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}\n`);

        const ps = await prisma.$queryRaw`
            select id, name, laboratory, "lensIndex", "baseCost", origin,
                   "sphereMin", "sphereMax", "cylinderMin", "cylinderMax", "additionMin", "additionMax"
            from "Product" where category = 'Cristal' order by name`;

        const cambios = [];
        const proponer = (p, esf, cil, motivo, extra = {}) => {
            const igual = Number(p.sphereMin) === esf[0] && Number(p.sphereMax) === esf[1]
                && Number(p.cylinderMin) === cil[0] && Number(p.cylinderMax) === cil[1]
                && (extra.indice == null || p.lensIndex === extra.indice);
            if (!igual) cambios.push({ p, esf, cil, motivo, ...extra });
        };

        for (const p of ps) {
            const n = String(p.name);
            const pelado = p.baseCost == null ? null : Math.round(Number(p.baseCost));

            if (p.laboratory === 'GRUPO OPTICO' && /^(Multifocal|Ocupacional)/i.test(n)) {
                const { esf, cil } = rangoGO(n, p.lensIndex);
                proponer(p, esf, cil, 'rango del material + indice (Monofocal Laboratorio, pag. 4)');
            } else if (p.laboratory === 'GRUPO OPTICO' && pelado != null && STOCK_GO[pelado]) {
                const s = STOCK_GO[pelado];
                proponer(p, s.esf, s.cil, `lista de stock, pag. 3 (${s.que})`);
            } else if (pelado === BIFOCAL_POLI.baseCost) {
                proponer(p, BIFOCAL_POLI.esf, BIFOCAL_POLI.cil,
                    'Flat Top de POLICARBONATO: tenia el rango y el indice del Flat Top organico',
                    { indice: BIFOCAL_POLI.indice, add: BIFOCAL_POLI.add });
            } else if (p.laboratory === 'OPTOVISION' && /sygnus/i.test(n)
                       && (p.cylinderMin == null || p.cylinderMax == null)) {
                proponer(p, [Number(p.sphereMin), Number(p.sphereMax)], [-6, 6],
                    'los Sygnus llevan cilindro +/-6,00 (lista de Optovision, pags. 23-24)');
            }
        }

        const porMotivo = {};
        for (const c of cambios) (porMotivo[c.motivo] ??= []).push(c);

        console.log(`${ps.length} cristales revisados | ${cambios.length} a corregir\n`);
        for (const [motivo, lista] of Object.entries(porMotivo)) {
            console.log(`-- ${lista.length} | ${motivo}`);
            for (const c of lista) {
                const idx = c.indice ? `  indice ${c.p.lensIndex} -> ${c.indice}` : '';
                console.log(`   ${String(c.p.name).slice(0, 60).padEnd(62)} esf ${r(c.p.sphereMin, c.p.sphereMax).padStart(11)} -> ${r(...c.esf).padStart(9)}   cil ${r(c.p.cylinderMin, c.p.cylinderMax).padStart(9)} -> ${r(...c.cil).padStart(7)}${idx}`);
            }
            console.log();
        }

        if (!APLICAR) { console.log('Ensayo: no se escribio nada. Para aplicarlo: --aplicar'); return; }

        for (const c of cambios) {
            await prisma.$executeRaw`
                update "Product"
                set "sphereMin" = ${c.esf[0]}, "sphereMax" = ${c.esf[1]},
                    "cylinderMin" = ${c.cil[0]}, "cylinderMax" = ${c.cil[1]},
                    "lensIndex" = coalesce(${c.indice ?? null}, "lensIndex"),
                    "additionMin" = coalesce(${c.add?.[0] ?? null}, "additionMin"),
                    "additionMax" = coalesce(${c.add?.[1] ?? null}, "additionMax"),
                    "updatedAt" = now()
                where id = ${c.p.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${c.p.id},
                    ${JSON.stringify({ producto: c.p.name, motivo: c.motivo,
                        esfDe: r(c.p.sphereMin, c.p.sphereMax), esfA: r(...c.esf),
                        cilDe: r(c.p.cylinderMin, c.p.cylinderMax), cilA: r(...c.cil),
                        indiceA: c.indice ?? null })}::jsonb, now())`;
        }
        console.log(`LISTO: ${cambios.length} rango(s) corregidos. No se tocaron precios ni costos.`);
    } finally { await prisma.$disconnect(); }
}

main().catch(e => { console.error(e); process.exitCode = 1; });

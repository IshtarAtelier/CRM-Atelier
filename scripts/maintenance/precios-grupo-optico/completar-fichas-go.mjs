/**
 * Completa la ficha de los cristales de Grupo Óptico: rangos de graduación,
 * adición, modelo y tipo de confección.
 *
 * Por qué hace falta: las 116 altas del 8/9/2026 entraron sin rango porque la
 * sección `multifocales` del JSON nunca tuvo los rangos transcriptos (0 de 25
 * filas los traen). Sin rango, el cotizador no puede filtrar por graduación y
 * el vendedor no sabe si la receta entra en ese cristal.
 *
 * DE DÓNDE SALEN LOS RANGOS, sin inventar ninguno:
 *   · El rango es del MATERIAL + ÍNDICE, no del diseño. Está comprobado en la
 *     propia base: "Orgánico Blue Light (ESSENTIAL) 1.56" tiene el mismo
 *     -12/+8 esf y -6/+6 cil cargado en FREE, en ONE y en NEW; y el 1.67 tiene
 *     otro (-14,5/+8). Así que se copia del hermano que YA lo tiene cargado,
 *     emparejando por renglón de lista + índice.
 *   · La adición de los progresivos Smart Lens es 0,75 a 3,50 en todos: es el
 *     único valor que aparece entre los 27 multifocales ya cargados, y es el
 *     que declara el emparejador para esas secciones.
 *   · Un cristal cuyo material no tenga ningún hermano con rango cargado se
 *     INFORMA y se deja vacío. Un rango inventado hace que el vendedor acepte
 *     una receta que el laboratorio después rechaza.
 *
 * CONFECCIÓN: todo lo que no es lente de stock es de LABORATORIO — confirmado
 * por Ishtar el 8/9/2026 sobre los multifocales, bifocales digitales y
 * ocupacionales que estaban sin marcar.
 *
 *   node scripts/maintenance/precios-grupo-optico/completar-fichas-go.mjs
 *   node scripts/maintenance/precios-grupo-optico/completar-fichas-go.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { pathToFileURL } from 'node:url';
import { emparejar } from './emparejador-go.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (fichas de Grupo Óptico completadas)';
/** La adición de todos los progresivos Smart Lens. */
const ADICION = [0.75, 3.5];
const SECCION_STOCK = 'Lente de stock / rango extendido';
const ES_PROGRESIVO = s => /Smart Lens|MyoFix|MyoLens|Office|Ultra Relax|Kriptock Invisible/.test(s);

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
            select id, name, model, "lensIndex", origin, price, cost,
                   "sphereMin", "sphereMax", "cylinderMin", "cylinderMax", "additionMin", "additionMax"
            from "Product" where category = 'Cristal' and laboratory = 'GRUPO OPTICO'`;
        const { ok } = emparejar(ps);

        // Mapa de rangos conocidos, por renglón de lista + índice.
        const conocido = new Map();
        for (const x of ok) {
            if (x.sphereMin == null) continue;
            const k = `${x.renglon}||${x.indice}`;
            if (!conocido.has(k)) conocido.set(k, {
                esfMin: x.sphereMin, esfMax: x.sphereMax, cilMin: x.cylinderMin, cilMax: x.cylinderMax,
            });
        }
        console.log(`Rangos conocidos: ${conocido.size} combinaciones de material + índice\n`);

        const arreglos = [], sinRango = [];
        for (const x of ok) {
            const set = {};
            if (x.sphereMin == null) {
                const r = conocido.get(`${x.renglon}||${x.indice}`);
                if (r) Object.assign(set, { sphereMin: r.esfMin, sphereMax: r.esfMax, cylinderMin: r.cilMin, cylinderMax: r.cilMax });
                else sinRango.push(x);
            }
            if (x.additionMin == null && ES_PROGRESIVO(x.seccion)) Object.assign(set, { additionMin: ADICION[0], additionMax: ADICION[1] });
            if (!String(x.model ?? '').trim()) set.model = `${x.seccion.replace('Multifocal ', '').replace(' (CNC)', '')} - ${x.renglon} ${x.indice ?? ''}`.trim();
            if (!String(x.origin ?? '').trim()) set.origin = x.seccion === SECCION_STOCK ? 'STOCK' : 'LABORATORIO';
            if (Object.keys(set).length) arreglos.push({ id: x.id, nom: String(x.name).trim(), sec: x.seccion, set });
        }

        const cuenta = campo => arreglos.filter(a => a.set[campo] !== undefined).length;
        console.log(`  ${arreglos.length} cristales a completar:`);
        console.log(`     rango de esfera y cilindro ...... ${cuenta('sphereMin')}`);
        console.log(`     adición ......................... ${cuenta('additionMin')}`);
        console.log(`     modelo .......................... ${cuenta('model')}`);
        console.log(`     confección ...................... ${cuenta('origin')}`);
        if (sinRango.length) {
            console.log(`\n  ⚠️  ${sinRango.length} sin rango y sin hermano de dónde copiarlo (quedan vacíos):`);
            [...new Set(sinRango.map(x => `${x.renglon} ${x.indice} [${x.seccion}]`))].slice(0, 12)
                .forEach(t => console.log(`     ${t}`));
        }

        if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

        for (const a of arreglos) {
            const s = a.set;
            await prisma.$executeRaw`
                update "Product" set
                    "sphereMin"   = coalesce(${s.sphereMin ?? null}::double precision, "sphereMin"),
                    "sphereMax"   = coalesce(${s.sphereMax ?? null}::double precision, "sphereMax"),
                    "cylinderMin" = coalesce(${s.cylinderMin ?? null}::double precision, "cylinderMin"),
                    "cylinderMax" = coalesce(${s.cylinderMax ?? null}::double precision, "cylinderMax"),
                    "additionMin" = coalesce(${s.additionMin ?? null}::double precision, "additionMin"),
                    "additionMax" = coalesce(${s.additionMax ?? null}::double precision, "additionMax"),
                    model         = coalesce(${s.model ?? null}, model),
                    origin        = coalesce(${s.origin ?? null}, origin),
                    "updatedAt"   = now()
                where id = ${a.id}`;
        }
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', 'lote:fichas-go',
                ${JSON.stringify({ descripcion: 'Rangos, adición, modelo y confección completados en Grupo Óptico',
                    cristales: arreglos.length, rangos: cuenta('sphereMin'), adicion: cuenta('additionMin'),
                    modelo: cuenta('model'), confeccion: cuenta('origin'), sinRango: sinRango.length,
                    origenDeLosRangos: 'copiados del mismo material + índice ya cargado; la adición de progresivos es 0,75–3,50' })}::jsonb, now())`;
        console.log(`\n✅ ${arreglos.length} ficha(s) completadas. No se tocó ni un precio ni un costo.`);
    } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(err => { console.error(err); process.exitCode = 1; });
}

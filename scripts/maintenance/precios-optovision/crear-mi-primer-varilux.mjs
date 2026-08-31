/**
 * Sube "Mi Primer Varilux" / "Mi Primer Kodak" a las familias que todavía no
 * lo tenían.
 *
 * Hoy (30/8/2026) la promo del 50% solo existe para Comfort Max, en 4
 * materiales (ORMA, AIRWEAR 1.59, STYLIS 1.67, ORMA TRANSITIONS GEN S).
 * Ishtar pidió subirla también en Comfort, Physio, Physio 3.0 y XR Design
 * (Varilux) y en Kodak Precise y Kodak Unique DRO — los mismos 4 materiales,
 * misma promo, mismo cálculo.
 *
 * CÓMO SE CALCULA (igual que Comfort Max, verificado el 30/8/2026):
 *   · costo  → `emparejador.mjs` ya sabe hacerlo: detecta "mi primer" por
 *     nombre y usa MEDIA lista del mejor Crizal + calibrado ENTERO × IVA.
 *     Es el mismo camino auditado que sincroniza todo el catálogo — no se
 *     reimplementa la fórmula acá.
 *   · precio → la MITAD del precio de venta del 2x1 hermano de esa familia y
 *     material (verificado: así se armó Comfort Max, ej. ORMA
 *     $1.440.861 / 2 = $720.432 ≈ el precio real cargado).
 *
 * Crea los que faltan, y COMPLETA los campos de ficha (type, brand, model,
 * lensIndex, unitType, límites de esfera/cilindro/adición) en los que ya
 * existan pero les falten — copiándolos del hermano 2x1 de la misma familia y
 * material, que sí los tiene bien cargados. Así el script es idempotente: se
 * puede correr de nuevo sin duplicar ni pisar el precio/costo ya calculado.
 * category='Cristal', laboratory='OPTOVISION', origin='LABORATORIO',
 * unitType='PAR', is2x1=false (es un par simple con 50% de descuento, no 2x1).
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/precios-optovision/crear-mi-primer-varilux.mjs
 *   node scripts/maintenance/precios-optovision/crear-mi-primer-varilux.mjs --aplicar
 *   node scripts/maintenance/precios-optovision/crear-mi-primer-varilux.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { emparejar } from './emparejador.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (Mi Primer Varilux — nuevas familias)';

const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(`Falta ${PRODUCCION ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`); process.exit(1); }
if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no apunta a localhost. Para tocar producción hace falta --produccion.');
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const pesos = n => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;

// Familia a crear → nombre en el producto nuevo, y el nombre EXACTO de su
// hermano 2x1 por material (de donde sale el precio, a mitad).
const FAMILIAS = [
    {
        prefijo: 'MI PRIMER VARILUX', etiqueta: 'COMFORT', hermanos: {
            'ORMA': 'COMFORT - ORMA + CRIZAL 2x1',
            'AIRWEAR 1.59': 'COMFORT - AIRWEAR 1.59 + CRIZAL 2x1',
            'STYLIS 1.67': 'COMFORT - STYLIS 1.67 + CRIZAL 2x1',
            'ORMA TRANSITIONS GEN S (Fotocromático)': 'COMFORT - ORMA TRANSITIONS GEN S + CRIZAL 2x1 (Fotocromático)',
        },
    },
    {
        prefijo: 'MI PRIMER VARILUX', etiqueta: 'PHYSIO', hermanos: {
            'ORMA': 'PHYSIO - ORMA + CRIZAL 2x1',
            'AIRWEAR 1.59': 'PHYSIO - AIRWEAR 1.59 + CRIZAL 2x1',
            'STYLIS 1.67': 'PHYSIO - STYLIS 1.67 + CRIZAL 2x1',
            'ORMA TRANSITIONS GEN S (Fotocromático)': 'PHYSIO - ORMA TRANSITIONS GEN S + CRIZAL 2x1 (Fotocromático)',
        },
    },
    {
        prefijo: 'MI PRIMER VARILUX', etiqueta: 'PHYSIO 3.0', hermanos: {
            'ORMA': 'PHYSIO 3.0 - ORMA + CRIZAL 2x1',
            'AIRWEAR 1.59': 'PHYSIO 3.0 - AIRWEAR 1.59 + CRIZAL 2x1',
            'STYLIS 1.67': 'PHYSIO 3.0 - STYLIS 1.67 + CRIZAL 2x1',
            'ORMA TRANSITIONS GEN S (Fotocromáticos 8)': 'PHYSIO 3.0 - ORMA TRANSITIONS GEN S + CRIZAL (fotocromáticos 8) 2x1',
        },
    },
    {
        prefijo: 'MI PRIMER VARILUX', etiqueta: 'XR DESIGN', hermanos: {
            'ORMA': 'XR DESIGN - ORMA + CRIZAL 2x1',
            'AIRWEAR 1.59': 'XR DESIGN - AIRWEAR 1.59 + CRIZAL 2x1',
            'STYLIS 1.67': 'XR DESIGN - STYLIS 1.67 + CRIZAL 2x1',
            'ORMA TRANSITIONS GEN S (Fotocromáticos 8)': 'XR DESIGN - ORMA TRANSITIONS GEN S + CRIZAL Prevencia (fotocromáticos 8) 2x1',
        },
    },
    // "Mi Primer Kodak": mismo concepto, las dos líneas progresivas de Kodak.
    {
        prefijo: 'MI PRIMER KODAK', etiqueta: 'PRECISE', hermanos: {
            'ORMA': 'KODAK PRECISE - ORMA 2x1',
            'AIRWEAR 1.59': 'KODAK PRECISE - AIRWEAR 1.59 2x1',
            'STYLIS 1.67': 'KODAK PRECISE - STYLIS 1.67 2x1',
            'ORMA TRANSITIONS GEN S (Fotocromático)': 'KODAK PRECISE - ORMA TRANSITIONS GEN S 2x1 (Fotocromático)',
        },
    },
    {
        prefijo: 'MI PRIMER KODAK', etiqueta: 'UNIQUE DRO', hermanos: {
            'ORMA': 'KODAK UNIQUE DRO - ORMA 2x1',
            'AIRWEAR 1.59': 'KODAK UNIQUE DRO - AIRWEAR 1.59 2x1',
            'STYLIS 1.67': 'KODAK UNIQUE DRO - STYLIS 1.67 2x1',
            'ORMA TRANSITIONS GEN S (Fotocromático)': 'KODAK UNIQUE DRO - ORMA TRANSITIONS GEN S 2x1 (Fotocromático)',
        },
    },
];

const marcaDe = fam => fam.prefijo === 'MI PRIMER KODAK' ? 'Mi primer Kodak' : 'Mi primer Varilux';

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}\n`);

    const aCrear = [], aCompletar = [];
    for (const fam of FAMILIAS) {
        for (const [material, nombreHermano] of Object.entries(fam.hermanos)) {
            const nombreNuevo = `${fam.prefijo} ${fam.etiqueta} - ${material}`;
            const modelo = `${fam.prefijo} ${fam.etiqueta}`;
            const marca = marcaDe(fam);

            const [hermano] = await prisma.$queryRaw`
                select name, price, type, "lensIndex", "sphereMin", "sphereMax",
                    "cylinderMin", "cylinderMax", "additionMin", "additionMax"
                from "Product" where name = ${nombreHermano}`;
            if (!hermano) { console.log(`  ⚠️  no encuentro el hermano 2x1 "${nombreHermano}" — salteo ${nombreNuevo}`); continue; }

            const [existente] = await prisma.$queryRaw`
                select id, cost, "baseCost", type from "Product" where name = ${nombreNuevo}`;

            const ficha = {
                type: hermano.type, brand: marca, model: modelo, lensIndex: hermano.lensIndex,
                sphereMin: hermano.sphereMin, sphereMax: hermano.sphereMax,
                cylinderMin: hermano.cylinderMin, cylinderMax: hermano.cylinderMax,
                additionMin: hermano.additionMin, additionMax: hermano.additionMax,
            };

            if (existente) {
                if (existente.type == null) {
                    aCompletar.push({ id: existente.id, nombre: nombreNuevo, ...ficha });
                } else {
                    console.log(`  ya está completo, se salta: ${nombreNuevo}`);
                }
                continue;
            }

            // El costo sale del MISMO camino auditado que todo el catálogo:
            // emparejar() detecta "mi primer" en el nombre y usa media lista.
            const { ok } = emparejar([{ id: null, name: nombreNuevo, price: 0, cost: 0, baseCost: null, is2x1: false }]);
            const calculado = ok[0];
            if (!calculado) { console.log(`  ⚠️  no empareja con la lista: ${nombreNuevo} — revisar a mano`); continue; }

            const precioNuevo = Math.round(hermano.price / 2);
            aCrear.push({
                nombre: nombreNuevo, precio: precioNuevo, costo: calculado.costoNuevo,
                pelado: Math.round(calculado.lista), hermano: hermano.name, precioHermano: hermano.price, ...ficha,
            });
        }
    }

    if (!aCrear.length && !aCompletar.length) { console.log('\nNada para hacer — ya está todo.'); return; }

    if (aCrear.length) {
        console.log(`\n${aCrear.length} producto(s) nuevo(s):\n`);
        console.log(`  ${'Producto'.slice(0, 52).padEnd(54)}${'precio'.padStart(12)}${'costo'.padStart(12)}${'markup'.padStart(9)}  ficha`);
        for (const p of aCrear) {
            const mk = p.costo > 0 ? p.precio / p.costo : null;
            console.log(`  ${p.nombre.slice(0, 52).padEnd(54)}${pesos(p.precio).padStart(12)}${pesos(p.costo).padStart(12)}` +
                `${(mk ? '×' + mk.toFixed(2) : '—').padStart(9)}  ${p.brand} · idx ${p.lensIndex} · esf ${p.sphereMin}/${p.sphereMax} cil ${p.cylinderMin}/${p.cylinderMax} add ${p.additionMin}/${p.additionMax}`);
        }
    }
    if (aCompletar.length) {
        console.log(`\n${aCompletar.length} producto(s) YA CREADOS a los que les falta la ficha (se completa, no se toca precio/costo):\n`);
        for (const p of aCompletar) {
            console.log(`  ${p.nombre} → ${p.brand} · modelo "${p.model}" · idx ${p.lensIndex} · esf ${p.sphereMin}/${p.sphereMax} cil ${p.cylinderMin}/${p.cylinderMax} add ${p.additionMin}/${p.additionMax}`);
        }
    }

    if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

    for (const p of aCrear) {
        const id = await prisma.$queryRaw`select gen_random_uuid()::text as id`;
        const productId = id[0].id;
        await prisma.$executeRaw`
            insert into "Product" (id, name, category, laboratory, origin, price, cost, "baseCost", is2x1,
                type, brand, model, "lensIndex", "unitType",
                "sphereMin", "sphereMax", "cylinderMin", "cylinderMax", "additionMin", "additionMax",
                "createdAt", "updatedAt")
            values (${productId}, ${p.nombre}, 'Cristal', 'OPTOVISION', 'LABORATORIO', ${p.precio}, ${p.costo}, ${p.pelado}, false,
                ${p.type}, ${p.brand}, ${p.model}, ${p.lensIndex}, 'PAR',
                ${p.sphereMin}, ${p.sphereMax}, ${p.cylinderMin}, ${p.cylinderMax}, ${p.additionMin}, ${p.additionMax},
                now(), now())`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${productId},
                ${JSON.stringify({ creado: p.nombre, precio: p.precio, costo: p.costo, pelado: p.pelado, hermano2x1: p.hermano, precioHermano: p.precioHermano })}::jsonb, now())`;
    }
    for (const p of aCompletar) {
        await prisma.$executeRaw`
            update "Product" set
                type = ${p.type}, brand = ${p.brand}, model = ${p.model}, "lensIndex" = ${p.lensIndex}, "unitType" = 'PAR',
                "sphereMin" = ${p.sphereMin}, "sphereMax" = ${p.sphereMax},
                "cylinderMin" = ${p.cylinderMin}, "cylinderMax" = ${p.cylinderMax},
                "additionMin" = ${p.additionMin}, "additionMax" = ${p.additionMax},
                "updatedAt" = now()
            where id = ${p.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${p.id},
                ${JSON.stringify({ completadaFicha: p.nombre, brand: p.brand, model: p.model, lensIndex: p.lensIndex })}::jsonb, now())`;
    }
    console.log(`\n✅ ${aCrear.length} creado(s) · ${aCompletar.length} completado(s).`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());

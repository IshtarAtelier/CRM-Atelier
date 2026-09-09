/**
 * SUBE los tratamientos sueltos que están en las listas de los laboratorios y
 * NO existían en el sistema, y corrige el costo del Teñido Compacto.
 *
 * Ishtar, 9/9/2026: "subí el multifacetado a tratamientos … evaluá si hay algún
 * tratamiento más, como Crizales de Optovisión para subir, y Numaxx de
 * Optovisión · fijate que estén todos · corregí el costo de compacto también ·
 * recordá que nada esté por debajo de 2.5".
 *
 * DE DÓNDE SALE CADA COSTO:
 *
 * · GRUPO ÓPTICO — hoja "Recargos Laboratorio" de la lista de agosto. NO llevan
 *   IVA (Grupo Óptico no factura IVA, verificado contra 377 facturas) y NO
 *   llevan calibrado: son recargos que se cobran ENCIMA de un cristal que ya
 *   paga el suyo, sumárselo otra vez sería cobrarlo dos veces.
 *
 * · OPTOVISIÓN — página 22 (Crizal RX suelto) y la hoja de antirreflejos
 *   propios. La lista de Optovisión es SIN IVA, así que el costo lleva el 21%.
 *   Tampoco calibrado, por lo mismo. Los valores son POR PAR.
 *
 * MARKUP ×2,5: es el de los tratamientos que ya estaban cargados (Laca, UV 400,
 * Filtros especiales, AR Element, AR Ultra Layer, todos en ×2,50 clavado) y es
 * el piso que pidió Ishtar. Nada queda por debajo.
 *
 * EL TEÑIDO COMPACTO tenía costo $1: un error de tipeo del día que se cargó
 * (AuditLog, 11/8/2026 19:49, `{"cost": 1}`). Se le pone el costo de sus
 * hermanos y se le sube el precio para que no quede bajo ×2,5.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/tratamientos/subir-tratamientos-faltantes.mjs
 *   node scripts/maintenance/tratamientos/subir-tratamientos-faltantes.mjs --produccion
 *   node scripts/maintenance/tratamientos/subir-tratamientos-faltantes.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const MARKUP = 2.5;
const IVA_OPTOVISION = 1.21;
const FIRMA = 'Ishtar (tratamientos de las listas de laboratorio)';

/** pelado = lo que factura el lab; costo = con IVA si ese lab lo cobra. */
const TRATAMIENTOS = [
    // GRUPO ÓPTICO · Recargos Laboratorio (sin IVA)
    { nombre: 'Multifacetado / Lenticular — lentes digitales', modelo: 'Recargo de laboratorio',
      lab: 'GRUPO OPTICO', marca: 'Smart', pelado: 31577, iva: 1 },
    { nombre: 'Biconvexo', modelo: 'Recargo de laboratorio',
      lab: 'GRUPO OPTICO', marca: 'Smart', pelado: 16207, iva: 1 },
    { nombre: 'Prisma — POR GRADO', modelo: 'Recargo de laboratorio · se cobra por cada grado de prisma',
      lab: 'GRUPO OPTICO', marca: 'Smart', pelado: 4178, iva: 1 },

    // OPTOVISIÓN · Crizal RX suelto (lista sin IVA)
    { nombre: 'Crizal Prevencia — antirreflejo RX', modelo: 'Antirreflejo Essilor sobre lente a medida',
      lab: 'OPTOVISION', marca: 'Essilor', pelado: 95680, iva: IVA_OPTOVISION },
    { nombre: 'Crizal Sapphire — antirreflejo RX', modelo: 'Antirreflejo Essilor sobre lente a medida',
      lab: 'OPTOVISION', marca: 'Essilor', pelado: 93375, iva: IVA_OPTOVISION },
    { nombre: 'Crizal Forte UV — antirreflejo RX', modelo: 'Antirreflejo Essilor sobre lente a medida',
      lab: 'OPTOVISION', marca: 'Essilor', pelado: 90630, iva: IVA_OPTOVISION },

    // OPTOVISIÓN · antirreflejos propios
    { nombre: 'Antirreflejo Numax', modelo: '8 capas por cara, super hidrofobico',
      lab: 'OPTOVISION', marca: 'Optovision', pelado: 72240, iva: IVA_OPTOVISION },
    { nombre: 'Antirreflejo Multicot', modelo: 'CR39 / Poli / Trivex - 6 capas por cara, hidrofobico',
      lab: 'OPTOVISION', marca: 'Optovision', pelado: 57588, iva: IVA_OPTOVISION },
];

const pesos = n => n == null ? '—' : `$${Math.round(Number(n)).toLocaleString('es-AR')}`;

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!url) { console.error(`Falta ${PRODUCCION ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`); process.exitCode = 1; return; }
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
        console.error('DATABASE_URL no apunta a localhost. Para tocar produccion hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`Base: ${PRODUCCION ? 'PRODUCCION' : 'LOCAL'} | modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}`);
        console.log(`Markup x${MARKUP} - el piso que pidio Ishtar y el que ya tenian los tratamientos cargados\n`);

        const existentes = await prisma.$queryRaw`
            select id, name, cost, price from "Product" where category = 'Tratamiento'`;
        const clave = n => n.toLowerCase().split('—')[0].trim().slice(0, 18);
        const yaEsta = n => existentes.find(e => String(e.name).toLowerCase().includes(clave(n)));

        const nuevos = [], repetidos = [];
        for (const t of TRATAMIENTOS) {
            const costo = Math.round(t.pelado * t.iva);
            const fila = { ...t, costo, precio: Math.round(costo * MARKUP) };
            (yaEsta(t.nombre) ? repetidos : nuevos).push(fila);
        }

        console.log(`A CARGAR: ${nuevos.length} | ya existian: ${repetidos.length}\n`);
        console.log(`  ${'Tratamiento'.padEnd(46)}${'Lab'.padEnd(15)}${'pelado'.padStart(11)}${'costo'.padStart(11)}${'precio'.padStart(12)}`);
        for (const n of nuevos) {
            console.log(`  ${n.nombre.slice(0, 44).padEnd(46)}${n.lab.padEnd(15)}${pesos(n.pelado).padStart(11)}${pesos(n.costo).padStart(11)}${pesos(n.precio).padStart(12)}`);
        }
        if (repetidos.length) {
            console.log(`\n  Ya estaban (no se duplican):`);
            repetidos.forEach(r => console.log(`    ${r.nombre}`));
        }

        const compacto = existentes.find(e => /te.?ido compacto/i.test(e.name));
        const hermanos = existentes.filter(e => /te.?ido/i.test(e.name) && !/compacto/i.test(e.name) && Number(e.cost) > 100);
        const costoCompacto = hermanos.length ? Math.round(Math.min(...hermanos.map(h => Number(h.cost)))) : null;
        let arreglo = null;
        if (compacto && costoCompacto && Number(compacto.cost) < 100) {
            const precio = Math.max(Math.round(Number(compacto.price)), Math.round(costoCompacto * MARKUP));
            arreglo = { ...compacto, costoNuevo: costoCompacto, precioNuevo: precio };
            console.log(`\n  TENIDO COMPACTO - costo ${pesos(compacto.cost)} -> ${pesos(costoCompacto)} (el de sus hermanos)`);
            console.log(`                    precio ${pesos(compacto.price)} -> ${pesos(precio)}  ` +
                `(a ${pesos(compacto.price)} quedaba en x${(Number(compacto.price) / costoCompacto).toFixed(2)}, por debajo de x${MARKUP})`);
        }

        if (!APLICAR) { console.log('\nEnsayo: no se escribio nada. Para aplicarlo: --aplicar'); return; }

        for (const n of nuevos) {
            const id = await prisma.$queryRaw`
                insert into "Product" (id, name, category, type, brand, model, stock, "unitType",
                    laboratory, price, cost, "baseCost", origin, "publishToWeb", "publishToWholesale",
                    "wholesalePrice", "ageGroup", "customSlug", gender, mpn, "seoDescription",
                    "seoTags", "seoTitle", "imageProcessingStatus", "createdAt", "updatedAt")
                values (gen_random_uuid()::text, ${n.nombre}, 'Tratamiento', 'Tratamiento Tratamientos',
                    ${n.marca}, ${n.modelo}, 0, 'UNIDAD', ${n.lab}, ${n.precio}, ${n.costo}, ${n.pelado},
                    'LABORATORIO', false, false, 0, '', '', '', '', '', '', '', 'IDLE', now(), now())
                returning id`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'CREATE', 'PRODUCT', ${id[0].id},
                    ${JSON.stringify({ producto: n.nombre, laboratorio: n.lab, pelado: n.pelado,
                        costo: n.costo, precio: n.precio, markup: MARKUP })}::jsonb, now())`;
        }
        if (arreglo) {
            await prisma.$executeRaw`
                update "Product" set cost = ${arreglo.costoNuevo}, price = ${arreglo.precioNuevo}, "updatedAt" = now()
                where id = ${arreglo.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${arreglo.id},
                    ${JSON.stringify({ producto: arreglo.name, motivo: 'el costo estaba en $1 por un error de carga del 11/8/2026',
                        costoDe: Number(arreglo.cost), costoA: arreglo.costoNuevo,
                        precioDe: Number(arreglo.price), precioA: arreglo.precioNuevo })}::jsonb, now())`;
        }
        console.log(`\nLISTO: ${nuevos.length} tratamiento(s) cargados${arreglo ? ' + el Tenido Compacto corregido' : ''}.`);
    } finally { await prisma.$disconnect(); }
}

main().catch(e => { console.error(e); process.exitCode = 1; });

/**
 * ORDENA TODOS LOS TRATAMIENTOS por laboratorio: cada uno con su lab en el
 * nombre, su costo salido de la lista de ese lab, y los que faltaban cargados.
 *
 * Ishtar, 9/9/2026: "cada laboratorio tiene sus tratamientos, ordená todos los
 * tratamientos incluido multifacetados … auditá de qué laboratorio son,
 * investigá en las listas, y cargá de ser necesarias diferentes · subí todo".
 *
 * EL PROBLEMA: los 8 tratamientos que ya estaban cargados no tenían
 * laboratorio, y sus costos eran redondeos viejos ($13.000, $15.000) que no
 * salían de ninguna lista. Son TODOS de Grupo Óptico —están en la página 9 de
 * su lista, "TRATAMIENTOS / SERVICIOS"— y Optovisión tiene los SUYOS, distintos
 * y más caros (página 28). Un "Teñido Degradé" sin laboratorio es ambiguo:
 * cuesta $10.577 en Grupo Óptico y $16.564 en Optovisión.
 *
 * POR ESO cada tratamiento lleva el laboratorio EN EL NOMBRE. No es decoración:
 * es lo que evita que el vendedor cotice el precio del lab equivocado.
 *
 * LAS FÓRMULAS, distintas por laboratorio:
 *   · GRUPO ÓPTICO — el precio de lista, tal cual. NO lleva IVA.
 *   · OPTOVISIÓN  — el precio de lista × 1,21. Esa lista es SIN IVA.
 * Ninguno lleva calibrado: son cargos que se cobran ENCIMA de un cristal que ya
 * paga el suyo, sumárselo otra vez sería cobrarlo dos veces.
 *
 * MARKUP ×2,5, el piso que pidió Ishtar y el que ya tenían los cargados. A los
 * que ya existían NO se les baja el precio: si con el costo nuevo quedan por
 * encima de ×2,5, se respeta el precio que tienen.
 *
 * LAS COLORACIONES DE SOLARES de Optovisión vienen en dos curvas, base 6 y base
 * 8. Se carga UNA sola con el precio de la base 8 (el más caro), por la misma
 * regla del calibrado: la curva se sabe cuando se arma el anteojo, no cuando se
 * cotiza, y tomar el mayor hace que el costo nunca quede corto.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/tratamientos/ordenar-tratamientos-por-laboratorio.mjs --produccion
 *   node scripts/maintenance/tratamientos/ordenar-tratamientos-por-laboratorio.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const MARKUP = 2.5;
const FIRMA = 'Ishtar (tratamientos ordenados por laboratorio)';

const GO = { lab: 'GRUPO OPTICO', sufijo: ' · Grupo Óptico', iva: 1, marca: 'Smart' };
const OV = { lab: 'OPTOVISION', sufijo: ' · Optovisión', iva: 1.21, marca: 'Optovision' };

/**
 * Todos los tratamientos de las dos listas. `pelado` es el número tal cual está
 * impreso; `costo` se calcula con el IVA del laboratorio.
 * `busca` es el texto con el que se reconoce el producto YA CARGADO (para
 * actualizarlo en vez de duplicarlo). Sin `busca`, es alta nueva.
 */
const CATALOGO = [
    // ══ GRUPO ÓPTICO · Tratamientos AR (pág. 9) ══
    { lab: GO, nombre: 'Antirreflejo Ultra Layer', pelado: 58690, busca: 'ultra layer',
      modelo: 'Antirreflejo Smart Lens · certificados en smartlens.com.ar' },
    { lab: GO, nombre: 'Antirreflejo Element — selectivo', pelado: 42440, busca: 'ar element',
      modelo: 'Antirreflejo selectivo Smart Lens' },

    // ══ GRUPO ÓPTICO · Recargos de laboratorio (pág. 4) ══
    { lab: GO, nombre: 'Multifacetado / Lenticular — lentes digitales', pelado: 31577, busca: 'multifacetado',
      modelo: 'Recargo de laboratorio sobre lente digital' },
    { lab: GO, nombre: 'Biconvexo', pelado: 16207, busca: 'biconvexo',
      modelo: 'Recargo de laboratorio' },
    { lab: GO, nombre: 'Prisma — POR GRADO', pelado: 4178, busca: 'prisma',
      modelo: 'Recargo de laboratorio · se cobra por CADA grado de prisma' },

    // ══ GRUPO ÓPTICO · Tratamientos, coloración y arreglos (pág. 9) ══
    { lab: GO, nombre: 'Laca Antirraya (Sping)', pelado: 12967, busca: 'laca antiraya',
      modelo: 'Endurecido antirrayas' },
    { lab: GO, nombre: 'Tratamiento UV 400', pelado: 12167, busca: 'uv 400', modelo: 'Filtro ultravioleta' },
    { lab: GO, nombre: 'Filtros especiales', pelado: 23539, busca: 'filtros especiales', modelo: 'Filtros especiales' },
    { lab: GO, nombre: 'Teñido Compacto', pelado: 9343, busca: 'teñido compacto',
      modelo: 'Color entero · el tono 4 no es recomendable para conducir', precioFijo: 30000 },
    { lab: GO, nombre: 'Teñido Degradé', pelado: 10577, busca: 'teñido degrade',
      modelo: 'Color degradé · el tono 4 no es recomendable para conducir' },
    { lab: GO, nombre: 'Teñido según muestra', pelado: 13666, busca: 'según muestra', modelo: 'Color copiado de una muestra' },
    { lab: GO, nombre: 'Sacar color', pelado: 9078, modelo: 'Quitar la coloración de la lente' },
    { lab: GO, nombre: 'Soldadura sin repuesto', pelado: 12306, modelo: 'Arreglo de armazón · demora 72 hs' },
    { lab: GO, nombre: 'Soldadura con repuesto (1)', pelado: 15769, modelo: 'Arreglo de armazón · demora 72 hs' },
    { lab: GO, nombre: 'Embutido con repuesto (1)', pelado: 8052, modelo: 'Arreglo de armazón · demora 72 hs' },
    { lab: GO, nombre: 'Cambio de plaquetas', pelado: 4926, modelo: 'Arreglo de armazón' },
    { lab: GO, nombre: 'Repuesto de una (1) patilla', pelado: 29550, modelo: 'Arreglo de armazón' },

    // ══ OPTOVISIÓN · Antirreflejos (pág. 28) ══
    { lab: OV, nombre: 'Antirreflejo Numax', pelado: 72240, busca: 'numax',
      modelo: '8 capas por cara · súper hidrofóbico' },
    { lab: OV, nombre: 'Antirreflejo Multicot', pelado: 57588, busca: 'multicot',
      modelo: 'CR39 / Poli / Trivex · 6 capas por cara · hidrofóbico' },

    // ══ OPTOVISIÓN · Crizal RX suelto (pág. 22) ══
    { lab: OV, nombre: 'Crizal Prevencia — antirreflejo RX', pelado: 95680, busca: 'crizal prevencia',
      marca: 'Essilor', modelo: 'Antirreflejo Essilor sobre lente a medida' },
    { lab: OV, nombre: 'Crizal Sapphire — antirreflejo RX', pelado: 93375, busca: 'crizal sapphire',
      marca: 'Essilor', modelo: 'Antirreflejo Essilor sobre lente a medida' },
    { lab: OV, nombre: 'Crizal Forte UV — antirreflejo RX', pelado: 90630, busca: 'crizal forte',
      marca: 'Essilor', modelo: 'Antirreflejo Essilor sobre lente a medida' },

    // ══ OPTOVISIÓN · Coloraciones orgánicas (pág. 28) ══
    { lab: OV, nombre: 'Coloración plena — hasta tinte 1', pelado: 11594, modelo: 'Color entero, tono suave' },
    { lab: OV, nombre: 'Coloración plena — más de tinte 1', pelado: 13886, modelo: 'Color entero, tono fuerte' },
    { lab: OV, nombre: 'Coloración degradé', pelado: 16564, modelo: 'Color degradé' },
    { lab: OV, nombre: 'Coloración doble color', pelado: 16564, modelo: 'Dos colores en la misma lente' },
    { lab: OV, nombre: 'Coloración según muestra', pelado: 21660, modelo: 'Color copiado de una muestra' },
    { lab: OV, nombre: 'Sacar color', pelado: 11466, modelo: 'Quitar la coloración de la lente' },
    { lab: OV, nombre: 'Filtros especiales (UVX, BLX, RT, Kiros, Lumior AB, Lumior B)', pelado: 26374,
      modelo: 'Filtros terapéuticos' },
    { lab: OV, nombre: 'Coloración Aquarelle', pelado: 16564, modelo: 'Coloración Aquarelle' },

    // ══ OPTOVISIÓN · Coloración de lentes solares (pág. 28) — precio de base 8 ══
    { lab: OV, nombre: 'Solares CR39 — color entero', pelado: 19238, modelo: 'Base 8 (en base 6 el lab cobra $15.161)' },
    { lab: OV, nombre: 'Solares CR39 — color degradé', pelado: 21150, modelo: 'Base 8 (en base 6 el lab cobra $17.710)' },
    { lab: OV, nombre: 'Solares policarbonato — color entero', pelado: 15671, modelo: 'Base 8 (en base 6 el lab cobra $13.250)' },
    { lab: OV, nombre: 'Solares policarbonato — color degradé', pelado: 17200, modelo: 'Base 8 (en base 6 el lab cobra $14.907)' },
    { lab: OV, nombre: 'TAC Polarizado', pelado: 24844, modelo: 'Base 8 (en base 6 el lab cobra $21.150)' },

    // ══ OPTOVISIÓN · Otros servicios y endurecido (pág. 28) ══
    { lab: OV, nombre: 'Tratamiento de bordes', pelado: 20766, modelo: 'Tratamiento de bordes' },
    { lab: OV, nombre: 'Sacar tratamiento de bordes', pelado: 22040, modelo: 'Quitar el tratamiento de bordes' },
    { lab: OV, nombre: 'Endurecido mineral', pelado: 33124, modelo: 'Endurecido para lentes minerales' },
    { lab: OV, nombre: 'Endurecido IRON — dipping en laca', pelado: 22170,
      modelo: 'Sistema dipping en ambas caras por inmersión en laca · lentes orgánicas' },
];

const pesos = n => n == null ? '—' : `$${Math.round(Number(n)).toLocaleString('es-AR')}`;
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

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

        const existentes = await prisma.$queryRaw`
            select id, name, cost, price, laboratory from "Product" where category = 'Tratamiento'`;

        const usados = new Set();
        const altas = [], cambios = [], sinTocar = [];
        for (const t of CATALOGO) {
            const costo = Math.round(t.pelado * t.lab.iva);
            const nombre = t.nombre + t.lab.sufijo;
            const marca = t.marca ?? t.lab.marca;
            const previo = t.busca
                ? existentes.find(e => !usados.has(e.id) && norm(e.name).includes(norm(t.busca)))
                : null;
            if (previo) usados.add(previo.id);

            // Nunca se baja un precio: si el que tiene ya supera el piso, se respeta.
            const piso = Math.round(costo * MARKUP);
            const precio = t.precioFijo ?? (previo ? Math.max(Math.round(Number(previo.price)), piso) : piso);

            const fila = { ...t, nombre, marca, costo, precio, previo };
            if (!previo) altas.push(fila);
            else if (Math.round(Number(previo.cost)) !== costo || Math.round(Number(previo.price)) !== precio
                     || previo.name !== nombre || previo.laboratory !== t.lab.lab) cambios.push(fila);
            else sinTocar.push(fila);
        }
        const huerfanos = existentes.filter(e => !usados.has(e.id));

        console.log(`ALTAS: ${altas.length} | ACTUALIZACIONES: ${cambios.length} | ya perfectos: ${sinTocar.length} | sin renglón en ninguna lista: ${huerfanos.length}\n`);

        console.log('── ALTAS ──');
        console.log(`  ${'Tratamiento'.padEnd(56)}${'pelado'.padStart(11)}${'costo'.padStart(11)}${'precio'.padStart(12)}`);
        for (const a of altas) console.log(`  ${a.nombre.slice(0, 54).padEnd(56)}${pesos(a.pelado).padStart(11)}${pesos(a.costo).padStart(11)}${pesos(a.precio).padStart(12)}`);

        console.log('\n── ACTUALIZACIONES ──');
        for (const c of cambios) {
            console.log(`  ${String(c.previo.name).slice(0, 44).padEnd(46)} -> ${c.nombre}`);
            console.log(`     costo ${pesos(c.previo.cost)} -> ${pesos(c.costo)}   |   precio ${pesos(c.previo.price)} -> ${pesos(c.precio)}   |   markup x${(c.precio / c.costo).toFixed(2)}`);
        }
        if (huerfanos.length) {
            console.log(`\n── SIN RENGLÓN EN NINGUNA LISTA (no se tocan, revisar a mano) ──`);
            huerfanos.forEach(h => console.log(`  ${String(h.name).slice(0, 50).padEnd(52)} costo ${pesos(h.cost)} precio ${pesos(h.price)}`));
        }

        const bajos = [...altas, ...cambios, ...sinTocar].filter(x => x.precio / x.costo < MARKUP);
        console.log(`\nPor debajo de x${MARKUP}: ${bajos.length}`);

        if (!APLICAR) { console.log('\nEnsayo: no se escribio nada. Para aplicarlo: --aplicar'); return; }

        for (const a of altas) {
            const r = await prisma.$queryRaw`
                insert into "Product" (id, name, category, type, brand, model, stock, "unitType",
                    laboratory, price, cost, "baseCost", origin, "publishToWeb", "publishToWholesale",
                    "wholesalePrice", "ageGroup", "customSlug", gender, mpn, "seoDescription",
                    "seoTags", "seoTitle", "imageProcessingStatus", "createdAt", "updatedAt")
                values (gen_random_uuid()::text, ${a.nombre}, 'Tratamiento', 'Tratamiento Tratamientos',
                    ${a.marca}, ${a.modelo}, 0, 'UNIDAD', ${a.lab.lab}, ${a.precio}, ${a.costo}, ${a.pelado},
                    'LABORATORIO', false, false, 0, '', '', '', '', '', '', '', 'IDLE', now(), now())
                returning id`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'CREATE', 'PRODUCT', ${r[0].id},
                    ${JSON.stringify({ producto: a.nombre, laboratorio: a.lab.lab, pelado: a.pelado, costo: a.costo, precio: a.precio })}::jsonb, now())`;
        }
        for (const c of cambios) {
            await prisma.$executeRaw`
                update "Product" set name = ${c.nombre}, laboratory = ${c.lab.lab}, brand = ${c.marca},
                    model = ${c.modelo}, cost = ${c.costo}, "baseCost" = ${c.pelado}, price = ${c.precio},
                    "updatedAt" = now()
                where id = ${c.previo.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${c.previo.id},
                    ${JSON.stringify({ nombreDe: c.previo.name, nombreA: c.nombre, laboratorio: c.lab.lab,
                        costoDe: Number(c.previo.cost), costoA: c.costo, precioDe: Number(c.previo.price), precioA: c.precio,
                        motivo: 'costo tomado de la lista del laboratorio; el lab va en el nombre porque cada uno tiene su propio precio' })}::jsonb, now())`;
        }
        console.log(`\nLISTO: ${altas.length} altas + ${cambios.length} actualizaciones.`);
    } finally { await prisma.$disconnect(); }
}

main().catch(e => { console.error(e); process.exitCode = 1; });

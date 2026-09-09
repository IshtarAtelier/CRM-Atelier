/**
 * SUBE los 54 renglones de las páginas 25, 26 y 27 de la lista de Optovisión.
 *
 * Ishtar, 9/9/2026: "auditá TODO, que no quede ningún dato sin subir".
 *
 * POR QUÉ NADIE LOS VIO: estas tres páginas no estaban en el sistema NI en la
 * transcripción del repo (`varilux-agosto-2026.json` cubre las páginas 5-18, 20,
 * 22, 23-24 y 27 parcial). No existían para ningún control, así que ningún
 * chequeo automático las podía marcar como faltantes. Son cosas que se venden:
 * los Cr 39 de laboratorio, los Flat Top, los Kriptock, el policarbonato
 * POLICAST y todo el stock de NUMAX y MULTICOT.
 *
 * VERIFICACIÓN: los 54 renglones se leyeron de las tres páginas renderizadas
 * como imagen, no del texto del PDF — extraer el texto DESORDENA estas tablas y
 * separa cada etiqueta de su precio, que es justo el error que haría cargar un
 * cristal con el precio de otro.
 *
 * FÓRMULA DE OPTOVISIÓN, verificada contra los 223 cristales ya cargados:
 *     costo = (pelado + $23.000 de calibrado) × 1,21
 * La lista de Optovisión es SIN IVA, por eso el 21%. Los precios son POR PAR.
 *
 * MARKUP ×2,50: es el de toda la línea de Optovisión (mediana ×2,50 en Varilux,
 * Sygnus, monofocales y ocupacionales) y el piso que pidió Ishtar.
 *
 * TODOS SON "SIN ANTIRREFLEJO": es el único precio que dan estas páginas, y va
 * en el nombre para que nadie los confunda con los que llevan Crizal o Numax
 * incluido. Los rangos R1 a R8 del stock salen de la tabla de referencias al pie
 * de la página 27.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/precios-optovision/subir-paginas-25-26-27.mjs --produccion
 *   node scripts/maintenance/precios-optovision/subir-paginas-25-26-27.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const CALIBRADO_OV = 23000;
const IVA_OV = 1.21;
const MARKUP = 2.5;
const FIRMA = 'Ishtar (páginas 25-26-27 de la lista de Optovisión)';

/** Los códigos de rango del pie de la página 27. esf = [min, max], cil = [min, max]. */
const R = {
    R1: { esf: [-4, 4],   cil: [-2, 2] },
    R2: { esf: [-6, 6],   cil: [-2, 2] },
    R3: { esf: [-2, 2],   cil: [-1, 1] },
    R4: { esf: [-8, -4],  cil: [-4, 2] },
    R5: { esf: [-4, 4],   cil: [-4, 4] },
    R6: { esf: [-8, 4],   cil: [-4, 4] },
    R7: { esf: [-6, 4],   cil: [-2, 2] },
    R8: { esf: [-10, 6],  cil: [-3, 3] },
};

const M = 'Cristal Monofocal', B = 'Cristal Bifocal', P = 'Cristal Multifocal';
const LAB = 'LABORATORIO', STK = 'STOCK';

/** pelado = el precio "Sin AR" de la lista. */
const FILAS = [
    // ══ Pág. 25 · PRO-LINE DIGITAL TDI (progresivas) · adiciones 0,75 a 3,50 ══
    { n: 'PRO-LINE DIGITAL TDI · Orma 1.50 — SIN ANTIRREFLEJO', i: '1.50', p: 150593, t: P, o: LAB, esf: [-10, 6], cil: [-6, 6], add: [0.75, 3.5] },
    { n: 'PRO-LINE DIGITAL TDI · Orma Blue UV 1.50 — SIN ANTIRREFLEJO', i: '1.50', p: 166646, t: P, o: LAB, esf: [-10, 6], cil: [-6, 6], add: [0.75, 3.5] },
    { n: 'PRO-LINE DIGITAL TDI · Orma Transitions GEN S 1.50 — SIN ANTIRREFLEJO', i: '1.50', p: 347815, t: P, o: LAB, esf: [-10, 6], cil: [-6, 6], add: [0.75, 3.5] },
    { n: 'PRO-LINE DIGITAL TDI · Orma Acclimates 1.50 — SIN ANTIRREFLEJO', i: '1.50', p: 247420, t: P, o: LAB, esf: [-10, 6], cil: [-6, 6], add: [0.75, 3.5] },
    { n: 'PRO-LINE DIGITAL TDI · Airwear 1.59 — SIN ANTIRREFLEJO', i: '1.59', p: 150593, t: P, o: LAB, esf: [-10, 6], cil: [-6, 6], add: [0.75, 3.5] },
    { n: 'PRO-LINE DIGITAL TDI · Airwear Blue UV 1.59 — SIN ANTIRREFLEJO', i: '1.59', p: 166646, t: P, o: LAB, esf: [-10, 6], cil: [-6, 6], add: [0.75, 3.5] },
    { n: 'PRO-LINE DIGITAL TDI · Airwear Transitions GEN S 1.59 — SIN ANTIRREFLEJO', i: '1.59', p: 398650, t: P, o: LAB, esf: [-10, 6], cil: [-6, 6], add: [0.75, 3.5] },
    { n: 'PRO-LINE DIGITAL TDI · Stylis 1.67 — SIN ANTIRREFLEJO', i: '1.67', p: 248312, t: P, o: LAB, esf: [-14, 9], cil: [-6, 6], add: [0.75, 3.5] },
    { n: 'PRO-LINE DIGITAL TDI · Stylis Blue UV 1.67 — SIN ANTIRREFLEJO', i: '1.67', p: 263601, t: P, o: LAB, esf: [-14, 9], cil: [-6, 6], add: [0.75, 3.5] },
    { n: 'PRO-LINE DIGITAL TDI · Stylis Transitions GEN S 1.67 — SIN ANTIRREFLEJO', i: '1.67', p: 436999, t: P, o: LAB, esf: [-14, 9], cil: [-6, 6], add: [0.75, 3.5] },
    // Pág. 25 · PRO-LINE · adiciones 1,00 a 3,00
    { n: 'PRO-LINE · Cr 39 Blanco 1.50 · calibrado estándar — SIN ANTIRREFLEJO', i: '1.50', p: 124220, t: P, o: LAB, esf: [-7, 7], cil: [-6, 6], add: [1, 3] },
    { n: 'PRO-LINE · Cr 39 Blanco 1.50 · calibrado ranurado o perforado — SIN ANTIRREFLEJO', i: '1.50', p: 137470, t: P, o: LAB, esf: [-7, 7], cil: [-6, 6], add: [1, 3] },
    { n: 'PRO-LINE · Cr 39 Blanco BLC 1.60 · calibrado estándar — SIN ANTIRREFLEJO', i: '1.60', p: 147662, t: P, o: LAB, esf: [-7, 7], cil: [-6, 6], add: [1, 3] },

    // ══ Pág. 26 · Monofocales orgánicas de laboratorio ══
    { n: 'Monofocal de laboratorio · Cr 39 Blanco 1.50 · Diám. 52 a 70 — SIN ANTIRREFLEJO', i: '1.50', p: 41407, t: M, o: LAB, esf: [-14, 13.5], cil: [-6, 6] },
    { n: 'Monofocal de laboratorio · Cr 39 Blanco 1.50 · Diám. mayor a 70 — SIN ANTIRREFLEJO', i: '1.50', p: 55803, t: M, o: LAB, esf: [-14, 7.75], cil: [-6, 6] },
    { n: 'Monofocal de laboratorio · Cr 39 Blanco 1.50 · Diám. menor a 52 — SIN ANTIRREFLEJO', i: '1.50', p: 55803, t: M, o: LAB, esf: [-14, 14], cil: [-6, 6] },
    { n: 'Monofocal de laboratorio · Cr 39 Blue Light Cut 1.56 — SIN ANTIRREFLEJO', i: '1.56', p: 79755, t: M, o: LAB, esf: [-15, 8.5], cil: [-6, 6] },
    { n: 'Monofocal de laboratorio · Fotosensible 1.56 — SIN ANTIRREFLEJO', i: '1.56', p: 106765, t: M, o: LAB, esf: [-12, 9], cil: [-6, 6] },
    { n: 'Monofocal de laboratorio · Fotosensible Espejado 1.56 — SIN ANTIRREFLEJO', i: '1.56', p: 168939, t: M, o: LAB, esf: [-15, 8.5], cil: [-6, 6] },
    { n: 'Monofocal de laboratorio · Fotosensible Blue Light Cut 1.56 — SIN ANTIRREFLEJO', i: '1.56', p: 131482, t: M, o: LAB, esf: [-15, 8.5], cil: [-6, 6] },
    { n: 'Monofocal de laboratorio · Alto Índice 1.74 + IRON — SIN ANTIRREFLEJO', i: '1.74', p: 298127, t: M, o: LAB, esf: [-21, 18], cil: [-6, 6] },
    { n: 'Monofocal de laboratorio · Antiage 1.60 — SIN ANTIRREFLEJO', i: '1.60', p: 155816, t: M, o: LAB, esf: [-15, 8.5], cil: [-6, 6] },
    { n: 'Monofocal de laboratorio · Cr 39 Polarizado Gris / Sepia 1.50 — SIN ANTIRREFLEJO', i: '1.50', p: 120780, t: M, o: LAB, esf: [-6.25, 7.5], cil: [-6, 6] },
    // Pág. 26 · Monofocales policarbonato de laboratorio
    { n: 'Monofocal de laboratorio · POLICAST Esférico 1.59 — SIN ANTIRREFLEJO', i: '1.59', p: 51344, t: M, o: LAB, esf: [-14.5, 10], cil: [-6, 6] },
    { n: 'Monofocal de laboratorio · POLICAST Fotocromático 1.59 — SIN ANTIRREFLEJO', i: '1.59', p: 203466, t: M, o: LAB, esf: [-14.5, 9], cil: [-6, 6] },
    { n: 'Monofocal de laboratorio · POLICAST Polarizado Espejado Plata / Azul 1.59 — SIN ANTIRREFLEJO', i: '1.59', p: 265384, t: M, o: LAB, esf: [-7, 6], cil: [-6, 6] },
    { n: 'Monofocal de laboratorio · POLICAST Blue Light Cut 1.59 — SIN ANTIRREFLEJO', i: '1.59', p: 93006, t: M, o: LAB, esf: [-12, 10], cil: [-6, 6] },
    // Pág. 26 · Bifocales orgánicas, película 28 mm
    { n: 'Bifocal Flat Top · Transitions Signature GEN8 Gris 1.50 — SIN ANTIRREFLEJO', i: '1.50', p: 308730, t: B, o: LAB, esf: [-6, 5.75], cil: [-6, 6], add: [1, 3] },
    { n: 'Bifocal Flat Top · Fotosensible 1.50 — SIN ANTIRREFLEJO', i: '1.50', p: 150083, t: B, o: LAB, esf: [-5, 6.25], cil: [-6, 6], add: [1, 3] },
    { n: 'Bifocal Flat Top · Blanco 1.50 — SIN ANTIRREFLEJO', i: '1.50', p: 49688, t: B, o: LAB, esf: [-8, 5.5], cil: [-6, 6], add: [1, 3.5] },
    { n: 'Bifocal Flat Top · Blue Light Cut 1.50 — SIN ANTIRREFLEJO', i: '1.50', p: 115684, t: B, o: LAB, esf: [-6.5, 6.5], cil: [-6, 6], add: [1, 3] },
    { n: 'Bifocal Kriptock · Blanco 1.50 — SIN ANTIRREFLEJO', i: '1.50', p: 49815, t: B, o: LAB, esf: [-8, 5.5], cil: [-6, 6], add: [1, 3] },
    // Pág. 26 · Bifocales policarbonato
    { n: 'Bifocal Flat Top · Policarbonato Blanco 1.59 — SIN ANTIRREFLEJO', i: '1.59', p: 98739, t: B, o: LAB, esf: [-8, 7.25], cil: [-6, 6], add: [1, 3] },
    { n: 'Bifocal Flat Top · Policarbonato LIFE RX Fotocromático 1.59 — SIN ANTIRREFLEJO', i: '1.59', p: 312906, t: B, o: LAB, esf: [-12, 7], cil: [-6, 6], add: [1, 3] },

    // ══ Pág. 27 · Lentes de stock ══
    { n: 'Stock Optovisión · HD Super HMC Asférico BLC UV420 1.61', i: '1.61', p: 38339, t: M, o: STK, r: 'R7' },
    { n: 'Stock Optovisión · HD Super HMC Asférico BLC UV420 1.61 · Rango Extendido', i: '1.61', p: 50255, t: M, o: STK, r: 'R8' },
    { n: 'Stock Optovisión · Cr 39 1.50', i: '1.50', p: 4441, t: M, o: STK, r: 'R2' },
    { n: 'Stock Optovisión · Cr 39 1.50 · Rango Extendido', i: '1.50', p: 16752, t: M, o: STK, r: 'R6' },
    { n: 'Stock Optovisión · Cr 39 Fotocromático con MULTICOT 1.50', i: '1.50', p: 25841, t: M, o: STK, r: 'R1' },
    { n: 'Stock Optovisión · Cr 39 Fotocromático con MULTICOT 1.50 · Rango Extendido', i: '1.50', p: 55595, t: M, o: STK, r: 'R5' },
    { n: 'Stock Optovisión · NUMAX 1.50', i: '1.50', p: 44002, t: M, o: STK, r: 'R1' },
    { n: 'Stock Optovisión · NUMAX 1.50 · Rango Extendido', i: '1.50', p: 55681, t: M, o: STK, r: 'R6' },
    { n: 'Stock Optovisión · MULTICOT MAX 1.50', i: '1.50', p: 8560, t: M, o: STK, r: 'R2' },
    { n: 'Stock Optovisión · MULTICOT MAX 1.50 · Rango Extendido', i: '1.50', p: 18190, t: M, o: STK, r: 'R6' },
    { n: 'Stock Optovisión · Policarbonato Blanco 1.59', i: '1.59', p: 13567, t: M, o: STK, r: 'R1' },
    { n: 'Stock Optovisión · Policarbonato Blanco con MULTICOT 1.59', i: '1.59', p: 20046, t: M, o: STK, r: 'R2' },
    { n: 'Stock Optovisión · Policarbonato Fotocromático con NUMAX 1.59', i: '1.59', p: 156543, t: M, o: STK, r: 'R3' },
    { n: 'Stock Optovisión · Policarbonato Blue Cut con NUMAX 1.59', i: '1.59', p: 80218, t: M, o: STK, r: 'R1' },
    { n: 'Stock Optovisión · BLC HMC 1.56', i: '1.56', p: 11342, t: M, o: STK, r: 'R2' },
    { n: 'Stock Optovisión · BLC HMC 1.56 · Rango Extendido', i: '1.56', p: 23701, t: M, o: STK, r: 'R4' },
    { n: 'Stock Optovisión · BLC HMC Fotosensible 1.56', i: '1.56', p: 76089, t: M, o: STK, r: 'R1' },
    { n: 'Stock Optovisión · Antiage HD 1.60', i: '1.60', p: 107232, t: M, o: STK, r: 'R1' },
    { n: 'Stock Optovisión · Antiage HD 1.60 · Rango Extendido', i: '1.60', p: 136960, t: M, o: STK, r: 'R5' },
    { n: 'Stock Optovisión · Cr 39 IRON 1.50 (endurecido, sistema dipping)', i: '1.50', p: 18757, t: M, o: STK, r: 'R2' },
];

const pesos = n => `$${Math.round(Number(n)).toLocaleString('es-AR')}`;
const costoOV = pelado => Math.round((pelado + CALIBRADO_OV) * IVA_OV);
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
        console.log(`Base: ${PRODUCCION ? 'PRODUCCION' : 'LOCAL'} | modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}`);
        console.log(`Formula: (pelado + ${pesos(CALIBRADO_OV)}) x ${IVA_OV} | markup x${MARKUP}\n`);

        const ya = await prisma.$queryRaw`select id, name, "baseCost", laboratory from "Product"`;
        const nombres = new Set(ya.map(x => norm(x.name)));
        const peladosOV = new Set(ya.filter(x => x.laboratory === 'OPTOVISION' && x.baseCost != null)
            .map(x => Math.round(Number(x.baseCost))));

        const altas = [], omitidos = [];
        for (const f of FILAS) {
            const rango = f.r ? R[f.r] : { esf: f.esf, cil: f.cil };
            if (nombres.has(norm(f.n))) { omitidos.push({ ...f, motivo: 'ya existe un producto con ese nombre' }); continue; }
            if (peladosOV.has(f.p)) { omitidos.push({ ...f, motivo: `ya hay un cristal de Optovision con el pelado ${pesos(f.p)}` }); continue; }
            const costo = costoOV(f.p);
            altas.push({ ...f, ...rango, costo, precio: Math.round(costo * MARKUP) });
            nombres.add(norm(f.n));
        }

        console.log(`${FILAS.length} renglones de la lista | ${altas.length} a cargar | ${omitidos.length} omitidos\n`);
        console.log(`  ${'Cristal'.padEnd(74)}${'pelado'.padStart(11)}${'costo'.padStart(11)}${'precio'.padStart(12)}  rango`);
        for (const a of altas) {
            console.log(`  ${a.n.slice(0, 72).padEnd(74)}${pesos(a.p).padStart(11)}${pesos(a.costo).padStart(11)}${pesos(a.precio).padStart(12)}` +
                `  esf ${a.esf[0]}/${a.esf[1]} cil ${a.cil[0]}/${a.cil[1]}${a.add ? ` add ${a.add[0]}/${a.add[1]}` : ''}`);
        }
        if (omitidos.length) {
            console.log('\n  NO se cargan:');
            omitidos.forEach(o => console.log(`    ${o.n.slice(0, 66).padEnd(68)} ${o.motivo}`));
        }

        if (!APLICAR) { console.log('\nEnsayo: no se escribio nada. Para aplicarlo: --aplicar'); return; }

        for (const a of altas) {
            const r0 = await prisma.$queryRaw`
                insert into "Product" (id, name, category, type, brand, model, stock, "unitType",
                    laboratory, price, cost, "baseCost", "lensIndex", origin,
                    "sphereMin", "sphereMax", "cylinderMin", "cylinderMax", "additionMin", "additionMax",
                    "publishToWeb", "publishToWholesale", "wholesalePrice", "ageGroup", "customSlug",
                    gender, mpn, "seoDescription", "seoTags", "seoTitle", "imageProcessingStatus",
                    "createdAt", "updatedAt")
                values (gen_random_uuid()::text, ${a.n}, 'Cristal', ${a.t}, 'Optovision',
                    ${'Lista Optovisión agosto 2026 · precio sin antirreflejo'},
                    0, 'UNIDAD', 'OPTOVISION', ${a.precio}, ${a.costo}, ${a.p}, ${a.i}, ${a.o},
                    ${a.esf[0]}, ${a.esf[1]}, ${a.cil[0]}, ${a.cil[1]}, ${a.add?.[0] ?? null}, ${a.add?.[1] ?? null},
                    false, false, 0, '', '', '', '', '', '', '', 'IDLE', now(), now())
                returning id`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'CREATE', 'PRODUCT', ${r0[0].id},
                    ${JSON.stringify({ producto: a.n, pelado: a.p, costo: a.costo, precio: a.precio,
                        markup: MARKUP, calibrado: CALIBRADO_OV, iva: '21%' })}::jsonb, now())`;
        }
        console.log(`\nLISTO: ${altas.length} cristal(es) cargados.`);
    } finally { await prisma.$disconnect(); }
}

main().catch(e => { console.error(e); process.exitCode = 1; });

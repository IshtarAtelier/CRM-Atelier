// ────────────────────────────────────────────────────────────────────────────
// COSTO DESDE EL PELADO: se calcula UNA sola vez, al guardar.
//
// Regla pedida por la administradora el 26/8/2026: al cargar un cristal con el
// costo PELADO (baseCost, tal cual la lista del laboratorio) y sin costo final,
// el sistema calcula solo `cost = (pelado + calibrado) × (1 + IVA)` — una vez,
// al guardar. Nunca al leer, nunca en ediciones que no traen baseCost.
//
// Lo que NO puede pasar (cada punto fue un bug real o casi):
//  · recalcular sobre un cost que ya tenía la fórmula (duplicación);
//  · pisar un cost explícito que el formulario mandó calculado;
//  · aplicar calibrado a un tratamiento;
//  · duplicar el calibrado en los 2x1 (el cost es de UN par);
//  · inventar un cost cuando el laboratorio no tiene config.
//
// Corre contra la base LOCAL. Crea y borra sus propios datos.
// Correr:  npm run check:costo-pelado
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { ProductService } from '../../src/services/product.service.ts';

const prisma = new PrismaClient();
const LAB = `TEST LAB PELADO ${Date.now()}`;
const CAL = 20000, IVA = 21;
const final = b => Math.round((b + CAL) * (1 + IVA / 100));
const creados = [];
let labId = null;
let fallas = 0;

const ok = (desc, cond) => {
    console.log(`  ${cond ? '✅' : '❌'} ${desc}`);
    if (!cond) fallas++;
};

try {
    labId = (await prisma.laboratoryConfig.create({
        data: { name: LAB, calibrado: CAL, iva: IVA },
    })).id;

    // ── 1. Pelado sin cost → el sistema calcula ─────────────────────────
    const a = await ProductService.create({
        name: 'TEST pelado sin cost', category: 'Cristal', laboratory: LAB,
        price: 100000, baseCost: 100000,
    });
    creados.push(a.id);
    ok(`cargar pelado $100.000 sin cost → cost = ${final(100000).toLocaleString('es-AR')} (con calibrado e IVA)`,
        a.cost === final(100000) && a.baseCost === 100000);

    // ── 2. Cost explícito → se respeta ──────────────────────────────────
    const b = await ProductService.create({
        name: 'TEST cost explícito', category: 'Cristal', laboratory: LAB,
        price: 100000, baseCost: 100000, cost: 155555,
    });
    creados.push(b.id);
    ok('si el formulario manda el cost calculado, no se pisa', b.cost === 155555);

    // ── 3. Edición sin baseCost → cost intacto ("una sola vez") ─────────
    await ProductService.update(a.id, { name: 'TEST pelado renombrado' });
    const a2 = await prisma.product.findUnique({ where: { id: a.id }, select: { cost: true } });
    ok('editar otra cosa (el nombre) NO recalcula el cost', a2.cost === final(100000));

    // ── 4. Pelado nuevo en la edición → recalcula una vez ───────────────
    await ProductService.update(a.id, { baseCost: 120000 });
    const a3 = await prisma.product.findUnique({ where: { id: a.id }, select: { cost: true, baseCost: true } });
    ok(`subir un pelado nuevo ($120.000) recalcula el cost → ${final(120000).toLocaleString('es-AR')}`,
        a3.cost === final(120000) && a3.baseCost === 120000);

    // ── 4b. Reenviar el MISMO pelado no pisa un cost cargado a mano ─────
    // Un cost puesto desde una factura real viene con los descuentos del lab,
    // deliberadamente abajo de la lista. Si reenviar el baseCost guardado (lo
    // que hace cualquier edición) recalculara, ese cost se perdería en silencio.
    await prisma.product.update({ where: { id: a.id }, data: { cost: 111_111 } });
    await ProductService.update(a.id, { baseCost: 120000 });
    const a4 = await prisma.product.findUnique({ where: { id: a.id }, select: { cost: true } });
    ok('reenviar el MISMO pelado no pisa un cost cargado de factura', a4.cost === 111_111);

    // ── 4c. Un baseCost con formato es-AR ("83.400") no calcula nada ────
    let tiroFormato = false;
    await ProductService.create({
        name: 'TEST pelado formateado', category: 'Cristal', laboratory: LAB,
        price: 100000, baseCost: '83.400',
    }).then(p => { creados.push(p.id); }).catch(() => { tiroFormato = true; });
    ok('un pelado "83.400" (formato ambiguo) NO calcula: exige el cost explícito', tiroFormato);

    // ── 5. Tratamiento → sin calibrado ──────────────────────────────────
    const c = await ProductService.create({
        name: 'TEST tratamiento', category: 'Tratamiento', laboratory: LAB,
        price: 50000, baseCost: 50000,
    });
    creados.push(c.id);
    ok(`un tratamiento no lleva calibrado → cost = ${Math.round(50000 * 1.21).toLocaleString('es-AR')}`,
        c.cost === Math.round(50000 * 1.21));

    // ── 6. 2x1 → calibrado SIMPLE (el cost es de un par) ────────────────
    const d = await ProductService.create({
        name: 'TEST cristal 2x1', category: 'Cristal', laboratory: LAB,
        price: 100000, baseCost: 100000, is2x1: true,
    });
    creados.push(d.id);
    ok('un 2x1 NO duplica el calibrado en el cost del producto', d.cost === final(100000));

    // ── 7. Lab sin config → no se inventa nada ──────────────────────────
    let tiro = false;
    await ProductService.create({
        name: 'TEST lab desconocido', category: 'Cristal', laboratory: 'LAB QUE NO EXISTE',
        price: 100000, baseCost: 100000,
    }).catch(() => { tiro = true; });
    ok('sin config del laboratorio no se inventa un cost (exige cargarlo)', tiro);

    // ── 8. Un armazón con baseCost no entra en la fórmula ───────────────
    const e = await ProductService.create({
        name: 'TEST armazón', category: 'Armazón', laboratory: LAB,
        price: 100000, baseCost: 40000, cost: 45000,
    });
    creados.push(e.id);
    ok('a un armazón no se le aplica la fórmula de cristales', e.cost === 45000);

} finally {
    await prisma.product.deleteMany({ where: { id: { in: creados } } }).catch(() => { });
    if (labId) await prisma.laboratoryConfig.delete({ where: { id: labId } }).catch(() => { });
    await prisma.$disconnect();
}

console.log(fallas === 0
    ? '\n✅ El pelado calcula el costo final una sola vez, al guardar, y nada más.'
    : `\n❌ ${fallas} comprobación(es) fallaron.`);
process.exit(fallas === 0 ? 0 : 1);

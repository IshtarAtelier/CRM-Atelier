// ────────────────────────────────────────────────────────────────────────────
// CRIZAL OBLIGATORIO: nada con cristales Optovisión va a fábrica sin decir
// qué Crizal lleva.
//
// Política del 26/8/2026: el costo se calcula siempre con el Crizal más caro,
// y el que REALMENTE lleva el par es un dato de la venta — de elección
// obligatoria, como el tono de un teñido. Reglas que verifica:
//  · venta con cristal Optovisión sin labCrizal → NO pasa a fábrica;
//  · con labCrizal elegido → esa objeción desaparece;
//  · en un 2x1, "sin antirreflejo" tampoco vale (la promo es siempre con Crizal);
//  · un armazón solo no exige nada;
//  · un código inventado se rechaza al guardarlo.
//
// Corre contra la base LOCAL. Crea y borra sus propios datos.
// Correr:  npm run check:crizal
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { OrderService } from '../../src/services/order.service.ts';

const prisma = new PrismaClient();
const creados = { orders: [], products: [], clients: [] };
let fallas = 0;
const ok = (desc, cond) => { console.log(`  ${cond ? '✅' : '❌'} ${desc}`); if (!cond) fallas++; };

/** Intenta mandar a fábrica y devuelve el mensaje de error (o '' si pasó). */
async function intentarEnviar(orderId, extra = {}) {
    try {
        await OrderService.updateOrder(orderId, { labStatus: 'SENT', ...extra }, null, 'TEST crizal');
        return '';
    } catch (e) {
        return String(e?.message || e);
    }
}

try {
    const usuario = await prisma.user.findFirst({ select: { id: true } });
    if (!usuario) { console.error('No hay ningún User en la base local — no se puede correr este check.'); process.exit(1); }
    const cliente = await prisma.client.create({
        data: { name: 'TEST crizal-obligatorio', phone: `test-crizal-${Date.now()}`, status: 'CLIENT' },
    });
    creados.clients.push(cliente.id);

    const cristal = await prisma.product.create({
        data: {
            name: 'TEST COMFORT MAX - ORMA + CRIZAL 2x1', category: 'Cristal',
            laboratory: 'OPTOVISION', price: 1_000_000, cost: 500_000,
        },
    });
    const armazon = await prisma.product.create({
        data: { name: 'TEST armazón crizal', category: 'Armazón', price: 150_000, cost: 50_000 },
    });
    creados.products.push(cristal.id, armazon.id);

    const nuevaVenta = async items => {
        const o = await prisma.order.create({
            data: {
                client: { connect: { id: cliente.id } }, user: { connect: { id: usuario.id } }, orderType: 'SALE', status: 'CONFIRMED',
                total: 1_000_000, labStatus: 'NONE',
                items: { create: items },
            },
        });
        creados.orders.push(o.id);
        return o;
    };

    // ── 1. Cristal Optovisión sin Crizal → el envío objeta el Crizal ─────
    const v1 = await nuevaVenta([
        { productId: cristal.id, price: 500_000, quantity: 1, eye: 'OD' },
        { productId: cristal.id, price: 500_000, quantity: 1, eye: 'OI' },
    ]);
    const e1 = await intentarEnviar(v1.id);
    ok('sin Crizal elegido, el envío a fábrica lo objeta', /crizal/i.test(e1));

    // ── 2. Con el Crizal elegido, esa objeción desaparece ───────────────
    await OrderService.updateOrder(v1.id, { labCrizal: 'CRIZAL_FORTE_UV' }, null, 'TEST crizal');
    const e2 = await intentarEnviar(v1.id);
    ok('con Crizal elegido, la objeción de Crizal desaparece', !/crizal/i.test(e2));

    // ── 3. En un 2x1 (par regalado a $0), "sin AR" no vale ──────────────
    const v2 = await nuevaVenta([
        { productId: cristal.id, price: 500_000, quantity: 1, eye: 'OD' },
        { productId: cristal.id, price: 0, quantity: 1, eye: 'OI' },
    ]);
    await OrderService.updateOrder(v2.id, { labCrizal: 'SIN_AR' }, null, 'TEST crizal');
    const e3 = await intentarEnviar(v2.id);
    ok('en un 2x1, "sin antirreflejo" no alcanza: exige Crizal de verdad', /2x1 siempre lleva crizal/i.test(e3));

    // ── 4. Un armazón solo no exige nada ────────────────────────────────
    const v3 = await nuevaVenta([{ productId: armazon.id, price: 150_000, quantity: 1 }]);
    const e4 = await intentarEnviar(v3.id);
    ok('una venta de armazón solo no pide Crizal', !/crizal/i.test(e4));

    // ── 5. Un código inventado se rechaza al guardarlo ──────────────────
    let rechazo = '';
    await OrderService.updateOrder(v1.id, { labCrizal: 'CRIZAL_TRUCHO' }, null, 'TEST crizal')
        .catch(e => { rechazo = String(e?.message || e); });
    ok('un código de Crizal inventado se rechaza con error claro', /desconocido/i.test(rechazo));

    // ── 6. Una vez en fábrica, el Crizal queda CONGELADO ────────────────
    await prisma.order.update({ where: { id: v1.id }, data: { labStatus: 'IN_PROGRESS', labSentAt: new Date() } });
    let congelado = '';
    await OrderService.updateOrder(v1.id, { labCrizal: 'CRIZAL_PREVENCIA' }, null, 'TEST crizal')
        .catch(e => { congelado = String(e?.message || e); });
    ok('con el pedido ya en fábrica, cambiar el Crizal exige reabrir la venta', /no se puede modificar/i.test(congelado));

} finally {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: creados.orders } } }).catch(() => { });
    await prisma.order.deleteMany({ where: { id: { in: creados.orders } } }).catch(() => { });
    await prisma.product.deleteMany({ where: { id: { in: creados.products } } }).catch(() => { });
    await prisma.client.deleteMany({ where: { id: { in: creados.clients } } }).catch(() => { });
    await prisma.$disconnect();
}

console.log(fallas === 0
    ? '\n✅ Nada con cristales Optovisión viaja a fábrica sin su Crizal informado.'
    : `\n❌ ${fallas} comprobación(es) fallaron.`);
process.exit(fallas === 0 ? 0 : 1);

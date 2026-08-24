// ────────────────────────────────────────────────────────────────────────────
// VENTAS: un aumento de catálogo NUNCA les toca el precio.
//
// El 24/8/26 se encontró que reabrir una VENTA (orderType='SALE', aunque esté
// desbloqueada) para corregir algo sin relación con el precio — un color, un
// dato — recalculaba los cristales contra el precio VIVO del catálogo al
// guardar. Si el catálogo subió después de cerrar la venta, el cliente
// terminaba debiendo más sin que nadie lo hubiera decidido para esa venta.
//
// Un PRESUPUESTO (orderType != 'SALE') sí tiene que seguir el catálogo — así
// funcionó siempre y es correcto: mientras no sea venta, refleja el precio
// vigente.
//
// La protección de la venta es por PRODUCTO, no ciega: si de verdad se
// cambia un cristal por otro, ESE cambio sí tiene que cobrar el precio nuevo
// — es una decisión explícita de quien edita, no una fuga del catálogo.
//
// Corre contra la base LOCAL. Crea y borra sus propios datos.
// Correr:  npm run check:venta-no-repricea
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { OrderService } from '../../src/services/order.service.ts';

const prisma = new PrismaClient();

const cliente = await prisma.client.create({
    data: { name: 'TEST venta-no-repricea', phone: `test-${Date.now()}`, status: 'CLIENT' },
});
const usuario = await prisma.user.findFirst({ select: { id: true } });
if (!usuario) { console.error('No hay ningún User en la base local — no se puede correr este check.'); process.exit(1); }

const producto = await prisma.product.create({
    data: {
        name: 'TEST Comfort Max 2x1', brand: 'Varilux', category: 'Cristal', type: 'Cristal Multifocal',
        price: 1_000_000, cost: 400_000, is2x1: true, unitType: 'PAR',
    },
});
const otroProducto = await prisma.product.create({
    data: {
        name: 'TEST Physio 2x1', brand: 'Varilux', category: 'Cristal', type: 'Cristal Multifocal',
        price: 1_500_000, cost: 600_000, is2x1: true, unitType: 'PAR',
    },
});

const crearOrden = (orderType) => prisma.order.create({
    data: {
        clientId: cliente.id, userId: usuario.id, orderType, status: 'PENDING',
        total: 1_000_000, subtotalWithMarkup: 1_000_000,
        // La venta se crea YA REABIERTA (isLocked: false): es el escenario real
        // que hay que proteger — un admin reabrió la venta para corregir algo
        // sin relación y la guarda. Si estuviera bloqueada, el server ni deja
        // tocar los ítems (otro guard, más arriba), así que probar eso acá no
        // ejercitaría el recálculo de precios.
        isLocked: orderType !== 'SALE',
        items: {
            create: [
                { productId: producto.id, price: 500_000, quantity: 1, eye: 'OD' },
                { productId: producto.id, price: 500_000, quantity: 1, eye: 'OI' },
            ],
        },
    },
    include: { items: true },
});

const guardarConItemsIntactos = async (orden) => {
    const items = orden.items.map(it => ({ productId: it.productId, price: it.price, quantity: it.quantity, eye: it.eye }));
    return OrderService.updateOrder(orden.id, { items, markup: 0, discountCash: 20 }, 'test', 'Test', 'ADMIN');
};

let fallas = 0;
const check = (nombre, cond, detalle) => {
    if (cond) { console.log(`  ✅ ${nombre}`); }
    else { fallas++; console.error(`  ❌ ${nombre}\n     ${detalle}`); }
};

try {
    const venta = await crearOrden('SALE');
    const presupuesto = await crearOrden('QUOTE');

    // Sube el catálogo DESPUÉS de crear las dos órdenes — el mismo escenario
    // real: precio vigente al momento de la venta, aumento después.
    await prisma.product.update({ where: { id: producto.id }, data: { price: 2_000_000 } });

    const ventaGuardada = await guardarConItemsIntactos(venta);
    check(
        'una VENTA reabierta NO se repricea al guardar (aunque el catálogo subió)',
        ventaGuardada.subtotalWithMarkup === 1_000_000,
        `subtotalWithMarkup quedó en ${ventaGuardada.subtotalWithMarkup}, esperado 1.000.000`,
    );

    const presupuestoGuardado = await guardarConItemsIntactos(presupuesto);
    check(
        'un PRESUPUESTO sí sigue el catálogo en vivo al guardar',
        presupuestoGuardado.subtotalWithMarkup === 2_000_000,
        `subtotalWithMarkup quedó en ${presupuestoGuardado.subtotalWithMarkup}, esperado 2.000.000 (precio nuevo)`,
    );

    // Cambiar el cristal por OTRO producto dentro de la venta: ahí sí tiene
    // que cobrar el precio del producto nuevo, no el viejo congelado.
    const ventaConCristalCambiado = await OrderService.updateOrder(
        venta.id,
        {
            items: [
                { productId: otroProducto.id, price: 750_000, quantity: 1, eye: 'OD' },
                { productId: otroProducto.id, price: 750_000, quantity: 1, eye: 'OI' },
            ],
            markup: 0, discountCash: 20,
        },
        'test', 'Test', 'ADMIN',
    );
    check(
        'si de verdad se cambia el cristal por otro, SÍ cobra el precio nuevo',
        ventaConCristalCambiado.subtotalWithMarkup === 1_500_000,
        `subtotalWithMarkup quedó en ${ventaConCristalCambiado.subtotalWithMarkup}, esperado 1.500.000 (precio del producto nuevo)`,
    );

    await prisma.order.delete({ where: { id: venta.id } });
    await prisma.order.delete({ where: { id: presupuesto.id } });
} finally {
    await prisma.product.delete({ where: { id: producto.id } }).catch(() => {});
    await prisma.product.delete({ where: { id: otroProducto.id } }).catch(() => {});
    await prisma.client.delete({ where: { id: cliente.id } }).catch(() => {});
    await prisma.$disconnect();
}

if (fallas > 0) {
    console.error(`\n❌ ${fallas} caso(s) roto(s).`);
    process.exit(1);
}
console.log('\n✅ Las ventas no se repricean con un aumento de catálogo; los presupuestos sí.');

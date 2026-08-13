// ────────────────────────────────────────────────────────────────────────────
// Venta blindada: una venta ENVIADA A FÁBRICA no se modifica por ningún camino.
//
// Nace de dos incidentes reales del 12/8/2026:
//   · se editó la receta de una venta ya enviada desde la ficha del cliente y
//     la venta cambió retroactivamente, sin rastro en ningún lado;
//   · la pestaña Ventas dejaba editar y GUARDAR las medidas del armazón de una
//     venta enviada.
// Este check dispara CADA vía de mutación contra una venta bloqueada y exige el
// rechazo. Si mañana alguien agrega un endpoint que escribe sin mirar el
// candado, esto lo delata.
//
// Corre contra la base LOCAL. Crea y borra sus propios datos.
// Correr:  npm run check:venta
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { OrderService } from '../../src/services/order.service.ts';
import { ContactService } from '../../src/services/contact.service.ts';

const prisma = new PrismaClient();
let passed = 0;
const check = (name, cond) => { assert.ok(cond, `FALLÓ: ${name}`); passed++; console.log(`  ✓ ${name}`); };

/** Corre `fn` y devuelve el mensaje de error, o null si NO lanzó. */
const rechaza = async (fn) => { try { await fn(); return null; } catch (e) { return e.message || String(e); } };

const MARCA = 'CHECK_VENTA_BLINDADA';
async function limpiar() {
    const cs = await prisma.client.findMany({ where: { name: MARCA }, select: { id: true } });
    for (const c of cs) {
        await prisma.orderItem.deleteMany({ where: { order: { clientId: c.id } } });
        await prisma.order.deleteMany({ where: { clientId: c.id } });
        await prisma.interaction.deleteMany({ where: { clientId: c.id } });
        await prisma.clientTask.deleteMany({ where: { clientId: c.id } });
        await prisma.prescription.deleteMany({ where: { clientId: c.id } });
        await prisma.client.delete({ where: { id: c.id } }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { email: { startsWith: 'check-venta-' } } });
}

console.log('\n— Venta blindada: nada se modifica después de enviar a fábrica —\n');
await limpiar();

// Actores propios del check (así no depende de qué usuarios haya en la base).
const vendedor = await prisma.user.create({
    data: { email: 'check-venta-vendedor@local', name: 'Vendedor', password: 'x', role: 'STAFF' },
});
const admin = await prisma.user.create({
    data: { email: 'check-venta-admin@local', name: 'Jefa', password: 'x', role: 'ADMIN' },
});

const cliente = await prisma.client.create({
    // Ficha completa: la conversión exige estos datos antes de mirar nada más.
    data: { name: MARCA, phone: '5490000000000', email: 'check-venta@ejemplo.local', dni: '00000000', address: 'Calle 1', birthDate: new Date('1990-01-01'), status: 'CLIENT' },
});
const receta = await prisma.prescription.create({
    data: { clientId: cliente.id, sphereOD: -1, sphereOI: -1, pd: 60, heightOD: 20, heightOI: 20, imageUrl: '/x.jpg' },
});
const venta = await prisma.order.create({
    data: {
        clientId: cliente.id, userId: vendedor.id,
        orderType: 'SALE', status: 'CONFIRMED', total: 100000, paid: 100000,
        isLocked: true, labStatus: 'SENT', labSentAt: new Date(),
        prescriptionId: receta.id, frameA: '52', frameB: '32', labFrameShape: 'CATEYE', labColor: 'Degrade Gris',
        // v1: lo que deja la conversión real al enviar a fábrica.
        prescriptionSnapshot: JSON.stringify({
            v: 1, frozenAt: new Date().toISOString(), frozenBy: 'Vendedor', rx: receta,
        }),
    },
});

// ── 1. Receta congelada ──────────────────────────────────────────────────────
const errRxStaff = await rechaza(() => ContactService.updatePrescription(receta.id, { sphereOD: -9 }, 'STAFF'));
check('receta de venta enviada: STAFF NO puede editarla', !!errRxStaff && /enviada a fábrica/i.test(errRxStaff));

const errRxAdmin = await rechaza(() => ContactService.updatePrescription(receta.id, { sphereOD: -9 }, 'ADMIN'));
check('receta de venta enviada: tampoco el ADMIN (su camino es REABRIR)', !!errRxAdmin);

const errDel = await rechaza(() => ContactService.deletePrescription(receta.id, 'ADMIN'));
check('receta de venta enviada: no se puede BORRAR', !!errDel);

const rxSinTocar = await prisma.prescription.findUnique({ where: { id: receta.id } });
check('la receta quedó intacta tras los intentos', rxSinTocar.sphereOD === -1);

// ── 2. Candado total del pedido ──────────────────────────────────────────────
const casos = [
    ['medidas del armazón', { frameA: '99' }],
    ['forma del armazón', { labFrameShape: 'REDONDO' }],
    ['teñido', { labColor: 'Verde total' }],
    ['receta asociada', { prescriptionId: 'otra-receta' }],
    ['total', { total: 1 }],
    ['origen del armazón', { frameSource: 'USUARIO' }],
];
for (const [etiqueta, patch] of casos) {
    const err = await rechaza(() => OrderService.updateOrder(venta.id, patch, vendedor.id, 'Vendedor', 'STAFF'));
    check(`venta enviada: rechaza cambiar ${etiqueta}`, !!err && /enviada a fábrica|bloqueada/i.test(err));
}
const errAdminEdit = await rechaza(() => OrderService.updateOrder(venta.id, { frameA: '77' }, admin.id, 'Jefa', 'ADMIN'));
check('venta enviada: ni el ADMIN edita sin reabrir', !!errAdminEdit);

// Lo que SÍ debe poder avanzar en una venta enviada
const errLab = await rechaza(() => OrderService.updateOrder(venta.id, { labOrderNumber: 'OP-123' }, vendedor.id, 'Vendedor', 'STAFF'));
check('venta enviada: el flujo de laboratorio SÍ avanza (nº de operación)', errLab === null);

// Reenviar el mismo valor sin cambios no debe romper (las pantallas reenvían todo)
const errIdem = await rechaza(() => OrderService.updateOrder(venta.id, { frameA: '52' }, vendedor.id, 'Vendedor', 'STAFF'));
check('venta enviada: reenviar un valor SIN cambios no rompe', errIdem === null);

// ── 3. Reapertura ────────────────────────────────────────────────────────────
const errStaffAbre = await rechaza(() => OrderService.updateOrder(venta.id, { isLocked: false, reopenReason: 'x' }, vendedor.id, 'Vendedor', 'STAFF'));
check('reapertura: un vendedor NO puede reabrir', !!errStaffAbre && /administrador/i.test(errStaffAbre));

const errSinMotivo = await rechaza(() => OrderService.updateOrder(venta.id, { isLocked: false }, admin.id, 'Jefa', 'ADMIN'));
check('reapertura: el ADMIN necesita MOTIVO', !!errSinMotivo && /motivo/i.test(errSinMotivo));

const errAbre = await rechaza(() => OrderService.updateOrder(venta.id, { isLocked: false, reopenReason: 'El cliente cambió el armazón' }, admin.id, 'Jefa', 'ADMIN'));
check('reapertura: el ADMIN con motivo SÍ reabre', errAbre === null);

const notaReapertura = await prisma.interaction.findFirst({
    where: { clientId: cliente.id, content: { startsWith: '🔓' } },
});
check('la reapertura quedó registrada en la ficha con su motivo',
    !!notaReapertura && notaReapertura.content.includes('El cliente cambió el armazón'));

// Reabierta: ahora sí se puede editar, y la receta se destraba
const errEditaAbierta = await rechaza(() => OrderService.updateOrder(venta.id, { frameA: '55' }, admin.id, 'Jefa', 'ADMIN'));
check('venta REABIERTA: ya se puede editar el pedido', errEditaAbierta === null);
const errRxAbierta = await rechaza(() => ContactService.updatePrescription(receta.id, { sphereOD: -2 }, 'ADMIN'));
check('venta REABIERTA: la receta también se destraba', errRxAbierta === null);

// ── 4. Re-confirmación versionada ────────────────────────────────────────────
const errCierra = await rechaza(() => OrderService.updateOrder(venta.id, { isLocked: true }, admin.id, 'Jefa', 'ADMIN'));
check('re-confirmación: vuelve a trabarse', errCierra === null);

const ventaFinal = await prisma.order.findUnique({ where: { id: venta.id } });
const snap = ventaFinal.prescriptionSnapshot ? JSON.parse(ventaFinal.prescriptionSnapshot) : null;
check('re-confirmación: el snapshot subió de versión', !!snap && snap.v >= 2);
check('re-confirmación: la versión anterior quedó en el historial del snapshot',
    Array.isArray(snap.history) && snap.history.length >= 1);
check('el snapshot congela la receta completa (con foto)', !!snap.rx && snap.rx.imageUrl === '/x.jpg');

const notaReconf = await prisma.interaction.findFirst({
    where: { clientId: cliente.id, content: { startsWith: '✅' } },
});
check('la re-confirmación quedó registrada en la ficha', !!notaReconf);

// ── 5. Confirmación de compra: qué le llega al cliente ───────────────────────
const { buildSaleConfirmation } = await import('../../src/lib/sale-confirmation.ts');

const base = {
    id: 'cmxxxxxxxxxxxxxxxxxab12',
    total: 100000, paid: 40000,
    client: { name: 'Ana Pérez', email: 'ana@ejemplo.com', phone: '3510000000' },
    prescription: { sphereOD: -1.25, sphereOI: -1, cylinderOD: -0.5, axisOD: 90, pd: 62, heightOD: 20, heightOI: 20, imageUrl: '/uploads/receta.jpg' },
    items: [{ quantity: 1, price: 100000, product: { name: 'Cápsula Escarlata', brand: 'Atelier', imagenesCatalogo: [] } }],
    frameSource: 'OPTICA',
    labFrameShape: 'CATEYE', frameA: '52', frameB: '32', frameDbl: '18', frameEdc: '54',
};

const sinTenido = buildSaleConfirmation(base);
check('confirmación: dice explícitamente que NO lleva teñido', sinTenido.waText.includes('NO lleva teñido'));
check('confirmación: muestra el saldo pendiente', sinTenido.waText.includes('Saldo pendiente: $60.000'));
check('confirmación: muestra lo abonado', sinTenido.waText.includes('Abonado: $40.000'));
check('confirmación: pide el OK', /Respondenos \*OK\*/.test(sinTenido.waText));
check('confirmación: pide corroborar el armazón', /es el que elegiste/.test(sinTenido.waText));
// La foto la saca el VENDEDOR. Pedírsela al cliente estaba al revés: él tiene
// que RECONOCER su armazón, no fotografiarlo.
check('confirmación: NO le pide una foto al cliente',
    !/mandanos una foto|mand[aá] una foto|envianos una foto/i.test(sinTenido.waText)
    && !/mandanos una foto/i.test(sinTenido.emailHtml));

const conFoto = buildSaleConfirmation({ ...base, frameImageUrl: '/uploads/armazon.jpg' });
check('confirmación: cuando hay foto del armazón, se la MUESTRA', conFoto.emailHtml.includes('/uploads/armazon.jpg'));
check('confirmación: y le pide que la mire para confirmar', /Mir[aá] la foto del armaz/.test(conFoto.waText));
check('confirmación 2x1: entran las dos fotos si hay dos',
    buildSaleConfirmation({ ...base, frameImageUrl: '/uploads/a.jpg', frameImageUrl2: '/uploads/b.jpg' })
        .emailHtml.includes('/uploads/b.jpg'));
check('confirmación: pide color y grado si son de sol', /color\* y el \*grado\*/.test(sinTenido.waText));
check('confirmación: invita a preguntar los términos que no se entienden', /preguntanos ahora/.test(sinTenido.waText));
check('confirmación: adjunta la foto de la receta', !!sinTenido.prescriptionImageUrl);
check('confirmación: nunca dice "undefined" ni "null"',
    !/undefined|\bnull\b/.test(sinTenido.waText) && !/undefined/.test(sinTenido.emailHtml));

const conTenido = buildSaleConfirmation({ ...base, labColor: 'Gris Oscuro (Grado 80%)', labTreatment: 'Teñido' });
check('confirmación: cuando hay teñido, lo dice con color y grado',
    conTenido.waText.includes('Teñido: Teñido - Gris Oscuro (Grado 80%)'));

const foto = buildSaleConfirmation({
    ...base,
    items: [{ quantity: 1, price: 1, product: { name: 'Cristal Fotocromático 1.60', imagenesCatalogo: [] } }],
});
check('confirmación: aclara qué es un fotocromático', /se oscurecen solos con el sol/.test(foto.waText));

const dosPares = buildSaleConfirmation({
    ...base,
    appliedPromoName: 'Promo 2x1',
    labFrameShape2: 'REDONDO', frameA2: '48', frameB2: '40', frameDbl2: '20', frameEdc2: '50',
});
check('confirmación 2x1: aparece el PRIMER par', dosPares.waText.includes('Armazón — Par 1'));
check('confirmación 2x1: aparece el SEGUNDO par con sus medidas',
    dosPares.waText.includes('Armazón — Par 2') && dosPares.waText.includes('A: 48'));
check('confirmación 2x1: avisa que el teñido no dice a qué par corresponde',
    buildSaleConfirmation({ ...base, appliedPromoName: 'Promo 2x1', labColor: 'Gris' })
        .waText.includes('confirmar a cuál corresponde'));

const actualizada = buildSaleConfirmation(base, true);
check('confirmación re-enviada: avisa que reemplaza a la anterior', /PEDIDO ACTUALIZADO/.test(actualizada.waText));

// ── 5b. La foto de CADA armazón es obligatoria para convertir ───────────────
// Sin foto no hay con qué contestarle a un "yo elegí otro armazón". En un 2x1
// son dos armazones distintos: cada uno lleva la suya.
const armazonProd = await prisma.product.findFirst({ where: { category: { contains: 'ARMAZ', mode: 'insensitive' } }, select: { id: true } });
const cristalProd = await prisma.product.findFirst({ where: { category: { contains: 'CRISTAL', mode: 'insensitive' } }, select: { id: true } });

async function presupuestoParaConvertir({ dosPares = false, foto1 = null, foto2 = null } = {}) {
    return prisma.order.create({
        data: {
            clientId: cliente.id, userId: vendedor.id,
            orderType: 'QUOTE', status: 'PENDING',
            total: 1000, subtotalWithMarkup: 1000, paid: 1000,
            prescriptionId: receta.id,
            frameSource: 'OPTICA',
            frameImageUrl: foto1, frameImageUrl2: foto2,
            ...(dosPares ? { appliedPromoName: 'Promo 2x1' } : {}),
            items: { create: [
                { productId: armazonProd.id, quantity: 1, price: 500 },
                { productId: cristalProd.id, quantity: 1, price: 500 },
            ] },
        },
    });
}

if (armazonProd && cristalProd) {
    // La receta necesita los datos que ya exige la conversión.
    await prisma.prescription.update({ where: { id: receta.id }, data: { heightOD: 20, heightOI: 20, pd: 60, imageUrl: '/x.jpg' } });

    const sinFoto = await presupuestoParaConvertir();
    const errSinFoto = await rechaza(() => OrderService.updateOrder(sinFoto.id, { orderType: 'SALE' }, vendedor.id, 'Vendedor', 'STAFF'));
    check('conversión: SIN la foto del armazón no se puede vender',
        !!errSinFoto && /foto del armaz/i.test(errSinFoto));

    const conFoto1 = await presupuestoParaConvertir({ foto1: '/uploads/a1.jpg' });
    const errConFoto = await rechaza(() => OrderService.updateOrder(conFoto1.id, { orderType: 'SALE' }, vendedor.id, 'Vendedor', 'STAFF'));
    check('conversión: CON la foto, la venta pasa', errConFoto === null);

    const dos1 = await presupuestoParaConvertir({ dosPares: true, foto1: '/uploads/a1.jpg' });
    const errDos = await rechaza(() => OrderService.updateOrder(dos1.id, { orderType: 'SALE' }, vendedor.id, 'Vendedor', 'STAFF'));
    check('conversión 2x1: con UNA sola foto NO alcanza',
        !!errDos && /2º armaz/i.test(errDos));

    const dos2 = await presupuestoParaConvertir({ dosPares: true, foto1: '/uploads/a1.jpg', foto2: '/uploads/a2.jpg' });
    const errDos2 = await rechaza(() => OrderService.updateOrder(dos2.id, { orderType: 'SALE' }, vendedor.id, 'Vendedor', 'STAFF'));
    check('conversión 2x1: con la foto de CADA armazón, pasa', errDos2 === null);
} else {
    console.log('  … sin catálogo local: se saltean los checks de foto obligatoria');
}

// ── 6. El presupuesto que queda en la ficha ES la copia que recibió el cliente ─
const { buildQuoteMessage } = await import('../../src/lib/quote-message.ts');
const { splitDetalle, DETALLE_MARK, buildOrderDetailSummary } = await import('../../src/lib/order-detail-summary.ts');

const presupuesto = {
    id: 'cmyyyyyyyyyyyyyyyycd34',
    orderType: 'QUOTE',
    total: 200000, subtotalWithMarkup: 200000, paid: 50000, markup: 0,
    discountCash: 10, discountTransfer: 5, discountCard: 0,
    items: [
        { quantity: 1, price: 120000, product: { name: 'Cápsula Escarlata', brand: 'Atelier' } },
        { quantity: 1, price: 40000, eye: 'RIGHT', product: { name: 'Cristal Monofocal 1.60' } },
        { quantity: 1, price: 40000, eye: 'LEFT', product: { name: 'Cristal Monofocal 1.60' } },
    ],
    payments: [{ amount: 50000, method: 'CASH' }],
};

const copia = buildQuoteMessage(presupuesto, 'Ana Pérez');
check('presupuesto: dice PRESUPUESTO (no VENTA)', copia.includes('*PRESUPUESTO — ATELIER ÓPTICA*'));
check('presupuesto: trae las 3 cuotas sin interés', copia.includes('3 cuotas sin interés'));
check('presupuesto: trae las 6 cuotas sin interés', copia.includes('6 cuotas sin interés'));
check('presupuesto: trae los tres medios de pago',
    copia.includes('Transf.') && copia.includes('Efectivo') && copia.includes('Tarjeta (Lista)'));
check('presupuesto: los dos cristales del mismo modelo son UNA línea',
    (copia.match(/Cristal Monofocal 1\.60/g) || []).length === 1);
check('presupuesto: muestra lo ya abonado y el saldo', copia.includes('Ya abonaste: $50.000') && copia.includes('Saldo en efectivo:'));
check('presupuesto: nunca dice "undefined" ni "NaN"', !/undefined|NaN/.test(copia));

const ventaMsg = buildQuoteMessage({ ...presupuesto, orderType: 'SALE' }, 'Ana Pérez');
check('presupuesto: una venta se titula VENTA', ventaMsg.includes('*VENTA — ATELIER ÓPTICA*'));

// La nota de la ficha: resumen visible + copia exacta colapsada.
const nota = `📄 Presupuesto enviado por Yani: por WhatsApp al 3510000000.${DETALLE_MARK}${copia}`;
const partido = splitDetalle(nota);
check('nota de presupuesto: el resumen queda en una línea legible', !partido.resumen.includes('cuotas'));
check('nota de presupuesto: el detalle colapsado es EXACTAMENTE la copia enviada', partido.detalle === copia);

// El detalle del PDF también tiene que traer las cuotas.
const detallePdf = buildOrderDetailSummary(presupuesto);
check('detalle del PDF: incluye las cuotas', detallePdf.includes('3 cuotas sin interés') && detallePdf.includes('6 cuotas sin interés'));
check('detalle del PDF: incluye los tres medios de pago',
    detallePdf.includes('💵 Efectivo') && detallePdf.includes('🏦 Transferencia') && detallePdf.includes('💳 Tarjeta'));

// Deja el mail renderizado para poder mirarlo con los ojos.
const { writeFileSync } = await import('node:fs');
const salida = 'scripts/checks/.confirmacion-compra.preview.html';
writeFileSync(salida, dosPares.emailHtml);
console.log(`\n  📄 Vista previa del mail: ${salida}`);

await limpiar();
await prisma.$disconnect();
console.log(`\n✅ ${passed} checks OK — la venta enviada es inmutable y todo cambio deja rastro\n`);

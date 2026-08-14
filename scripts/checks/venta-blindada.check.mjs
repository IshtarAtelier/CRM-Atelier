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
        await prisma.orderFrame.deleteMany({ where: { order: { clientId: c.id } } });
        await prisma.orderItem.deleteMany({ where: { order: { clientId: c.id } } });
        await prisma.order.deleteMany({ where: { clientId: c.id } });
        await prisma.interaction.deleteMany({ where: { clientId: c.id } });
        await prisma.clientTask.deleteMany({ where: { clientId: c.id } });
        await prisma.prescription.deleteMany({ where: { clientId: c.id } });
        await prisma.client.delete({ where: { id: c.id } }).catch(() => {});
    }
    // Los pedidos referencian al usuario: si una corrida anterior se cortó a la
    // mitad, quedan órdenes huérfanas que impiden borrar los usuarios de prueba.
    // Se limpian por usuario, no solo por cliente, para que el check se pueda
    // volver a correr siempre.
    const us = await prisma.user.findMany({ where: { email: { startsWith: 'check-venta-' } }, select: { id: true } });
    for (const u of us) {
        await prisma.orderFrame.deleteMany({ where: { order: { userId: u.id } } });
        await prisma.orderItem.deleteMany({ where: { order: { userId: u.id } } });
        await prisma.payment.deleteMany({ where: { order: { userId: u.id } } });
        await prisma.order.deleteMany({ where: { userId: u.id } });
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
check('confirmación: y le pide que la mire para confirmar',
    /Mir[aá] la foto que te adjuntamos/.test(conFoto.waText));

// La foto tiene que VIAJAR, no solo mencionarse. Por WhatsApp iba únicamente el
// PDF: el mensaje decía "mirá la foto que te adjuntamos" y no había ninguna.
const parDeCristales = () => ([
    { quantity: 1, eye: 'RIGHT', product: { name: 'Cristal Monofocal', category: 'Cristal', type: 'Cristal' } },
    { quantity: 1, eye: 'LEFT', product: { name: 'Cristal Monofocal', category: 'Cristal', type: 'Cristal' } },
]);
const conUnaFoto = buildSaleConfirmation({ ...base, items: parDeCristales(), frameImageUrl: '/uploads/a1.jpg' });
check('la foto del armazón queda lista para adjuntar', conUnaFoto.fotosArmazon.length === 1);
check('con el valor guardado (para leer sus bytes) y la URL absoluta (para el mail)',
    conUnaFoto.fotosArmazon[0].valor === '/uploads/a1.jpg' && conUnaFoto.fotosArmazon[0].url.startsWith('http'));
const conDosFotos = buildSaleConfirmation({ ...base, items: [...parDeCristales(), ...parDeCristales()],
    frameImageUrl: '/uploads/a1.jpg', frameImageUrl2: '/uploads/a2.jpg' });
check('dos armazones → viajan las dos fotos, cada una identificada',
    conDosFotos.fotosArmazon.length === 2 && conDosFotos.fotosArmazon[1].titulo.includes('2º'));
check('sin foto no se promete ninguna',
    buildSaleConfirmation({ ...base, items: parDeCristales() }).fotosArmazon.length === 0);

// Prolijidad: el mensaje se lee de un vistazo o no se lee. Las secciones van
// separadas por una línea en blanco, y el teñido aparece UNA sola vez.
check('el mensaje separa las secciones con líneas en blanco',
    conFoto.waText.includes('\n\n*LO QUE ENCARGASTE*'));

// Dos fotos existen solo si hay DOS armazones: la cantidad la marcan los pares
// de cristales (o la promo 2x1 como piso), no las columnas sueltas.
check('confirmación: con dos armazones entran las dos fotos',
    buildSaleConfirmation({ ...base, appliedPromoName: 'Promo 2x1', frameImageUrl: '/uploads/a.jpg', frameImageUrl2: '/uploads/b.jpg' })
        .emailHtml.includes('/uploads/b.jpg'));
// El pedido de confirmación del teñido es CONCRETO: si lleva, dice cuál y pide
// que lo confirme; si no lleva, lo dice y ofrece agregarlo. La versión genérica
// ("si son de sol, confirmanos el color") le pedía al cliente un dato que el
// sistema ya tiene.
check('sin teñido: lo dice y ofrece agregarlo', /\*SIN teñido\*/.test(sinTenido.waText));
check('confirmación: invita a preguntar los términos que no se entienden',
    /preguntanos y te lo explicamos/.test(sinTenido.waText));
check('confirmación: adjunta la foto de la receta', !!sinTenido.prescriptionImageUrl);
check('confirmación: nunca dice "undefined" ni "null"',
    !/undefined|\bnull\b/.test(sinTenido.waText) && !/undefined/.test(sinTenido.emailHtml));

const conTenido = buildSaleConfirmation({ ...base, labColor: 'Gris Oscuro (Grado 80%)', labTreatment: 'Teñido' });
check('confirmación: cuando hay teñido, lo dice con color y grado',
    conTenido.waText.includes('Teñido: Teñido - Gris Oscuro (Grado 80%)'));
check('con teñido: dice CUÁL es y pide confirmarlo',
    conTenido.waText.includes('El teñido va *Teñido - Gris Oscuro (Grado 80%)*'));
check('el teñido no se repite en "lo que encargaste"',
    !conTenido.waText.split('*TU ANTEOJO*')[0].includes('Teñido'));

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
check('confirmación 2x1: aparece el PRIMER armazón', dosPares.waText.includes('Armazón — 1º'));
check('confirmación 2x1: aparece el SEGUNDO armazón', dosPares.waText.includes('Armazón — 2º'));
// Las medidas NO van al cliente —no puede confirmarlas y tapan lo que sí— pero
// adentro (ficha y laboratorio) tienen que estar completas.
const { frameRecapText } = await import('../../src/lib/sale-recap-text.ts');
const repasoInterno = frameRecapText({ ...base, appliedPromoName: 'Promo 2x1',
    labFrameShape2: 'REDONDO', frameA2: '48', frameB2: '40', frameDbl2: '20', frameEdc2: '50' });
check('el repaso INTERNO sí lleva las medidas', repasoInterno.includes('A: 48'));
check('el mensaje al cliente NO lleva las medidas del armazón',
    !dosPares.waText.includes('A: 48') && !/Pte:/.test(dosPares.waText));
check('confirmación 2x1: avisa que el teñido no dice a qué par corresponde',
    buildSaleConfirmation({ ...base, appliedPromoName: 'Promo 2x1', labColor: 'Gris' })
        .waText.includes('confirmar a cuál corresponde'));

const actualizada = buildSaleConfirmation(base, true);
check('confirmación re-enviada: avisa que reemplaza a la anterior', /PEDIDO ACTUALIZADO/.test(actualizada.waText));

// ── 5b. La foto de CADA armazón es obligatoria para convertir ───────────────
// Sin foto no hay con qué contestarle a un "yo elegí otro armazón". En un 2x1
// son dos armazones distintos: cada uno lleva la suya.
// Productos SIN "2x1" en el nombre: `isTwoPairOrder` mira el nombre del item, y
// con un producto 2x1 del catálogo el caso "un solo armazón" dejaba de serlo.
// Y SIN fotocromático: ese pide elegir el tono para poder venderse, y con un
// Transitions de fixture todos los casos rebotaban por el color, no por lo que
// cada uno quiere probar. El fotocromático tiene su propio check más abajo.
const sinPromo = {
    NOT: [
        { name: { contains: '2x1', mode: 'insensitive' } },
        { name: { contains: 'fotocrom', mode: 'insensitive' } },
        { name: { contains: 'transitions', mode: 'insensitive' } },
        { name: { contains: 'xtractive', mode: 'insensitive' } },
        { name: { contains: 'acclimates', mode: 'insensitive' } },
        { name: { contains: 'xperio', mode: 'insensitive' } },
    ],
};
const armazonProd = await prisma.product.findFirst({ where: { category: { contains: 'ARMAZ', mode: 'insensitive' }, ...sinPromo }, select: { id: true } });
const cristalProd = await prisma.product.findFirst({ where: { category: { contains: 'CRISTAL', mode: 'insensitive' }, ...sinPromo }, select: { id: true } });

async function presupuestoParaConvertir({ dosPares = false, foto1 = null, foto2 = null } = {}) {
    // Cada conversión descuenta stock: sin reponerlo, el check se queda sin
    // unidades después de un par de corridas y falla por un motivo que no es el
    // que está probando.
    await prisma.product.updateMany({ where: { id: { in: [armazonProd.id, cristalProd.id] } }, data: { stock: 99 } });
    const orden = await prisma.order.create({
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
    // La foto vive en la tabla de armazones (las columnas del pedido son solo
    // el espejo para lo que todavía las lee).
    const fotos = dosPares ? [foto1, foto2] : [foto1];
    for (let i = 0; i < fotos.length; i++) {
        await prisma.orderFrame.create({ data: { orderId: orden.id, position: i + 1, imageUrl: fotos[i] } });
    }
    return orden;
}

if (armazonProd && cristalProd) {
    // La receta necesita los datos que ya exige la conversión.
    await prisma.prescription.update({ where: { id: receta.id }, data: { heightOD: 20, heightOI: 20, pd: 60, imageUrl: '/x.jpg' } });

    const sinFoto = await presupuestoParaConvertir();
    const errSinFoto = await rechaza(() => OrderService.updateOrder(sinFoto.id, { orderType: 'SALE' }, vendedor.id, 'Vendedor', 'STAFF'));
    check('conversión: SIN la foto del armazón no se puede vender',
        !!errSinFoto && /foto del (1º )?armaz/i.test(errSinFoto));

    const conFoto1 = await presupuestoParaConvertir({ foto1: '/uploads/a1.jpg' });
    const errConFoto = await rechaza(() => OrderService.updateOrder(conFoto1.id, { orderType: 'SALE' }, vendedor.id, 'Vendedor', 'STAFF'));
    check('conversión: CON la foto, la venta pasa', errConFoto === null);

    const dos1 = await presupuestoParaConvertir({ dosPares: true, foto1: '/uploads/a1.jpg' });
    const errDos = await rechaza(() => OrderService.updateOrder(dos1.id, { orderType: 'SALE' }, vendedor.id, 'Vendedor', 'STAFF'));
    check('conversión 2x1: con UNA sola foto NO alcanza',
        !!errDos && /2º armaz/i.test(errDos) && /foto/i.test(errDos));

    const dos2 = await presupuestoParaConvertir({ dosPares: true, foto1: '/uploads/a1.jpg', foto2: '/uploads/a2.jpg' });
    const errDos2 = await rechaza(() => OrderService.updateOrder(dos2.id, { orderType: 'SALE' }, vendedor.id, 'Vendedor', 'STAFF'));
    check('conversión 2x1: con la foto de CADA armazón, pasa', errDos2 === null);
} else {
    console.log('  … sin catálogo local: se saltean los checks de foto obligatoria');
}

// ── 5c. Un armazón POR PAR DE CRISTALES ─────────────────────────────────────
// La cantidad no la decide la promo: la decide cuántos pares de cristales lleva
// el pedido. Cuatro pares son cuatro anteojos, cada uno con sus medidas y su foto.
const { cantidadDeArmazones, framesDeLaOrden } = await import('../../src/lib/order-frames.ts');
const { describeLabFrameDetails } = await import('../../src/lib/lab-frame-summary.ts');

const cristal = { name: 'Cristal Monofocal 1.60', category: 'Cristal', type: 'Cristal' };
const parDe = (n) => Array.from({ length: n }, (_, i) => ([
    { quantity: 1, eye: 'RIGHT', product: cristal },
    { quantity: 1, eye: 'LEFT', product: cristal },
])).flat();

check('1 par de cristales → 1 armazón', cantidadDeArmazones({ items: parDe(1) }) === 1);
check('2 pares de cristales → 2 armazones (sin promo)', cantidadDeArmazones({ items: parDe(2) }) === 2);
check('4 pares de cristales → 4 armazones', cantidadDeArmazones({ items: parDe(4) }) === 4);
check('un pedido sin cristales igual pide 1 armazón', cantidadDeArmazones({ items: [] }) === 1);
check('la promo 2x1 sirve de piso SOLO en pedidos viejos sin ojo cargado',
    cantidadDeArmazones({ items: [{ quantity: 1, product: { name: 'Armazón' } }], appliedPromoName: 'Promo 2x1' }) === 2);
// Caso real de producción: el cristal se llama "…2x1" pero hay UN solo par. Si
// el nombre pisara el conteo, la venta quedaba trabada pidiendo la foto de un
// segundo armazón que no existe.
const cristal2x1 = { name: 'SMART Multifocal SMART FREE 2x1', category: 'Cristal', type: 'Cristal' };
check('1 par de cristales llamados "2x1" → UN armazón (el nombre no manda)',
    cantidadDeArmazones({ items: [
        { quantity: 1, eye: 'RIGHT', product: cristal2x1 }, { quantity: 1, eye: 'LEFT', product: cristal2x1 },
    ] }) === 1);
check('2 pares de esos cristales → dos armazones',
    cantidadDeArmazones({ items: [
        { quantity: 1, eye: 'RIGHT', product: cristal2x1 }, { quantity: 1, eye: 'LEFT', product: cristal2x1 },
        { quantity: 1, eye: 'RIGHT', product: cristal2x1 }, { quantity: 1, eye: 'LEFT', product: cristal2x1 },
    ] }) === 2);
check('4 pares → se arman 4 cuadros para cargar', framesDeLaOrden({ items: parDe(4) }).length === 4);
check('el repaso de 4 pares lista los 4 armazones',
    describeLabFrameDetails({ items: parDe(4) }).pairs.length === 4);
check('con 4 armazones el 2º NO dice "bonificado"',
    !describeLabFrameDetails({ items: parDe(4) }).pairs[1].label.includes('bonificado'));
check('con un 2x1 real el 2º SÍ dice "bonificado"',
    describeLabFrameDetails({ items: parDe(2), appliedPromoName: 'Promo 2x1' }).pairs[1].label.includes('bonificado'));

// ── 5d. El teñido SIN CARGO del 2x1 ─────────────────────────────────────────
// Regla del negocio: con un multifocal 2x1 el teñido va gratis, pero SOLO si no
// hay otro tratamiento en el pedido. Es plata: si se regala de más, se pierde en
// cada venta; si se cobra de más, el cliente reclama con razón.
const { applyTeñidoPromoDiscount, isTeñidoAddon } = await import('../../src/lib/promo-utils.ts');

const multi2x1 = { name: 'Multifocal SMART FREE 2x1', category: 'Cristal', type: 'Cristal', is2x1: true, price: 72500 };
// El producto REAL del catálogo: se llama "Teñido Compacto" y es categoría
// Cristal. La detección vieja pedía nombre exacto "Teñido" + categoría
// Tratamiento, así que NINGUNA variante entraba y el teñido del 2x1 se cobraba.
const tenidoProd = { name: 'Teñido Compacto', brand: 'Color', category: 'Cristal', price: 15000 };
const antirreflejo = { name: 'Antirreflejo', category: 'Tratamiento', price: 20000 };

const items2x1 = [
    { product: multi2x1, eye: 'RIGHT', price: 72500 }, { product: multi2x1, eye: 'LEFT', price: 72500 },
    { product: multi2x1, eye: 'RIGHT', price: 0 }, { product: multi2x1, eye: 'LEFT', price: 0 },
    { product: tenidoProd, price: 15000 }, { product: tenidoProd, price: 15000 },
];
applyTeñidoPromoDiscount(items2x1);
check('2x1: las dos líneas de teñido quedan en $0',
    items2x1.filter(i => i.product.category === 'Tratamiento').every(t => t.price === 0));

const conOtroTrat = [
    { product: multi2x1, eye: 'RIGHT', price: 72500 }, { product: multi2x1, eye: 'LEFT', price: 72500 },
    { product: tenidoProd, price: 15000 }, { product: antirreflejo, price: 20000 },
];
applyTeñidoPromoDiscount(conOtroTrat);
check('2x1 con OTRO tratamiento: el teñido se cobra',
    conOtroTrat.find(i => isTeñidoAddon(i.product)).price === 15000);

const monofocal = { name: 'Monofocal 1.60', category: 'Cristal', type: 'Cristal', price: 50000 };
const sinPromo2x1 = [
    { product: monofocal, eye: 'RIGHT', price: 50000 }, { product: monofocal, eye: 'LEFT', price: 50000 },
    { product: tenidoProd, price: 15000 },
];
applyTeñidoPromoDiscount(sinPromo2x1);
check('sin 2x1: el teñido se cobra', sinPromo2x1.find(i => isTeñidoAddon(i.product)).price === 15000);

// Qué es y qué NO es un add-on de teñido
check('"Teñido Degradé" también se reconoce',
    isTeñidoAddon({ name: 'Teñido Degradé', category: 'Cristal' }));
check('el "Teñido" viejo (categoría Tratamiento) sigue reconociéndose',
    isTeñidoAddon({ name: 'Teñido', category: 'Tratamiento' }));
check('un cristal fotocromático NO es add-on de teñido (se cobra)',
    !isTeñidoAddon({ name: 'ESSILOR Orma Transitions GEN S (fotocromático 8 colores) 2x1', category: 'Cristal' }));

const orden2x1 = { items: items2x1, appliedPromoName: 'Promo 2x1', labTreatment: 'Teñido', labColor: 'Degradé Gris' };
check('el 2x1 con teñido sigue pidiendo 2 armazones', cantidadDeArmazones(orden2x1) === 2);
// El teñido se factura como categoría Cristal: si se contara como un cristal
// más, agregaría un anteojo fantasma con medidas y foto que nadie puede cargar.
check('el teñido NO cuenta como par de cristales',
    cantidadDeArmazones({ items: [
        { product: multi2x1, eye: 'RIGHT' }, { product: multi2x1, eye: 'LEFT' },
        { product: tenidoProd, eye: 'RIGHT' }, { product: tenidoProd, eye: 'LEFT' },
    ] }) === 1);
// El teñido se lee de los ITEMS, que es donde el vendedor lo carga hoy. Mirar
// solo labColor/labTreatment hacía que la confirmación al cliente dijera "NO
// lleva teñido" en un pedido que sí lo llevaba — reportado en producción.
const conColorEnItems = { ...orden2x1, items: orden2x1.items.map(i =>
    isTeñidoAddon(i.product) ? { ...i, crystalColor: 'Gris', crystalColorType: 'DEGRADE', crystalColorNote: '4' } : i) };
check('el repaso lee el teñido de los items (color y grado)',
    describeLabFrameDetails(conColorEnItems).tint?.text === 'Degradé · Gris · grado 4');
check('un teñido cargado sin color lo dice, no lo oculta',
    describeLabFrameDetails(orden2x1).tint?.text === 'sin color elegido');
check('los items MANDAN sobre labColor/labTreatment',
    describeLabFrameDetails({ ...conColorEnItems, labColor: 'Verde', labTreatment: 'Teñido' }).tint?.text === 'Degradé · Gris · grado 4');
// Con varios armazones, la ambigüedad ya no se mide por CANTIDAD de líneas: se
// mide por si cada teñido dice a qué armazón va. Dos líneas sin asignar siguen
// siendo ambiguas; una sola bien asignada, no.
const asignados = { ...orden2x1, items: orden2x1.items.map((i, n) =>
    isTeñidoAddon(i.product) ? { ...i, crystalColor: 'Gris', framePosition: n % 2 === 0 ? 1 : 2 } : i) };
check('con cada teñido asignado a su armazón NO avisa ambigüedad',
    describeLabFrameDetails(asignados).tint?.ambiguousPair === false);
check('con un teñido SIN asignar sí avisa',
    describeLabFrameDetails({ ...orden2x1, items: orden2x1.items.map(i =>
        isTeñidoAddon(i.product) ? { ...i, crystalColor: 'Gris' } : i) }).tint?.ambiguousPair === true);
check('el repaso pone el teñido DEBAJO del armazón que le toca',
    describeLabFrameDetails(asignados).pairs[1].tint?.includes('Gris'));
check('con UNA línea para dos pares, avisa que no se sabe a cuál corresponde',
    describeLabFrameDetails({ items: items2x1.slice(0, 4).concat([{ product: tenidoProd, price: 0 }]), appliedPromoName: 'Promo 2x1', labTreatment: 'Teñido', labColor: 'Gris' }).tint?.ambiguousPair === true);

// ── 5e. Los tonos de teñido son los que acepta el laboratorio ───────────────
// Si el vendedor elige un tono que SmartLab no tiene, alguien va a tener que
// llamar para corregirlo y el pedido queda parado.
const { TONOS_TENIDO, ESTILOS_TENIDO, INTENSIDADES_TENIDO } = await import('../../src/lib/constants/tenido.ts');
check('los tonos son los 8 de SmartLab, en su orden',
    JSON.stringify(TONOS_TENIDO.map(t => t.name)) ===
    JSON.stringify(['Gris', 'Verde', 'Sepia', 'G15', 'Nigth Drive', 'Azul', 'Rosa', 'Rojo']));
check('cada tono tiene su muestra de color', TONOS_TENIDO.every(t => /^#[0-9a-f]{6}$/i.test(t.hexColor)));
check('los tres estilos de teñido siguen estando', ESTILOS_TENIDO.length === 3);
check('las intensidades son las de SmartLab',
    JSON.stringify([...INTENSIDADES_TENIDO]) === JSON.stringify(['0.5', '1', '2', '3', '4']));

// ── 5f. Cada cristal ofrece SUS colores ─────────────────────────────────────
// Ofrecer un color que ese cristal no tiene es un pedido rebotado. La regla la
// dio el negocio contra la Lista de Precios Optovision del 3/8/2026, y MANDA
// sobre lo que diga el nombre del producto — los nombres del catálogo mienten.
const { paletaDeFotocromatico } = await import('../../src/lib/constants/paletas-color.ts');
const tonosDe = (name) => (paletaDeFotocromatico({ name })?.tonos || []).map(t => t.name);

check('Gen S en ORMA → los 8 colores',
    tonosDe('COMFORT - ORMA TRANSITIONS GEN S + CRIZAL 2x1').length === 8);
check('Gen S en Airwear → solo Gris y Café',
    JSON.stringify(tonosDe('COMFORT - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL 2x1')) === JSON.stringify(['Gris', 'Café / Marrón']));
check('Gen S en Stylis → solo Gris y Café',
    tonosDe('EYEZEN BOOST - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL 2x1').length === 2);
check('Xtractive → solo gris',
    JSON.stringify(tonosDe('COMFORT - ORMA TRANSITIONS XTRACTIVE + CRIZAL 2x1')) === JSON.stringify(['Gris']));
check('Acclimates → Gris y Café',
    tonosDe('ESPACE PLUS DIGITAL - ORMA ACCLIMATES + CRIZAL 2x1').length === 2);
check('Xperio en ORMA → Gris, Café y Verde',
    JSON.stringify(tonosDe('COMFORT - ORMA XPERIO + CRIZAL 2x1')) === JSON.stringify(['Gris', 'Café / Marrón', 'Verde / Esmeralda']));
check('Xperio en Airwear → Gris y Café',
    tonosDe('COMFORT - AIRWEAR 1.59 XPERIO + CRIZAL 2x1').length === 2);

// La excepción del XR Design: su Gen S en ORMA son 3 colores, NO 8 — aunque el
// nombre del producto diga "(fotocromáticos 8)". El nombre miente; la lista no.
check('XR Design Gen S en ORMA → 3 colores, no 8 (el nombre dice 8)',
    tonosDe('XR DESIGN - ORMA TRANSITIONS GEN S + CRIZAL Prevencia (fotocromáticos 8) 2x1').length === 3);
check('XR Design Gen S en Airwear → 2 colores (el nombre también dice 8)',
    tonosDe('XR DESIGN - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL (fotocromáticos 8) 2x1').length === 2);

check('un SKU que se llama "(Gris)" ofrece solo gris',
    tonosDe('EYEZEN BOOST - ORMA TRANSITIONS GEN S (Gris) + CRIZAL 2x1').length === 1);
check('un cristal sin color no abre paleta',
    paletaDeFotocromatico({ name: 'ORMA 1.50 + CRIZAL' }) === null);

// Que la paleta exista no alcanza: el BOTÓN tiene que aparecer, o el vendedor
// no llega nunca. Los 15 Xperio tenían su paleta cargada y el botón no salía.
const { needsColorSelection } = await import('../../src/lib/crystal-color-utils.ts');
const abre = (name) => needsColorSelection({ name, category: 'Cristal' });
check('un Xperio abre el selector de color', abre('COMFORT - ORMA XPERIO + CRIZAL 2x1'));
check('un Gen S abre el selector', abre('COMFORT - ORMA TRANSITIONS GEN S + CRIZAL 2x1'));
check('un Xtractive abre el selector', abre('COMFORT - ORMA TRANSITIONS XTRACTIVE + CRIZAL 2x1'));
check('un Acclimates abre el selector', abre('ESPACE PLUS DIGITAL - ORMA ACCLIMATES + CRIZAL 2x1'));
check('el teñido a pedido abre el selector', needsColorSelection({ name: 'Teñido Compacto', category: 'Cristal' }));
check('un cristal común NO abre el selector', !abre('COMFORT - ORMA + CRIZAL 2x1'));

// ── 5g. Con varios armazones, el teñido dice a CUÁL va ──────────────────────
if (armazonProd && cristalProd) {
    const tenidoProdBD = await prisma.product.findFirst({ where: { name: { contains: 'Teñido', mode: 'insensitive' } }, select: { id: true } });
    if (tenidoProdBD) {
        // Los TRES datos del teñido son obligatorios para vender: color, grado
        // y a qué armazón va. El fixture los trae completos salvo el que cada
        // check quiere ver faltar.
        const dosAnteojosConTenido = async (asignado, grado = '3') => {
            await prisma.product.updateMany({ where: { id: { in: [armazonProd.id, cristalProd.id, tenidoProdBD.id] } }, data: { stock: 99 } });
            return prisma.order.create({ data: {
                clientId: cliente.id, userId: vendedor.id, orderType: 'QUOTE', status: 'PENDING',
                total: 1000, subtotalWithMarkup: 1000, paid: 1000,
                prescriptionId: receta.id, frameSource: 'OPTICA',
                frames: { create: [{ position: 1, imageUrl: '/u/1.jpg' }, { position: 2, imageUrl: '/u/2.jpg' }] },
                items: { create: [
                    { productId: cristalProd.id, quantity: 1, price: 250, eye: 'RIGHT' },
                    { productId: cristalProd.id, quantity: 1, price: 250, eye: 'LEFT' },
                    { productId: cristalProd.id, quantity: 1, price: 250, eye: 'RIGHT' },
                    { productId: cristalProd.id, quantity: 1, price: 250, eye: 'LEFT' },
                    { productId: tenidoProdBD.id, quantity: 1, price: 0, crystalColor: 'Gris', crystalColorNote: grado, framePosition: asignado ? 2 : null },
                ] },
            } });
        };

        const sinAsignar = await dosAnteojosConTenido(false);
        const errSA = await rechaza(() => OrderService.updateOrder(sinAsignar.id, { orderType: 'SALE' }, vendedor.id, 'Vendedor', 'STAFF'));
        check('dos armazones + teñido sin asignar → no deja vender',
            !!errSA && /sin asignar/i.test(errSA));

        // El GRADO también es obligatorio: un teñido sin grado es un pedido que
        // la fábrica no puede ejecutar igual que uno sin color.
        const sinGrado = await dosAnteojosConTenido(true, null);
        const errSG = await rechaza(() => OrderService.updateOrder(sinGrado.id, { orderType: 'SALE' }, vendedor.id, 'Vendedor', 'STAFF'));
        check('teñido sin grado → no deja vender',
            !!errSG && /grado/i.test(errSG));

        const asignado = await dosAnteojosConTenido(true);
        const errA = await rechaza(() => OrderService.updateOrder(asignado.id, { orderType: 'SALE' }, vendedor.id, 'Vendedor', 'STAFF'));
        check('con el teñido completo (color, grado y armazón), la venta pasa', errA === null);
    }
}

// ── 5g-bis. El FOTOCROMÁTICO también se pide por color ──────────────────────
// No es teñido —viene así de fábrica y se oscurece con el sol— pero se fabrica
// en un tono. Mandarlo sin elegir es un pedido que la fábrica no puede hacer.
// No lleva grado: eso es del teñido, y pedirlo sería inventar un dato.
if (armazonProd) {
    const fotoProd = await prisma.product.findFirst({
        where: {
            category: { contains: 'CRISTAL', mode: 'insensitive' },
            name: { contains: 'ORMA TRANSITIONS GEN S', mode: 'insensitive' },
            NOT: { name: { contains: '(Gris)', mode: 'insensitive' } },
        },
        select: { id: true, name: true },
    });
    if (fotoProd) {
        const { paletaDeFotocromatico } = await import('../../src/lib/constants/paletas-color.ts');
        check('el Gen S en ORMA ofrece los 8 tonos', (paletaDeFotocromatico(fotoProd)?.tonos.length || 0) === 8);

        const conFotocromatico = async (color) => {
            await prisma.product.updateMany({ where: { id: { in: [armazonProd.id, fotoProd.id] } }, data: { stock: 99 } });
            return prisma.order.create({ data: {
                clientId: cliente.id, userId: vendedor.id, orderType: 'QUOTE', status: 'PENDING',
                total: 1000, subtotalWithMarkup: 1000, paid: 1000,
                prescriptionId: receta.id, frameSource: 'OPTICA',
                frames: { create: [{ position: 1, imageUrl: '/u/1.jpg' }] },
                items: { create: [
                    { productId: fotoProd.id, quantity: 1, price: 250, eye: 'RIGHT', crystalColor: color },
                    { productId: fotoProd.id, quantity: 1, price: 250, eye: 'LEFT', crystalColor: color },
                ] },
            } });
        };

        const sinTono = await conFotocromatico(null);
        const errST = await rechaza(() => OrderService.updateOrder(sinTono.id, { orderType: 'SALE' }, vendedor.id, 'Vendedor', 'STAFF'));
        check('fotocromático sin tono elegido → no deja vender',
            !!errST && /color se pone el fotocrom/i.test(errST));
        check('el error NO le pide grado a un fotocromático',
            !!errST && !/grado/i.test(errST));

        const conTono = await conFotocromatico('Zafiro (Azul)');
        const errCT = await rechaza(() => OrderService.updateOrder(conTono.id, { orderType: 'SALE' }, vendedor.id, 'Vendedor', 'STAFF'));
        check('con el tono elegido, el fotocromático pasa a venta', errCT === null);
    }
}

// ── 5h. El registro completo de la venta en la ficha ───────────────────────
// Es el documento al que se recurre "ante cualquier eventualidad": tiene que
// alcanzar SOLO para reconstruir qué se vendió, sin abrir el pedido.
const { ventaRecapCompleto } = await import('../../src/lib/sale-recap-text.ts');
const cristalP = { name: 'Cristal Multifocal', category: 'Cristal', type: 'Cristal' };
const tenidoP = { name: 'Teñido Degradé', category: 'Cristal' };
const ventaCompleta = {
    total: 300000, paid: 200000, frameSource: 'OPTICA', labNotes: 'Bisel al frente',
    frames: [
        { position: 1, shape: 'CATEYE', a: '52', b: '32', dbl: '18', edc: '54', details: 'Acetato negro', imageUrl: '/f1.jpg', heightOD: 20, heightOI: 20 },
        { position: 2, shape: 'REDONDO', a: '48', b: '40', dbl: '20', edc: '50', details: 'Metal dorado', imageUrl: null, heightOD: 19, heightOI: 19 },
    ],
    items: [
        { quantity: 1, eye: 'RIGHT', price: 75000, product: cristalP },
        { quantity: 1, eye: 'LEFT', price: 75000, product: cristalP },
        { quantity: 1, eye: 'RIGHT', price: 75000, product: cristalP },
        { quantity: 1, eye: 'LEFT', price: 75000, product: cristalP },
        { quantity: 1, price: 0, product: tenidoP, crystalColor: 'Gris', crystalColorType: 'DEGRADE', crystalColorNote: '4', framePosition: 2 },
    ],
};
const registro = ventaRecapCompleto(ventaCompleta, {
    prescriptionType: 'MULTIFOCAL', sphereOD: -1.25, sphereOI: -1, cylinderOD: -0.5, axisOD: 90,
    additionOD: 1.75, additionOI: 1.75, pd: 62, heightOD: 20, heightOI: 20, notes: 'Dr. Gómez',
});

check('el registro trae lo abonado y el saldo', registro.includes('Abonado: $200.000') && registro.includes('Saldo: $100.000'));
check('el registro lista los productos con su precio', registro.includes('$75.000'));
check('marca lo que va sin cargo', registro.includes('SIN CARGO'));
check('el teñido dice color, grado y a qué armazón va',
    registro.includes('Gris') && registro.includes('grado 4') && registro.includes('→ 2º armazón'));
check('el registro trae las medidas de los DOS armazones',
    registro.includes('A: 52') && registro.includes('A: 48'));
check('y las alturas de cada uno', registro.includes('Altura OD 20') && registro.includes('Altura OD 19'));
check('dice qué armazón NO lleva teñido', registro.includes('SIN teñido'));
check('avisa si a un armazón le falta la foto', registro.includes('SIN FOTO'));
check('la receta va completa', registro.includes('Esf -1.25') && registro.includes('DNP') && registro.includes('Dr. Gómez'));
check('trae las notas del laboratorio', registro.includes('Bisel al frente'));
check('y no las repite dos veces', (registro.match(/Bisel al frente/g) || []).length === 1);

// ── 5i. El fotocromático es de CADA anteojo, no del pedido ─────────────────
// Reportado: con dos armazones el mensaje decía "Fotocromático: SÍ" una sola
// vez y el cliente entendía que los DOS lo eran, cuando era solo el primero.
const fotocProd = { name: 'AIRWEAR 1.59 TRANSITIONS GEN S', category: 'Cristal', type: 'Cristal' };
const comunProd = { name: 'ORMA 1.50 Blanco', category: 'Cristal', type: 'Cristal' };
const mixto = {
    frameSource: 'OPTICA',
    frames: [{ position: 1, shape: 'CATEYE', imageUrl: '/1.jpg' }, { position: 2, shape: 'REDONDO', imageUrl: '/2.jpg' }],
    items: [
        { quantity: 1, eye: 'RIGHT', product: fotocProd }, { quantity: 1, eye: 'LEFT', product: fotocProd },
        { quantity: 1, eye: 'RIGHT', product: comunProd }, { quantity: 1, eye: 'LEFT', product: comunProd },
    ],
};
const paresMixto = describeLabFrameDetails(mixto).pairs;
check('el 1º armazón queda marcado como fotocromático', paresMixto[0].photochromic === true);
check('y el 2º NO', paresMixto[1].photochromic === false);
const textoMixto = frameRecapText(mixto);
check('el repaso dice fotocromático solo en el armazón que lo lleva',
    (textoMixto.match(/· fotocromático/g) || []).length === 1);

const ambosFotoc = { ...mixto, items: [
    { quantity: 1, eye: 'RIGHT', product: fotocProd }, { quantity: 1, eye: 'LEFT', product: fotocProd },
    { quantity: 1, eye: 'RIGHT', product: fotocProd }, { quantity: 1, eye: 'LEFT', product: fotocProd },
] };
check('si los dos son fotocromáticos, los dos lo dicen',
    (frameRecapText(ambosFotoc).match(/· fotocromático/g) || []).length === 2);

check('un cristal común no se marca como fotocromático',
    describeLabFrameDetails({ frames: [{ position: 1 }], items: [
        { quantity: 1, eye: 'RIGHT', product: comunProd }, { quantity: 1, eye: 'LEFT', product: comunProd },
    ] }).pairs[0].photochromic === false);

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

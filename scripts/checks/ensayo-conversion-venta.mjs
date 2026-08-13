// ────────────────────────────────────────────────────────────────────────────
// ENSAYO de punta a punta: convertir un presupuesto en venta y ver que pase
// TODO lo que tiene que pasar.
//
// Los checks unitarios prueban las decisiones; esto prueba el circuito: la
// transacción real de conversión, el congelado de la receta, las notas en la
// ficha, la generación del PDF, el guardado del archivo y el envío del mail.
//
// Corre contra la base LOCAL y crea/borra sus propios datos. El mail se manda
// de verdad, a la dirección que se le pase:
//
//   node scripts/checks/ensayo-conversion-venta.mjs --mail=alguien@ejemplo.com
//   node scripts/checks/ensayo-conversion-venta.mjs            (no manda nada)
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const destino = (process.argv.find(a => a.startsWith('--mail=')) || '').split('=')[1] || null;

const MARCA = 'ENSAYO_CONVERSION';
const paso = (t) => console.log(`\n▸ ${t}`);
const ok = (t) => console.log(`  ✓ ${t}`);
const mal = (t) => { console.log(`  ✗ ${t}`); process.exitCode = 1; };

async function limpiar() {
    const cs = await prisma.client.findMany({ where: { name: { startsWith: MARCA } }, select: { id: true } });
    for (const c of cs) {
        await prisma.orderItem.deleteMany({ where: { order: { clientId: c.id } } });
        await prisma.payment.deleteMany({ where: { order: { clientId: c.id } } });
        await prisma.order.deleteMany({ where: { clientId: c.id } });
        await prisma.interaction.deleteMany({ where: { clientId: c.id } });
        await prisma.clientTask.deleteMany({ where: { clientId: c.id } });
        await prisma.prescription.deleteMany({ where: { clientId: c.id } });
        await prisma.client.delete({ where: { id: c.id } }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { email: 'ensayo-vendedora@local' } });
}

console.log('\n═══ ENSAYO: presupuesto → venta, de punta a punta ═══');
if (!destino) console.log('   (sin --mail: no se envía ningún correo)');
await limpiar();

paso('Armando el presupuesto de prueba');
const vendedora = await prisma.user.create({
    data: { email: 'ensayo-vendedora@local', name: 'Yani (ensayo)', password: 'x', role: 'STAFF' },
});
const cliente = await prisma.client.create({
    data: {
        name: `${MARCA} Ana Pérez`, phone: '3510000000',
        email: destino || 'sin-mail@ejemplo.local',
        dni: '30111222', address: 'José Luis de Tejeda 4380',
        birthDate: new Date('1988-05-04'), status: 'LEAD',
    },
});
const receta = await prisma.prescription.create({
    data: {
        clientId: cliente.id,
        sphereOD: -1.25, sphereOI: -1, cylinderOD: -0.5, axisOD: 90,
        additionOD: 1.75, additionOI: 1.75,
        pd: 62, heightOD: 20, heightOI: 20,
        prescriptionType: 'MULTIFOCAL',
        imageUrl: '/images/products/clipon-1.jpg',
        notes: 'Trae receta del Dr. Gómez',
    },
});

// Productos reales del catálogo local, para que el PDF y las fotos salgan bien.
const armazon = await prisma.product.findFirst({ where: { category: { contains: 'ARMAZ', mode: 'insensitive' } }, select: { id: true, name: true, price: true } });
const cristal = await prisma.product.findFirst({ where: { category: { contains: 'CRISTAL', mode: 'insensitive' } }, select: { id: true, name: true, price: true } });
if (!armazon || !cristal) { console.log('  ! No hay productos en la base local; el ensayo necesita catálogo.'); process.exit(1); }
ok(`Productos: ${armazon.name} + ${cristal.name}`);

const presupuesto = await prisma.order.create({
    data: {
        clientId: cliente.id, userId: vendedora.id,
        orderType: 'QUOTE', status: 'PENDING',
        total: 200000, subtotalWithMarkup: 200000, paid: 200000,
        discountCash: 10, discountTransfer: 5,
        prescriptionId: receta.id,
        frameSource: 'OPTICA',
        labFrameShape: 'CATEYE', frameA: '52', frameB: '32', frameDbl: '18', frameEdc: '54',
        labColor: 'Degradé Gris', labTreatment: 'Teñido',
        labNotes: 'Bisel al frente',
        frameImageUrl: '/images/products/clipon-1.jpg',
        items: {
            create: [
                { productId: armazon.id, quantity: 1, price: 120000 },
                { productId: cristal.id, quantity: 1, price: 40000, eye: 'RIGHT' },
                { productId: cristal.id, quantity: 1, price: 40000, eye: 'LEFT' },
            ],
        },
        payments: { create: [{ amount: 200000, method: 'CASH', date: new Date() }] },
    },
});
ok(`Presupuesto #${presupuesto.id.slice(-4).toUpperCase()} creado`);

paso('Convirtiéndolo en VENTA por el camino real (OrderService.updateOrder)');
const { OrderService } = await import('../../src/services/order.service.ts');
await OrderService.updateOrder(
    presupuesto.id,
    { orderType: 'SALE', labStatus: 'SENT', isLocked: true },
    vendedora.id, vendedora.name, 'STAFF',
);
ok('Conversión ejecutada sin lanzar');

// El envío de la confirmación es fire-and-forget: se le da tiempo.
await new Promise(r => setTimeout(r, 25000));

paso('Revisando qué quedó en la venta');
const venta = await prisma.order.findUnique({ where: { id: presupuesto.id } });
venta.orderType === 'SALE' ? ok('quedó como VENTA') : mal('NO quedó como venta');
venta.isLocked ? ok('quedó bloqueada') : mal('NO quedó bloqueada');
venta.labSentBy ? ok(`vendedor registrado: ${venta.labSentBy}`) : mal('labSentBy vacío');

const snap = venta.prescriptionSnapshot ? JSON.parse(venta.prescriptionSnapshot) : null;
snap?.rx ? ok(`receta congelada (v${snap.v}, por ${snap.frozenBy})`) : mal('NO se congeló la receta');
snap?.rx?.imageUrl ? ok('el snapshot incluye la foto de la receta') : mal('el snapshot no trae la foto');

paso('Revisando las notas de la ficha');
const notas = await prisma.interaction.findMany({
    where: { clientId: cliente.id }, orderBy: { createdAt: 'asc' },
});
console.log(`  (${notas.length} notas)`);
for (const n of notas) {
    const [resumen] = n.content.split('\n⟦detalle⟧\n');
    const colapsa = n.content.includes('⟦detalle⟧');
    console.log(`   · [${n.type}] ${resumen.split('\n')[0].slice(0, 95)}${colapsa ? '   ⟨+detalle colapsado⟩' : ''}`);
}

const venta_ = notas.find(n => n.type === 'SALE_CONFIRMED');
venta_ ? ok('quedó la nota de VENTA CONFIRMADA') : mal('falta la nota de venta');
venta_?.content.includes('⟦detalle⟧') ? ok('con el repaso colapsado') : mal('el repaso no está colapsado');
venta_?.content.includes('Enviada a fábrica por') ? ok('dice quién la envió a fábrica y cuándo') : mal('no dice quién la envió');
venta_?.imageUrl ? ok('la foto de la receta quedó en la nota') : mal('la nota no tiene la foto');

const conf = notas.find(n => n.content.includes('Confirmación de compra enviada'));
if (conf) {
    ok('quedó la nota de la confirmación enviada');
    console.log('  ── resultado por canal ──');
    conf.content.split('\n⟦detalle⟧\n')[0].split('\n').slice(1).forEach(l => console.log(`     ${l}`));
} else {
    mal('NO quedó la nota de la confirmación (¿falló el envío entero?)');
}

paso('Revisando el candado');
try {
    await OrderService.updateOrder(presupuesto.id, { frameA: '99' }, vendedora.id, vendedora.name, 'STAFF');
    mal('¡SE PUDO editar una venta enviada!');
} catch (e) {
    ok(`el candado rechaza: "${e.message.slice(0, 80)}…"`);
}

const tareas = await prisma.clientTask.count({ where: { clientId: cliente.id, status: 'PENDING' } });
console.log(`\n  Tareas pendientes que quedaron: ${tareas}${tareas ? ' (aviso de envío fallido)' : ''}`);

if (destino) {
    console.log(`\n  📧 Si el mail salió, revisá la casilla de ${destino}.`);
}

console.log('\n  Limpiando los datos del ensayo…');
await limpiar();
await prisma.$disconnect();
console.log(process.exitCode ? '\n❌ El ensayo encontró problemas (ver ✗ arriba)\n' : '\n✅ Ensayo completo: el circuito funciona de punta a punta\n');

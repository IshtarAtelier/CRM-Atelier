// ────────────────────────────────────────────────────────────────────────────
// OPORTUNIDADES DE CIERRE contra la BASE: los filtros de las consultas.
//
// `check:cierres` prueba las reglas puras. Este prueba lo que las reglas no
// ven: los WHERE. Ahí vivía el bug de los carritos invisibles (el panel
// filtraba PENDING/ABANDONED y el recupero los pasa a EMAIL_SENT: cero
// carritos durante 30 días, sin que fallara nada).
//
// Arma sus propios datos (marca CHECK_CIERRES_), corre el servicio REAL y
// borra todo al final. Corre contra la base LOCAL (DATABASE_URL de .env).
// Correr:  npm run check:cierres-base
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { CierresService } from '../../src/services/cierres.service.ts';

const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) {
    console.error('✋ Este check ESCRIBE datos de prueba: solo corre contra la base local.');
    process.exit(1);
}

const prisma = new PrismaClient();
const M = 'CHECK_CIERRES_';
const DIA = 86400000;
const hace = (d) => new Date(Date.now() - d * DIA);
let ok = 0;
const fallas = [];
const check = (nombre, cond, extra = '') => {
    if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
    else { fallas.push(nombre); console.log(`  ✗ ${nombre} ${extra}`); }
};

async function limpiar() {
    const clientes = (await prisma.client.findMany({ where: { name: { startsWith: M } }, select: { id: true } })).map((c) => c.id);
    const chats = (await prisma.whatsAppChat.findMany({ where: { waId: { startsWith: M } }, select: { id: true } })).map((c) => c.id);
    await prisma.whatsAppMessage.deleteMany({ where: { chatId: { in: chats } } });
    await prisma.whatsAppChat.deleteMany({ where: { id: { in: chats } } });
    await prisma.interaction.deleteMany({ where: { clientId: { in: clientes } } });
    await prisma.order.deleteMany({ where: { clientId: { in: clientes } } });
    await prisma.checkoutSession.deleteMany({ where: { OR: [{ email: { startsWith: M.toLowerCase() } }, { clientId: { in: clientes } }] } });
    await prisma.client.deleteMany({ where: { id: { in: clientes } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: M.toLowerCase() } } });
}

try {
    await limpiar();
    const vendedor = await prisma.user.create({
        data: { email: `${M.toLowerCase()}vendedor@local`, name: `${M}Vendedor`, role: 'STAFF', password: '' },
        select: { id: true, name: true },
    });

    const ficha = (sufijo, telefono, extra = {}) => prisma.client.create({
        data: { name: `${M}${sufijo} Apellido`, phone: telefono, status: 'CONTACT', createdAt: hace(40), ...extra },
        select: { id: true },
    });
    const presupuesto = (clientId, dias, total) => prisma.order.create({
        data: { clientId, userId: vendedor.id, orderType: 'QUOTE', status: 'PENDING', total, createdAt: hace(dias) },
        select: { id: true },
    });

    const comun10 = await ficha('Comun10', '3519990001');
    await presupuesto(comun10.id, 10, 100000);
    const duplicada = await ficha('Duplicada', '0351 15 999-0001'); // misma persona que comun10
    await presupuesto(duplicada.id, 8, 90000);
    const comun20 = await ficha('Comun20', '3519990002');
    await presupuesto(comun20.id, 20, 100000);
    const alto25 = await ficha('Alto25', '3519990003');
    await presupuesto(alto25.id, 25, 400000);
    const sinPresu = await ficha('SinPresu', '3519990004', { createdAt: hace(10) });
    const carrito = await prisma.checkoutSession.create({
        data: { status: 'EMAIL_SENT', total: 50000, cartData: [], email: `${M.toLowerCase()}carrito@local`, phone: '3519990005', firstName: `${M}Carrito`, lastName: 'Web', createdAt: hace(5) },
        select: { id: true },
    });
    const escritoComun = await ficha('EscritoComun', '3519990006');
    await presupuesto(escritoComun.id, 6, 100000);
    await prisma.interaction.create({ data: { clientId: escritoComun.id, type: 'FOLLOWUP', content: 'check', userId: vendedor.id, userName: vendedor.name, createdAt: hace(1) } });
    const altoCelular = await ficha('AltoCelular', '3519990007');
    await presupuesto(altoCelular.id, 6, 400000);
    const altoBot = await ficha('AltoBot', '3519990008');
    await presupuesto(altoBot.id, 6, 400000);
    for (const [c, remitente] of [[altoCelular, 'Teléfono'], [altoBot, 'Bot']]) {
        const chat = await prisma.whatsAppChat.create({ data: { waId: `${M}${c.id}`, clientId: c.id }, select: { id: true } });
        await prisma.whatsAppMessage.create({ data: { chatId: chat.id, direction: 'OUTBOUND', content: 'hola', senderName: remitente, createdAt: hace(1) } });
    }

    const panel = await CierresService.oportunidades();
    const de = (id) => panel.filter((o) => o.clientId === id || o.id === id);
    const fixture = panel.filter((o) => (o.clientName || '').startsWith(M));

    console.log('\nVentanas por tipo');
    check('presupuesto común de 10 días ENTRA', de(comun10.id).length + de(duplicada.id).length === 1);
    check('presupuesto común de 20 días NO entra (ventana 14)', de(comun20.id).length === 0);
    check('ticket alto de 25 días ENTRA y es importante', de(alto25.id)[0]?.importante === true);
    check('ficha sin presupuesto de 10 días ENTRA', de(sinPresu.id)[0]?.type === 'SIN_PRESUPUESTO');
    check('carrito en EMAIL_SENT ENTRA (el bug de los carritos invisibles)', de(carrito.id).length === 1);

    console.log('\nUna persona = una tarjeta');
    check('dos fichas con el mismo teléfono en otro formato → una tarjeta', de(comun10.id).length + de(duplicada.id).length === 1);
    const tels = fixture.map((o) => (o.phone || '').replace(/\D/g, '').slice(-8)).filter(Boolean);
    check('ningún teléfono repetido en el panel', tels.length === new Set(tels).size);

    console.log('\n"Ya le escribí"');
    check('común con seguimiento firmado ayer: escondida', de(escritoComun.id).length === 0);
    check('importante con WhatsApp desde el celular ("Teléfono"): queda, marcada', !!de(altoCelular.id)[0]?.yaEscrito);
    check('importante con mensaje del Bot: NO cuenta como escrita', de(altoBot.id).length === 1 && !de(altoBot.id)[0]?.yaEscrito);
} catch (err) {
    fallas.push(`excepción: ${err.message}`);
    console.error(err);
} finally {
    await limpiar();
    await prisma.$disconnect();
}

console.log(`\n${ok} ok, ${fallas.length} fallas`);
if (fallas.length) { console.log('FALLAS:', fallas.join(' · ')); process.exit(1); }
process.exit(0);

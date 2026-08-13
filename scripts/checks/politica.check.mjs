// ────────────────────────────────────────────────────────────────────────────
// La política de seguimientos: una sola respuesta para todos los flujos.
//
// Hasta la Fase 2 esta decisión vivía en 5 archivos con umbrales copiados a
// mano — cooldown de 48hs acá y 72 allá, "actividad reciente" de 24hs y de 2hs,
// y un cron que enviaba sin mirar nada. Este check fija la tabla de casos: si
// alguien vuelve a escribir un filtro propio en otro archivo, los números dejan
// de coincidir y se nota acá.
//
// Corre contra la base LOCAL. Crea y borra sus propios datos.
// Correr:  npm run check:politica
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(new URL('../../wa-service/', import.meta.url));
const { evaluarElegibilidad, MOTIVOS } = require('./followups/politica');

const prisma = new PrismaClient();
let passed = 0;
const check = (name, cond) => { assert.ok(cond, `FALLÓ: ${name}`); passed++; console.log(`  ✓ ${name}`); };

const AHORA = new Date('2026-08-13T15:00:00.000Z');
const haceHoras = (h) => new Date(AHORA.getTime() - h * 3600000);

const MARCA = 'CHECK_POLITICA';
async function limpiar() {
    const cs = await prisma.client.findMany({ where: { name: { startsWith: MARCA } }, select: { id: true } });
    for (const c of cs) {
        await prisma.whatsAppMessage.deleteMany({ where: { chat: { clientId: c.id } } });
        await prisma.whatsAppChat.deleteMany({ where: { clientId: c.id } });
        await prisma.client.delete({ where: { id: c.id } }).catch(() => {});
    }
}

console.log('\n— La política: una sola respuesta para todos los seguimientos —\n');
await limpiar();

// El interruptor global tiene que estar prendido para que el resto se pueda medir.
await prisma.systemSetting.upsert({
    where: { key: 'followups_enabled' },
    update: { value: 'true' },
    create: { key: 'followups_enabled', value: 'true' },
});

let n = 0;
/** Arma un cliente + chat de prueba y devuelve el contexto listo para evaluar. */
async function escenario({ status = 'LEAD', tags = [], labels = [], pausadoHasta = null, ultimoSeguimientoHace = null, ultimoMensajeHace = 100, conEntrante = true } = {}) {
    n++;
    const cliente = await prisma.client.create({
        data: {
            name: `${MARCA}_${n}`, phone: `54900000${String(n).padStart(4, '0')}`,
            dni: `9000${String(n).padStart(4, '0')}`, address: 'x', birthDate: new Date('1990-01-01'),
            status,
            ...(tags.length ? { tags: { connectOrCreate: tags.map(t => ({ where: { name: t }, create: { name: t } })) } } : {}),
        },
        include: { tags: true },
    });
    const chat = await prisma.whatsAppChat.create({
        data: {
            waId: `5490000${n}@c.us`, clientId: cliente.id, profileName: cliente.name,
            chatLabels: labels,
            followUpPausedUntil: pausadoHasta,
            lastFollowUpAt: ultimoSeguimientoHace === null ? null : haceHoras(ultimoSeguimientoHace),
            lastMessageAt: haceHoras(ultimoMensajeHace),
        },
    });
    if (conEntrante) {
        await prisma.whatsAppMessage.create({
            data: { chatId: chat.id, waMessageId: `m${n}`, direction: 'INBOUND', content: 'hola', senderName: 'Cliente' },
        });
    }
    return { client: cliente, chat, now: AHORA };
}

// ── La tabla de casos ────────────────────────────────────────────────────────
const casos = [
    ['un lead normal SÍ recibe seguimiento', {}, MOTIVOS.OK],
    ['ya compró (status CLIENT): queda fuera de lo automático', { status: 'CLIENT' }, MOTIVOS.CONVERTIDO],
    ['ya compró (status active): idem', { status: 'active' }, MOTIVOS.CONVERTIDO],
    ['etiqueta SIN_SEGUIMIENTO en el chat', { labels: ['SIN_SEGUIMIENTO'] }, MOTIVOS.SIN_SEGUIMIENTO],
    ['etiqueta de exclusión en el cliente', { tags: ['no interesado'] }, MOTIVOS.TAG_EXCLUSION],
    ['etiqueta de exclusión en el chat', { labels: ['Proveedor'] }, MOTIVOS.TAG_EXCLUSION],
    ['pausado por el propio cliente', { pausadoHasta: new Date('2026-09-01') }, MOTIVOS.PAUSADO],
    ['recibió un seguimiento hace 10hs (cooldown 48)', { ultimoSeguimientoHace: 10 }, MOTIVOS.COOLDOWN],
    ['recibió un seguimiento hace 60hs: ya pasó el cooldown', { ultimoSeguimientoHace: 60 }, MOTIVOS.OK],
    ['el chat tuvo actividad hace 3hs', { ultimoMensajeHace: 3 }, MOTIVOS.ACTIVIDAD_RECIENTE],
    ['contacto frío: nunca escribió', { conEntrante: false }, MOTIVOS.CONTACTO_FRIO],
];

for (const [nombre, opts, esperado] of casos) {
    const ctx = await escenario(opts);
    const v = await evaluarElegibilidad(ctx);
    check(`${nombre} → ${esperado}`, v.codigo === esperado);
}

// ── Que el bot esté apagado en la charla NO frena el seguimiento ─────────────
// Es la regresión más cara del sistema: durante 20 días no salió NI UNO porque
// se miraba este label — y lo tienen casi todos los chats con presupuesto,
// justo los que más merecen seguimiento.
const conBotApagado = await escenario({ labels: ['[SISTEMA - BOT APAGADO]'] });
check('[SISTEMA - BOT APAGADO] NO frena el seguimiento', (await evaluarElegibilidad(conBotApagado)).ok);

// ── Las diferencias entre flujos son PARÁMETROS, no copias ──────────────────
const activo = await escenario({ ultimoMensajeHace: 3 });
check('sender: con ventana de 2hs, una charla de hace 3hs ya no frena',
    (await evaluarElegibilidad({ ...activo, actividadHoras: 2 })).ok);

const enCooldown = await escenario({ ultimoSeguimientoHace: 10 });
check('sender: con el cooldown apagado, un envío ya aprobado no se mata',
    (await evaluarElegibilidad({ ...enCooldown, mirarCooldown: false })).ok);

const comprador = await escenario({ status: 'CLIENT' });
check('posventa: con mirarConvertido apagado, SÍ le escribe a quien compró',
    (await evaluarElegibilidad({ ...comprador, mirarConvertido: false })).ok);

const posventa = await escenario({ tags: ['post-venta'] });
check('posventa: su lista recortada no corta por la etiqueta "post-venta"',
    (await evaluarElegibilidad({ ...posventa, tagsExclusion: ['spam', 'proveedor'] })).ok);

const frio = await escenario({ conEntrante: false });
check('trigger manual: el vendedor puede escribirle a un contacto frío',
    (await evaluarElegibilidad({ ...frio, isManual: true })).ok);

const pausadoManual = await escenario({ pausadoHasta: new Date('2026-09-01') });
check('trigger manual: NO adelanta la fecha que pidió el cliente',
    !(await evaluarElegibilidad({ ...pausadoManual, isManual: true })).ok);

// ── Compra y pago posteriores a la fecha de referencia ──────────────────────
const conCompra = await escenario();
const usuario = await prisma.user.findFirst({ select: { id: true } });
if (usuario) {
    await prisma.order.create({
        data: { clientId: conCompra.client.id, userId: usuario.id, orderType: 'SALE', total: 1000, createdAt: haceHoras(2) },
    });
    const v = await evaluarElegibilidad({ ...conCompra, desde: haceHoras(48) });
    check('compró después del presupuesto → no se le sigue insistiendo', v.codigo === MOTIVOS.COMPRA_POSTERIOR);
} else {
    console.log('  … sin usuarios en la base local: se saltea el caso de compra posterior');
}

// ── El interruptor global manda sobre todo ──────────────────────────────────
const { olvidarInterruptor } = require('./followups/politica');
await prisma.systemSetting.update({ where: { key: 'followups_enabled' }, data: { value: 'false' } });
olvidarInterruptor();
const normal = await escenario();
check('con el interruptor apagado no sale nada',
    (await evaluarElegibilidad(normal)).codigo === MOTIVOS.APAGADO_GLOBAL);
check('los flujos que no lo miran (ejecutor de tareas) siguen evaluando',
    (await evaluarElegibilidad({ ...normal, mirarInterruptorGlobal: false })).ok);

await prisma.systemSetting.update({ where: { key: 'followups_enabled' }, data: { value: 'true' } });
olvidarInterruptor();

await limpiar();
await prisma.$disconnect();
console.log(`\n✅ ${passed} checks OK — una sola política, y las diferencias son parámetros\n`);

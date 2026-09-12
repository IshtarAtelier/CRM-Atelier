// ────────────────────────────────────────────────────────────────────────────
// MOTOR DE SEGUIMIENTOS: las compuertas, antes de que alguien lo prenda.
//
// El motor (`/api/cron/seguimientos`) corre EN SECO: calcula a quién le
// escribiría y no manda. Pasarlo a 'real' es una sola SystemSetting. Este check
// fija lo que tiene que vetar el día que mande solo — sobre todo lo que se
// agregó en el loop de auditoría del 10/9/2026:
//   · no mandar si ya se le mandó un seguimiento hace menos de 48 h (red contra
//     el doble envío cuando falla el registro);
//   · no mandar si alguien le escribió hace menos de 48 h (el clasificador deja
//     vencer el escalón siguiente aunque un vendedor haya chateado ayer).
//
// Puro: sin base y sin red. Corre en CI con check:cierres.
// Correr:  node --experimental-strip-types --import ./scripts/checks/_alias.mjs \
//            scripts/checks/motor-seguimientos.check.mjs
// ────────────────────────────────────────────────────────────────────────────

import { evaluar } from '../../src/lib/seguimientos/politica.ts';
import { seleccionar } from '../../src/lib/seguimientos/seleccion.ts';

let ok = 0;
const fallas = [];
const check = (nombre, cond, extra = '') => {
    if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
    else { fallas.push(nombre); console.log(`  ✗ ${nombre} ${extra}`); }
};

const NOW = new Date('2026-09-11T15:00:00.000Z').getTime();
const hace = (h) => new Date(NOW - h * 3600000);
const ctx = { now: NOW };
const cand = (o = {}) => ({
    leadId: 'l1', nombre: 'Ana Pérez', createdAt: new Date('2026-09-08T12:00:00-03:00'),
    waChatId: 'w1', plantilla: 'seguimiento_presupuesto', ...o,
});
const chat = (o = {}) => ({ lastInboundAt: null, lastFollowUpAt: null, followUpPausedUntil: null, lastOutboundAt: null, ...o });

console.log('\nLo que sale');
check('un lead nuevo, callado y sin toques recientes: SALE', evaluar(cand(), chat(), ctx) === null, evaluar(cand(), chat(), ctx));
check('le escribieron hace 60 h: SALE', evaluar(cand(), chat({ lastOutboundAt: hace(60) }), ctx) === null);

console.log('\nLo que se veta');
const veta = (nombre, c, ch, contiene) => {
    const v = evaluar(c, ch, ctx);
    check(nombre, !!v && (!contiene || v.includes(contiene)), `(veto: ${v})`);
};
veta('sin plantilla (el paso es de una persona)', cand({ plantilla: undefined }), chat(), 'plantilla');
veta('plantilla no habilitada para envío automático', cand({ plantilla: 'seguimiento_carrito' }), chat(), 'no está habilitada');
check('12/9 · un lead de antes del 7/9 SALE (Ishtar: "a todos"; la ventana de 30 días la pone el playbook)', evaluar(cand({ createdAt: new Date('2026-09-01T12:00:00-03:00') }), chat(), ctx) === null);
veta('sin chat', cand({ waChatId: null }), null, 'chat');
veta('sin nombre de pila', cand({ nombre: 'Cliente' }), chat(), 'nombre');
veta('seguimientos pausados', cand(), chat({ followUpPausedUntil: hace(-24) }), 'pausados');
veta('el cliente escribió hace 10 h (charla viva)', cand(), chat({ lastInboundAt: hace(10) }), 'charla está viva');
veta('respondió al último seguimiento', cand(), chat({ lastFollowUpAt: hace(100), lastInboundAt: hace(60) }), 'respondió');
veta('NUEVO · ya se le mandó un seguimiento hace 20 h', cand(), chat({ lastFollowUpAt: hace(20) }), 'seguimiento hace menos');
veta('NUEVO · un vendedor le escribió hace 5 h', cand(), chat({ lastOutboundAt: hace(5) }), 'le escribieron');
veta('11/9 · nombre de puros emojis (🫵🏻💪)', cand({ nombre: '🫵🏻💪' }), chat(), 'nombre');
veta('11/9 · "anteojo de cerca" como nombre de perfil', cand({ nombre: 'anteojo de cerca' }), chat(), 'nombre');
veta('11/9 · "El Flaco": no se manda "Hola El"', cand({ nombre: 'El Flaco' }), chat(), 'nombre');
check('"Jorge 😎" sale como Jorge', evaluar(cand({ nombre: 'Jorge 😎' }), chat(), ctx) === null);
veta('11/9 · apagado desde el chat (SIN_SEGUIMIENTO)', cand(), chat({ chatLabels: ['SIN_SEGUIMIENTO'] }), 'apagado desde el chat');
veta('11/9 · apagado desde la ficha (etiqueta "Sin Seguimiento")', cand(), chat({ tagNames: ['Sin Seguimiento'] }), 'apagado desde la ficha');
veta('11/9 · "no interesado" en la ficha', cand(), chat({ tagNames: ['No interesado'] }), 'apagado desde la ficha');
check('otras etiquetas no lo apagan', evaluar(cand(), chat({ chatLabels: ['SEGUIMIENTO_DIA_1'], tagNames: ['Frío'] }), ctx) === null);

console.log('\nSi Meta rechaza un seguimiento automático, el sistema se aparta');
{
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const { readFileSync } = await import('node:fs');
    const sf = require('../../wa-service/shared/seguimiento-fallido.js');
    const { ETIQUETA_POR_PLANTILLA } = await import('../../src/lib/embudo/playbook.ts');
    check('el espejo de etiquetas por plantilla coincide con el playbook', JSON.stringify(sf.ETIQUETA_POR_PLANTILLA) === JSON.stringify(ETIQUETA_POR_PLANTILLA), `bot=${JSON.stringify(sf.ETIQUETA_POR_PLANTILLA)} crm=${JSON.stringify(ETIQUETA_POR_PLANTILLA)}`);
    check('un saliente de "Sistema" con plantilla de seguimiento es automático', sf.esSeguimientoAutomatico({ senderName: 'Sistema', templateName: 'seguimiento_presupuesto' }));
    check('el mismo mensaje mandado por una persona NO se deshace', !sf.esSeguimientoAutomatico({ senderName: 'Matias Turchi', templateName: 'seguimiento_presupuesto' }));
    check('un aviso de pedido listo de "Sistema" no es un seguimiento', !sf.esSeguimientoAutomatico({ senderName: 'Sistema', templateName: 'pedido_listo' }));
    // Simulación sin base: el prisma de mentira registra qué se escribe.
    let escrito = null;
    const prismaFalso = {
        whatsAppChat: {
            findUnique: async () => ({ chatLabels: ['SEGUIMIENTO_DIA_1', 'OTRA'] }),
            update: async ({ data }) => { escrito = data; },
        },
    };
    const r = await sf.deshacerSeguimientoFallido(prismaFalso, { chatId: 'c1', senderName: 'Sistema', templateName: 'seguimiento_presupuesto' });
    check('saca la etiqueta del escalón y deja las demás', escrito && JSON.stringify(escrito.chatLabels) === '["OTRA"]', JSON.stringify(escrito));
    check('borra lastFollowUpAt (el tablero lo vuelve a mostrar para una persona)', escrito && escrito.lastFollowUpAt === null);
    check(`pausa el motor ${sf.PAUSA_DIAS} días para esa charla`, r && escrito.followUpPausedUntil > new Date(Date.now() + (sf.PAUSA_DIAS - 1) * 86400000));
    const inbound = readFileSync(new URL('../../wa-service/transport/inbound.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('persistStatus lo llama al recibir FAILED', inbound.includes('deshacerSeguimientoFallido(prisma'));
}

console.log('\nSi el cliente responde a un seguimiento, el vendedor recibe una tarea');
{
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const rs = require('../../wa-service/shared/respuesta-a-seguimiento.js');
    check('primera respuesta después del seguimiento → sí', rs.esPrimeraRespuestaAlSeguimiento({ lastFollowUpAt: hace(20), lastInboundAt: hace(30) }));
    check('nunca había escrito → sí', rs.esPrimeraRespuestaAlSeguimiento({ lastFollowUpAt: hace(20), lastInboundAt: null }));
    check('ya había respondido después del seguimiento → no (una sola tarea)', !rs.esPrimeraRespuestaAlSeguimiento({ lastFollowUpAt: hace(20), lastInboundAt: hace(5) }));
    check('sin seguimiento previo → no', !rs.esPrimeraRespuestaAlSeguimiento({ lastFollowUpAt: null, lastInboundAt: hace(5) }));
    let creada = null;
    const prismaFalso = { clientTask: { findFirst: async () => null, create: async ({ data }) => { creada = data; return data; } } };
    await rs.crearTareaPorRespuesta(prismaFalso, { clientId: 'c1', lastFollowUpAt: hace(20), lastInboundAt: null }, { texto: 'Hola sí me parece bien, solo me quedó una duda', tipo: 'TEXT' });
    check('la tarea es del VENDEDOR (type TASK, para hoy) y trae el texto', creada && creada.type === 'TASK' && creada.description.includes('me quedó una duda') && creada.dueDate instanceof Date, JSON.stringify(creada));
    const inbound = (await import('node:fs')).readFileSync(new URL('../../wa-service/transport/inbound.js', import.meta.url), 'utf8');
    check('inbound.js la crea al guardar el entrante', inbound.includes('crearTareaPorRespuesta(prisma'));
    const { respondioAlSeguimiento, PREFIJO_RESPUESTA } = await import('../../src/lib/embudo/respuestas-a-seguimientos.ts');
    check('la red diaria usa el MISMO prefijo que el wa-service (no duplica)', PREFIJO_RESPUESTA === rs.PREFIJO);
    check('red diaria: respuesta posterior al seguimiento → tarea', respondioAlSeguimiento({ clientId: 'c', lastFollowUpAt: hace(20), lastInboundAt: hace(5) }));
    check('red diaria: respuesta ANTERIOR al seguimiento → nada', !respondioAlSeguimiento({ clientId: 'c', lastFollowUpAt: hace(5), lastInboundAt: hace(20) }));
    const svc = (await import('node:fs')).readFileSync(new URL('../../src/services/embudo.service.ts', import.meta.url), 'utf8');
    check('correrDiario (9:00) la corre todos los días', svc.includes('tareasPorRespuestasSinAtender()'));
}

console.log('\nNombre de persona: el motor y el bot dicen lo mismo');
{
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const { esNombreValido } = require('../../wa-service/shared/nombre-de-persona.js');
    const { esNombreDePersona } = await import('../../src/lib/nombre-de-persona.ts');
    for (const [n, esperado] of [['Julio Pérez', true], ['Ana', true], ['😊', false], ['🫵🏻💪', false], ['3541215971', false], ['hola quiero info', false], ['Cliente', false], ['anteojo de cerca', false], ['lentes de sol', false]]) {
        check(`"${n}" → ${esperado ? 'nombre' : 'no es nombre'} (en los dos lados)`, esNombreValido(n) === esperado && esNombreDePersona(n) === esperado, `bot=${esNombreValido(n)} motor=${esNombreDePersona(n)}`);
    }
}

console.log('\nCupo');
{
    const chats = new Map([['a', chat()], ['b', chat()], ['c', chat()], ['d', chat({ lastOutboundAt: hace(1) })]]);
    const r = seleccionar({
        candidatos: ['a', 'b', 'c', 'd'].map((w, i) => cand({ leadId: `l${i}`, waChatId: w })),
        chats, ctx, cupo: 2,
    });
    check('respeta el cupo del tick', r.elegidos.length === 2);
    check('lo que no entra queda en espera, no se pierde', r.enEspera.length === 1);
    check('lo vetado no ocupa cupo', r.vetados.length === 1);
    const cero = seleccionar({ candidatos: [cand()], chats: new Map([['w1', chat()]]), ctx, cupo: -3 });
    check('cupo agotado (negativo): no sale nadie', cero.elegidos.length === 0);
}

console.log(`\n${ok} ok, ${fallas.length} fallas`);
if (fallas.length) { console.log('FALLAS:', fallas.join(' · ')); process.exit(1); }

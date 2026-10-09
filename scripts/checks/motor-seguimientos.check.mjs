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
check('8/10 · una plantilla PENDING en Meta no se manda (rebotaría y frenaría el motor)', (evaluar(cand({ plantilla: 'retomar_con_cupon' }), chat(), { ...ctx, plantillasNoAprobadas: new Set(['retomar_con_cupon']) }) || '').includes('no está aprobada'));
check('8/10 · aprobada: sale', evaluar(cand({ plantilla: 'retomar_con_cupon' }), chat(), { ...ctx, plantillasNoAprobadas: new Set() }) === null);
check('12/9 · un lead de antes del 7/9 SALE (Ishtar: "a todos"; la ventana de 30 días la pone el playbook)', evaluar(cand({ createdAt: new Date('2026-09-01T12:00:00-03:00') }), chat(), ctx) === null);
veta('sin chat', cand({ waChatId: null }), null, 'chat');
veta('sin nombre de pila', cand({ nombre: 'Cliente' }), chat(), 'nombre');
veta('seguimientos pausados', cand(), chat({ followUpPausedUntil: hace(-24) }), 'pausados');
veta('el cliente escribió hace 10 h (charla viva)', cand(), chat({ lastInboundAt: hace(10) }), 'charla está viva');
check('8/10 · respondió con un 👍 o un "gracias" (seguir) y ya pasaron 48 h: SALE (antes frenaba para siempre)', evaluar(cand(), chat({ lastFollowUpAt: hace(100), lastInboundAt: hace(60), respuesta: 'seguir' }), ctx) === null);
veta('8/10 · respondió que no: se cierra como perdido', cand(), chat({ lastFollowUpAt: hace(100), lastInboundAt: hace(60), respuesta: 'cierre' }), 'dijo que no');
veta('8/10 · respondió "más adelante": se pausa', cand(), chat({ lastFollowUpAt: hace(100), lastInboundAt: hace(60), respuesta: 'posponer' }), 'más adelante');
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
    escrito = null;
    const rd = await sf.deshacerSeguimientoFallido(prismaFalso, { chatId: 'c1', senderName: 'Sistema', templateName: 'seguimiento_presupuesto' }, { definitivo: true });
    check('8/10 · "pidió no recibir marketing" (130472): se apaga el seguimiento de esa persona, no se pausa 30 días', rd && rd.definitivo && escrito.chatLabels.includes(sf.LABEL_SIN_SEGUIMIENTO) && !('followUpPausedUntil' in escrito), JSON.stringify(escrito));
    const inb = readFileSync(new URL('../../wa-service/transport/inbound.js', import.meta.url), 'utf8');
    check('inbound.js marca 130472 como definitivo', inb.includes('130472') && inb.includes('definitivo: true') && inb.includes('definitivo: !!conocido?.definitivo'));
    const inbound = readFileSync(new URL('../../wa-service/transport/inbound.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('persistStatus lo llama al recibir FAILED', inbound.includes('deshacerSeguimientoFallido(prisma'));
}

console.log('\nSi el cliente responde a un seguimiento, NO hay tarea para nadie (8/10/2026)');
{
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const { readFileSync } = await import('node:fs');
    const rs = require('../../wa-service/shared/respuesta-a-seguimiento.js');
    check('primera respuesta después del seguimiento → se detecta', rs.esPrimeraRespuestaAlSeguimiento({ lastFollowUpAt: hace(20), lastInboundAt: hace(30) }));
    const inbound = readFileSync(new URL('../../wa-service/transport/inbound.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('inbound.js ya NO crea la tarea del vendedor', !inbound.includes('crearTareaPorRespuesta('));
    const respTs = readFileSync(new URL('../../src/lib/embudo/respuestas-a-seguimientos.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('la red diaria solo CANCELA las que quedaron (no crea)', !respTs.includes('clientTask.create') && respTs.includes("status: 'CANCELLED'"));
    const sync = readFileSync(new URL('../../src/lib/embudo/sincronizar-tareas.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('sincronizar-tareas ya NO crea tareas EMBUDO (solo limpia)', !sync.includes('clientTask.create') && sync.includes("status: 'CANCELLED'"));
    const ruta = readFileSync(new URL('../../src/app/api/cron/seguimientos/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('el motor lee la respuesta y ejecuta cierre/pausa', ruta.includes('clasificarRespuesta(') && ruta.includes('cerrarComoPerdido(') && ruta.includes('posponerSeguimiento('));
    check("el motor ejecuta los 'cerrar' del playbook", ruta.includes("tipo === 'cerrar'"));
    check('8/10 · responder al retome reserva el 10 % en la ficha', ruta.includes('reservarDescuentoRetome(') && ruta.includes("ultimaPlantilla.get(f.id) === PLANTILLA_RETOME"));
    check('8/10 · el motor consulta el espejo de plantillas antes de mandar', ruta.includes('prisma.whatsAppTemplate.findMany') && ruta.includes('plantillasNoAprobadas'));
    const svc = readFileSync(new URL('../../src/services/embudo.service.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('la etiqueta "Perdido (embudo)" saca al lead del embudo', svc.includes('TAG_PERDIDO_EMBUDO.toLowerCase()'));
    check('8/10 · nadie que haya comprado o esté CONFIRMADO entra al embudo (venta, confirmado, fábrica, pago)', ["{ status: 'CONFIRMED' }", "{ labSentAt: { not: null } }", "{ paid: { gt: 0 } }", "{ payments: { some: {} } }"].every(x => svc.includes(x)));
}

console.log('\nFreno, días de Córdoba y registro (12/9/2026)');
{
    const { debeFrenar } = await import('../../src/lib/seguimientos/ejecutor.ts');
    const r = (ok, salteado = false) => ({ leadId: 'x', nombre: 'x', plantilla: 'p', ok, salteado });
    check('3 fallas seguidas → frena', debeFrenar([r(true), r(false), r(false), r(false)]));
    check('2 fallas y un éxito en el medio → no frena', !debeFrenar([r(false), r(false), r(true), r(false)]));
    check('los salteados no cuentan como falla', !debeFrenar([r(false), r(false, true), r(false, true), r(false, true)]));
    check('menos de 3 intentos → no frena', !debeFrenar([r(false), r(false)]));
    const { diaArt, horaArt, inicioDelDiaArt, agruparVetos } = await import('../../src/lib/seguimientos/registro.ts');
    check('23:30 de Córdoba (02:30Z del día siguiente) sigue siendo el MISMO día', diaArt(new Date('2026-09-12T02:30:00Z')) === '2026-09-11');
    check('00:30 de Córdoba (03:30Z) ya es el día siguiente', diaArt(new Date('2026-09-12T03:30:00Z')) === '2026-09-12');
    check('la hora es la de Córdoba (15:00Z → 12)', horaArt(new Date('2026-09-12T15:00:00Z')) === 12);
    check('el día de Córdoba empieza a las 03:00Z', inicioDelDiaArt(new Date('2026-09-12T20:00:00Z')).toISOString() === '2026-09-12T03:00:00.000Z');
    const g = agruparVetos([{ nombre: 'A', motivo: 'm1' }, { nombre: 'B', motivo: 'm2' }, { nombre: 'C', motivo: 'm1' }], 1);
    check('los vetos se agrupan por motivo, el más frecuente primero, con nombres recortados', g[0].motivo === 'm1' && g[0].cantidad === 2 && g[0].nombres.length === 1 && g[1].cantidad === 1);
    const { createRequire } = await import('node:module'); const require = createRequire(import.meta.url);
    const sf = require('../../wa-service/shared/seguimiento-fallido.js');
    let escrito = null;
    const prismaFalso = { whatsAppChat: { findUnique: async () => ({ chatLabels: ['SEGUIMIENTO_DIA_1'] }), update: async ({ data }) => { escrito = data; } } };
    await sf.deshacerSeguimientoFallido(prismaFalso, { chatId: 'c', senderName: 'Sistema', templateName: 'seguimiento_presupuesto' }, { deCuenta: true });
    check('rechazo por problema de la CUENTA: se deshace el escalón pero NO se pausa al cliente', escrito && !('followUpPausedUntil' in escrito) && escrito.lastFollowUpAt === null);
    const { readFileSync } = await import('node:fs');
    const ruta = readFileSync(new URL('../../src/app/api/cron/seguimientos/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('la ruta registra la corrida SIEMPRE (también si revienta)', ruta.includes('registrarCorrida(') && ruta.includes("catch (e: any)") && ruta.includes('terminar({ error'));
    check('el cupo del día se cuenta sobre los envíos registrados del día de Córdoba', ruta.includes("prisma.seguimientoEnvio.count") && ruta.includes("diaArt: dia, resultado: 'ENVIADO'"));
    const ej = readFileSync(new URL('../../src/lib/seguimientos/ejecutor.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('el ejecutor reclama la clave única ANTES de mandar', ej.indexOf('reclamarEnvio(') < ej.indexOf('sendWhatsApp('));
    const inst = readFileSync(new URL('../../src/instrumentation.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('SIGTERM devuelve la hora reclamada', inst.includes("process.once('SIGTERM'") && inst.includes('seguimientosReclamo'));
    check('la alerta diaria del embudo está enganchada (19:30)', inst.includes("dispararSimple('embudo-salud'"));
}

console.log('\nChats @lid: se manda al número real');
{
    const { createRequire } = await import('node:module'); const require = createRequire(import.meta.url);
    const { destinoDelChat } = require('../../wa-service/shared/destino-del-chat.js');
    check('@lid con realPhone → realPhone', destinoDelChat({ waId: '92659725168855@lid', realPhone: '5493515308174' }) === '5493515308174');
    check('@lid sin realPhone → null (no se puede mandar)', destinoDelChat({ waId: '92659725168855@lid', realPhone: null }) === null);
    check('E.164 → tal cual', destinoDelChat({ waId: '5493515308174', realPhone: null }) === '5493515308174');
    check('"<num>@c.us" → número pelado', destinoDelChat({ waId: '5493515308174@c.us', realPhone: null }) === '5493515308174');
    const { readFileSync } = await import('node:fs');
    const api = readFileSync(new URL('../../wa-service/routes/api.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('/api/send resuelve el destino con destinoDelChat', (api.match(/destinoDelChat\(chat\)/g) || []).length === 2);
    check('/api/send crea el chat también cuando la campaña manda "<num>@c.us" (si no, el envío no se guarda)', api.includes("esTelefono || (esWaIdLegacy && /^\\d{10,15}$/.test(cleanPhone))"));
    const reg = readFileSync(new URL('../../src/lib/seguimientos/registro.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('un envío FALLIDO se puede volver a reclamar en el tick siguiente (no espera a mañana)', reg.includes("resultado: 'FALLIDO' },\n            data: { resultado: 'RECLAMADO'"));
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

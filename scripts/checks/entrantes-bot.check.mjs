/**
 * Qué entrante dispara un turno del bot, y cuándo vuelve el bot a un chat que
 * tomó una persona. Sin base ni red (también en CI).
 *
 *   npm run check:entrantes
 *
 * Por qué (auditoría del 10/10/2026): el contestador del negocio de un cliente
 * ("Hola! Estoy fuera trabajando. Regreso mañana") le programaba al bot un
 * turno entero, y si el chat lo tenía una vendedora, encima lo reactivaba. Y el
 * bot volvía por reloj (3 h) aunque el local estuviera abierto y la vendedora
 * atendiendo. Los casos de acá son mensajes reales.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { clasificarEntrante, disparaTurno, entranteDeFila, filaDisparaTurno, CLASE } = require('../../wa-service/shared/clasificar-entrante.js');
const { decidirVuelta, duenioDelChat, VENTANA_PARA_QUE_CONTESTE_EL_EQUIPO_MIN, HORAS_PARA_VOLVER_FUERA_DE_HORARIO, ANTIGUEDAD_MAXIMA_PARA_VOLVER_H } = require('../../wa-service/shared/duenio-del-chat.js');
const { isBusinessHours } = require('../../wa-service/shared/business-hours.js');

let fallas = 0;
const ok = (m) => console.log(`  ✅ ${m}`);
const mal = (m) => { fallas++; console.log(`  ❌ ${m}`); };
const check = (m, cond) => (cond ? ok(m) : mal(m));
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const txt = (t, ctx) => clasificarEntrante({ type: 'text', text: t }, ctx);

console.log('\nClasificador de entrantes');
const CASOS = [
    // [texto, clase esperada, por qué]
    ['Hola! Estoy fuera trabajando. Regreso mañana', CLASE.AUTO_DEL_CLIENTE, 'contestador del negocio del cliente (caso real)'],
    ['Olá! Estou fora no momento, retornarei amanhã', CLASE.AUTO_DEL_CLIENTE, 'contestador en portugués'],
    ['Este es un mensaje automático. Gracias por escribirnos', CLASE.AUTO_DEL_CLIENTE, 'declara que es automático'],
    ['Bueno gracias', CLASE.REACCION, 'cierre con agradecimiento (caso real)'],
    ['Muchas gracias!! 😊', CLASE.REACCION, 'cierre con emoji'],
    ['👍', CLASE.REACCION, 'solo un emoji, sin pregunta nuestra pendiente'],
    ['mañana paso por el local', CLASE.CONSULTA, 'promesa de visita (caso real)'],
    ['mañana regreso por el local', CLASE.CONSULTA, '"regreso" suelto no es un contestador'],
    ['Estoy fuera de Córdoba, regreso mañana, ¿puedo pasar el lunes?', CLASE.CONSULTA, 'dos señales pero es una pregunta de una persona'],
    ['Estoy de vacaciones, vuelvo el lunes. Cuánto salen los anteojos de sol?', CLASE.CONSULTA, 'habla de lo que vendemos'],
    ['Gracias, y cuánto sale el clip?', CLASE.CONSULTA, 'agradece Y pregunta'],
    ['ok', CLASE.CONSULTA, '"ok" solo puede ser un sí'],
    ['dale', CLASE.CONSULTA, '"dale" solo puede ser un sí'],
    ['hola', CLASE.CONSULTA, 'un saludo es una consulta'],
    ['[Reacción] 👍', CLASE.REACCION, 'reacción guardada como texto'],
    // Un ENTRANTE nunca es nuestro (15/10/2026): aunque el texto se parezca a
    // nuestra bienvenida, lo escribió el cliente (o su comercio).
    ['¡Hola! ¿Cómo podemos ayudarte?', CLASE.CONSULTA, 'parece nuestra bienvenida, pero es entrante: ante la duda, consulta'],
    ['Gracias por tu mensaje! quería saber cuánto salen', CLASE.CONSULTA, 'cliente real que se callaba como "auto_nuestro" (15/10/2026)'],
    ['Estoy de viaje, regreso el lunes y paso a buscarlos', CLASE.CONSULTA, 'cliente real que se callaba como contestador (15/10/2026)'],
    ['Estoy fuera de la ciudad, vuelvo el lunes, quería consultar algo', CLASE.CONSULTA, 'ausencia + regreso + "quería": una persona'],
    ['Gracias por comunicarte con Ferretería Sur. Te responderemos a la brevedad', CLASE.AUTO_DEL_CLIENTE, 'bienvenida de otro comercio con promesa de respuesta'],
];
for (const [t, esperado, porque] of CASOS) {
    const c = txt(t);
    check(`"${t}" → ${esperado} (${porque})${c !== esperado ? ` — dio ${c}` : ''}`, c === esperado);
}
check('"👍" después de una pregunta nuestra ("¿te mando fotos?") ES una respuesta', txt('👍', { ultimoNuestroPregunta: true }) === CLASE.CONSULTA);
check('"auto_nuestro" sale del METADATO (fromMe), no del texto', clasificarEntrante({ type: 'text', text: 'hola', fromMe: true }) === CLASE.AUTO_NUESTRO);
check('fila: una reacción guardada no dispara turno', !filaDisparaTurno({ type: 'TEXT', content: '[Reacción] 👍' }));
check('fila: un sticker guardado como IMAGE no dispara turno', !filaDisparaTurno({ type: 'IMAGE', content: '[Sticker]' }) && entranteDeFila({ type: 'IMAGE', content: '[Sticker]' }).type === 'sticker');
check('fila: lo no soportado no dispara turno', !filaDisparaTurno({ type: 'TEXT', content: '[Mensaje no soportado]' }));
check('fila: un "gracias" de cierre no dispara turno', !filaDisparaTurno({ type: 'TEXT', content: 'Muchas gracias!' }));
check('fila: una foto sí', filaDisparaTurno({ type: 'IMAGE', content: '[Mensaje IMAGE]' }));
check('fila: una pregunta sí', filaDisparaTurno({ type: 'TEXT', content: 'cuánto sale?' }));
check('una foto es consulta aunque no traiga texto', clasificarEntrante({ type: 'image' }) === CLASE.CONSULTA);
check('un audio es consulta', clasificarEntrante({ type: 'audio' }) === CLASE.CONSULTA);
check('un sticker no lo es', clasificarEntrante({ type: 'sticker' }) === CLASE.REACCION);
check('una reacción (objeto) no lo es', clasificarEntrante({ type: 'reaction', reaction: { emoji: '❤️' } }) === CLASE.REACCION);
check('sin tipo se asume texto', clasificarEntrante({ text: 'cuánto sale?' }) === CLASE.CONSULTA);
check('solo la consulta dispara turno', disparaTurno(CLASE.CONSULTA) && !disparaTurno(CLASE.REACCION) && !disparaTurno(CLASE.AUTO_DEL_CLIENTE) && !disparaTurno(CLASE.AUTO_NUESTRO));

console.log('\nLos tres caminos usan el mismo clasificador');
const bc = leer('../../wa-service/bot-cloud.js');
const idx = leer('../../wa-service/index.js');
const auto = leer('../../wa-service/auto-responder.js');
check('bot-cloud.js decide con clasificarEntrante/disparaTurno', bc.includes('clasificarEntrante(msg') && bc.includes('disparaTurno(clase)') && !bc.includes('esConsulta('));
check('index.js (legacy) decide con clasificarEntrante/disparaTurno', idx.includes('clasificarEntrante(') && idx.includes('disparaTurno(claseDelEntrante)'));
check('auto-responder.js decide con clasificarEntrante/disparaTurno', auto.includes('disparaTurno(clasificarEntrante(m))'));

console.log('\nDueño del chat: cuándo vuelve el bot');
// 2026-10-14 es miércoles. Hora de Córdoba (UTC−3).
const art = (iso) => new Date(`${iso}:00.000-03:00`);
const humano = (desde, esperandoDesde) => ({ duenio: 'humano', desde: art(desde), quien: 'Mile', esperandoDesde: esperandoDesde ? art(esperandoDesde) : null });
{
    const d = decidirVuelta({ ...humano('2026-10-14T08:00', '2026-10-14T11:00'), ahora: art('2026-10-14T11:05'), enHorario: isBusinessHours });
    check(`local abierto, el cliente escribió hace 5 min → ESPERA (el equipo tiene ${VENTANA_PARA_QUE_CONTESTE_EL_EQUIPO_MIN} min), aunque la vendedora haya escrito hace 3 h`, d.accion === 'esperar' && d.esperarMs === (VENTANA_PARA_QUE_CONTESTE_EL_EQUIPO_MIN - 5) * 60000);
}
{
    const d = decidirVuelta({ ...humano('2026-10-14T10:50', '2026-10-14T11:00'), ahora: art(`2026-10-14T11:${String(VENTANA_PARA_QUE_CONTESTE_EL_EQUIPO_MIN).padStart(2, '0')}`), enHorario: isBusinessHours });
    check('local abierto y venció la ventana sin respuesta → VUELVE', d.accion === 'volver');
}
{
    const d = decidirVuelta({ ...humano('2026-10-14T11:10', null), ahora: art('2026-10-14T11:30'), enHorario: isBusinessHours });
    check('local abierto y la persona ya contestó (no hay entrante esperando) → NO vuelve', d.accion === 'no');
}
{
    const d = decidirVuelta({ ...humano('2026-10-14T19:00', '2026-10-14T21:00'), ahora: art('2026-10-14T21:00'), enHorario: isBusinessHours });
    check('local cerrado, la persona escribió hace 2 h → todavía no vuelve, pero ESPERA (antes decía "no" y nadie lo retomaba)', d.accion === 'esperar' && d.esperarMs > 0);
}
{
    // El caso de la auditoría del 15/10/2026: viernes 16/10, vendedora 19:00,
    // cliente 19:50. A las 20:10 el local está cerrado y la regla de 3 h decía
    // 'no' — silencio hasta el lunes.
    const d = decidirVuelta({ ...humano('2026-10-16T19:00', '2026-10-16T19:50'), ahora: art('2026-10-16T20:10'), enHorario: isBusinessHours });
    check('el local CERRÓ con el cliente esperando (vie 19:50, vendedora 19:00, son 20:10) → VUELVE, no aplica la regla de 3 h', d.accion === 'volver');
    const antes = decidirVuelta({ ...humano('2026-10-16T19:00', '2026-10-16T19:50'), ahora: art('2026-10-16T19:58'), enHorario: isBusinessHours });
    check('…y a las 19:58, con el local abierto, todavía espera al equipo', antes.accion === 'esperar');
}
{
    const d = decidirVuelta({ ...humano('2026-10-13T10:00', '2026-10-13T10:30'), ahora: art('2026-10-14T11:00'), enHorario: isBusinessHours });
    check(`un mensaje de hace más de ${ANTIGUEDAD_MAXIMA_PARA_VOLVER_H} h no hace volver al bot (nada viejo se contesta)`, d.accion === 'no');
}
{
    const d = decidirVuelta({ ...humano('2026-10-14T19:00', null), ahora: art('2026-10-14T23:30'), enHorario: isBusinessHours });
    check('local cerrado, 3+ h, pero sin entrante esperando → NO vuelve (no hay nada que contestar)', d.accion === 'no');
}
{
    const d = decidirVuelta({ ...humano('2026-10-14T19:00', '2026-10-14T22:30'), ahora: art('2026-10-14T22:30'), enHorario: isBusinessHours });
    check(`local cerrado, ${HORAS_PARA_VOLVER_FUERA_DE_HORARIO}+ h sin una persona → VUELVE (regla vigente)`, d.accion === 'volver');
}
check('chat apagado por otra cosa (sin etiqueta de traspaso) → nunca vuelve solo',
    decidirVuelta({ duenio: 'nadie', desde: null, esperandoDesde: null, ahora: art('2026-10-14T22:30'), enHorario: isBusinessHours }).accion === 'no');
check('bot-cloud.js usa duenioDelChat + decidirVuelta (no una regla propia por reloj)',
    bc.includes('duenioDelChat(prisma, chat)') && bc.includes('decidirVuelta(') && !bc.includes('puedeVolverSolo'));
check('la espera NO vive en memoria (un redeploy la borraba): no hay setTimeout de vuelta', !bc.includes('esperasDeVuelta') && !bc.includes('revisarVuelta'));
check('un barrido periódico retoma los chats desde la base', bc.includes('async function barrerVueltas(') && /setInterval\(\(\) => barrerVueltas\(\)/.test(bc) && /lastInboundAt: \{ gte: desde \}/.test(bc));
check('la reactivación es condicionada (dos instancias no programan dos turnos)', /updateMany\(\{\s*where: \{ id: chat\.id, botEnabled: false \}/.test(bc) && /r\.count !== 1/.test(bc));
check('el barrido no pisa un turno ya programado o corriendo', /debounceTimers\.has\(chat\.id\) \|\| turnosEnCurso\.has\(chat\.id\)/.test(bc));

console.log('\n"Llegó algo nuevo durante el turno": solo lo que dispara turno, y siempre queda uno programado');
check('el control filtra con filaDisparaTurno (un 👍 no tira la respuesta)', /queDisparan = nuevos\.filter\(f => filaDisparaTurno\(f\)\)/.test(bc) && !/whatsAppMessage\.count\(\{\s*where: \{ chatId: chat\.id, direction: 'INBOUND'/.test(bc));
check('si descarta, garantiza un turno programado', /queDisparan\.length > 0\) \{[\s\S]{0,400}programarTurno\(chat,/.test(bc));

console.log('\nduenioDelChat: el que espera es el primer entrante que dispara turno');
{
    const t = (iso) => art(iso);
    const filas = {
        humano: { createdAt: t('2026-10-14T10:00'), senderName: 'Mile' },
        entrantes: [
            { createdAt: t('2026-10-14T10:05'), type: 'TEXT', content: '[Reacción] 👍' },
            { createdAt: t('2026-10-14T10:06'), type: 'TEXT', content: 'gracias!' },
            { createdAt: t('2026-10-14T11:00'), type: 'TEXT', content: 'y cuánto sale el clip?' },
        ],
    };
    const prismaFalso = { whatsAppMessage: {
        findFirst: async () => filas.humano,
        findMany: async () => filas.entrantes,
    } };
    const { ETIQUETA_BOT_APAGADO } = require('../../wa-service/shared/traspaso-humano.js');
    const d2 = await duenioDelChat(prismaFalso, { id: 'c1', botEnabled: false, chatLabels: [ETIQUETA_BOT_APAGADO] });
    check('una reacción y un "gracias" viejos no arrancan el reloj: espera desde la pregunta de las 11:00',
        d2.duenio === 'humano' && d2.esperandoDesde && d2.esperandoDesde.getTime() === t('2026-10-14T11:00').getTime() && d2.esperando.content.includes('cuánto'));
}

console.log('\nCandado por chat: nunca dos turnos a la vez');
check('hay un Set de turnos en curso', bc.includes('const turnosEnCurso = new Set()'));
check('un entrante con turno corriendo se reprograma', /if \(turnosEnCurso\.has\(chat\.id\)\) \{[\s\S]{0,200}programarTurno\(chat, msg, REINTENTO_CON_TURNO_EN_CURSO_MS\)/.test(bc));
check('el candado se suelta siempre (finally)', /\.finally\(\(\) => turnosEnCurso\.delete\(chat\.id\)\)/.test(bc));

console.log('');
if (fallas) { console.log(`❌ ${fallas} falla(s).`); process.exit(1); }
console.log('✅ Entrantes y dueño del chat en orden.');

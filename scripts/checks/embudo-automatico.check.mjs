// ────────────────────────────────────────────────────────────────────────────
// EL EMBUDO NO TIENE NADA PARA UNA PERSONA (Ishtar, 8/10/2026).
//
// Fija las tres cosas que lo hacen automático de punta a punta:
//   1. el playbook nunca devuelve un paso vencido que no sea una plantilla (la
//      manda el motor) o un `cerrar` (lo ejecuta el motor): ni "cotizar" ni
//      "decidir" son "para hoy";
//   2. la charla SIN presupuesto sigue la misma cadencia de tres toques que la
//      que tiene presupuesto, y después se cierra sola;
//   3. la respuesta del cliente se lee: "no" cierra, "más adelante" pausa, un
//      👍 o un "gracias" no frenan nada.
//
// Puro: sin base y sin red. Corre en CI.
//   node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/checks/embudo-automatico.check.mjs
// ────────────────────────────────────────────────────────────────────────────
import { proximaAccion, ordenarPorUrgencia, CIERRE_TRAS_ULTIMO_TOQUE_DIAS, DIAS_MAX_CIERRE_AUTOMATICO } from '../../src/lib/embudo/playbook.ts';
import { classifyLead, VENTANA_EMBUDO_DIAS } from '../../src/lib/leads-pipeline.ts';
import { clasificarRespuesta, clasificarMensaje, respuestasAlToque, VENTANA_RESPUESTA_HORAS } from '../../src/lib/embudo/respuesta.ts';
import { presupuestoFueEnviado } from '../../src/lib/embudo/presupuesto-enviado.ts';

let ok = 0; const fallas = [];
const check = (nombre, cond, extra = '') => { if (cond) { ok++; console.log(`  ✓ ${nombre}`); } else { fallas.push(nombre); console.log(`  ✗ ${nombre} ${extra}`); } };

const NOW = new Date('2026-10-08T15:00:00.000Z').getTime();
const D = 86400e3, H = 3600e3;
const hace = (d) => new Date(NOW - d * D);

/** Arma la entrada del playbook como lo hace embudo.service: classifyLead + datos del lead. */
function accion({ presupuestoHace = null, altaHace = 1, labels = [], humanoHace = null, receta = false, chat = true, visito = false, ultimoToqueHace = null, borrador = null, actividadHace = null }) {
    const quoteCreatedAt = presupuestoHace == null ? null : hace(presupuestoHace);
    const { stage, escalonCubierto, cubiertoHasta } = classifyLead({ quoteCreatedAt, hasPrescription: receta, chatLabels: labels, tagNames: [], ultimoMensajeHumano: humanoHace == null ? null : hace(humanoHace), now: NOW });
    return proximaAccion({ stage, escalonCubierto, cubiertoHasta, quoteCreatedAt, borradorSinEnviar: borrador, createdAt: hace(altaHace), hasPrescription: receta, visitoElLocal: visito, tieneChat: chat, chatLabels: labels, ultimoToqueAt: ultimoToqueHace == null ? null : hace(ultimoToqueHace), ultimaActividadAt: actividadHace == null ? null : hace(actividadHace), now: NOW });
}
const es = (a, tipo, plantilla) => a.tipo === tipo && (plantilla === undefined || a.plantilla === plantilla);
const txt = (a) => `(${a.tipo}${a.plantilla ? ' ' + a.plantilla : ''}${a.vencida ? ', vencida' : ''}: "${a.etiqueta}")`;

console.log('\nCon presupuesto: la cadencia de siempre, y al final cierra solo');
let a;
a = accion({ presupuestoHace: 0.4 }); check('10 h: esperar', es(a, 'esperar') && !a.vencida, txt(a));
a = accion({ presupuestoHace: 3 }); check('3 días, nadie escribió: 1er toque', es(a, 'plantilla', 'seguimiento_presupuesto') && a.vencida, txt(a));
a = accion({ presupuestoHace: 3, labels: ['SEGUIMIENTO_DIA_1'] }); check('3 días con DIA_1: esperar al día 4', es(a, 'esperar'), txt(a));
a = accion({ presupuestoHace: 6, labels: ['SEGUIMIENTO_DIA_1'] }); check('6 días solo DIA_1: invitar al local', es(a, 'plantilla', 'invitacion_local_v4') && a.vencida, txt(a));
a = accion({ presupuestoHace: 6, labels: ['SEGUIMIENTO_DIA_1'], visito: true }); check('6 días, ya vino: no se lo invita, espera al día 15', es(a, 'esperar'), txt(a));
a = accion({ presupuestoHace: 20, labels: ['SEGUIMIENTO_DIA_1'] }); check('20 días con solo DIA_1: toca el 2º (en orden, no el último)', es(a, 'plantilla', 'invitacion_local_v4'), txt(a));
a = accion({ presupuestoHace: 20, labels: ['SEGUIMIENTO_DIA_1', 'SEGUIMIENTO_DIA_4'] }); check('20 días con DIA_4: último toque', es(a, 'plantilla', 'ultimo_seguimiento') && a.vencida, txt(a));
a = accion({ presupuestoHace: 20, labels: ['SEGUIMIENTO_DIA_1', 'SEGUIMIENTO_DIA_4', 'SEGUIMIENTO_DIA_15'], ultimoToqueHace: 2 }); check(`último toque hace 2 días: esperar (cierra a los ${CIERRE_TRAS_ULTIMO_TOQUE_DIAS})`, es(a, 'esperar') && !a.vencida, txt(a));
a = accion({ presupuestoHace: 24, labels: ['SEGUIMIENTO_DIA_1', 'SEGUIMIENTO_DIA_4', 'SEGUIMIENTO_DIA_15'], ultimoToqueHace: 8 }); check('último toque hace 8 días, sin respuesta: CERRAR (antes: "Definir ganado o perdido" para una persona)', es(a, 'cerrar') && a.vencida, txt(a));
a = accion({ presupuestoHace: 24, labels: ['SEGUIMIENTO_DIA_1', 'SEGUIMIENTO_DIA_4', 'SEGUIMIENTO_DIA_15'], ultimoToqueHace: 8, actividadHace: 2 }); check('último toque hace 8 días pero el cliente (o Matías) escribió hace 2: NO se cierra, la venta está viva', es(a, 'esperar') && !a.vencida, txt(a));
a = accion({ presupuestoHace: 45, labels: ['SEGUIMIENTO_DIA_1', 'SEGUIMIENTO_RETOME'], ultimoToqueHace: 10, actividadHace: 1 }); check('retome hace 10 días pero hablaron ayer: NO se cierra', es(a, 'esperar'), txt(a));
a = accion({ presupuestoHace: 45, labels: ['SEGUIMIENTO_DIA_1'] }); check(`${VENTANA_EMBUDO_DIAS}+ días sin retome: ÚLTIMO INTENTO con retomar_con_cupon (Ishtar: "quiero intentar cerrarlos")`, es(a, 'plantilla', 'retomar_con_cupon') && a.vencida, txt(a));
a = accion({ presupuestoHace: 45, labels: ['SEGUIMIENTO_DIA_1', 'SEGUIMIENTO_RETOME'], ultimoToqueHace: 2 }); check('45 días, retome hace 2 días: esperar', es(a, 'esperar') && !a.vencida, txt(a));
a = accion({ presupuestoHace: 45, labels: ['SEGUIMIENTO_DIA_1', 'SEGUIMIENTO_RETOME'], ultimoToqueHace: 8 }); check('45 días, retome hace 8 días sin respuesta: CERRAR', es(a, 'cerrar') && a.vencida, txt(a));
a = accion({ presupuestoHace: 45, chat: false }); check('45 días sin chat: nada que intentar, CERRAR', es(a, 'cerrar') && a.vencida, txt(a));
a = accion({ presupuestoHace: 200 }); check(`${DIAS_MAX_CIERRE_AUTOMATICO}+ días: fuera del embudo, no se toca`, es(a, 'esperar') && !a.vencida, txt(a));
a = accion({ presupuestoHace: 6, humanoHace: 1 }); check('una persona le escribió ayer (día 5): el toque NO se da por hecho; el 1º sigue debiéndose (la compuerta de 48 h lo demora, no lo borra)', es(a, 'plantilla', 'seguimiento_presupuesto') && a.vencida, txt(a));

console.log('\nSin presupuesto: MISMA cadencia desde el alta (antes: un toque y "Falta cotizar" para una persona)');
a = accion({ altaHace: 1 }); check('1 día: "Falta cotizar" informa, NO vence', es(a, 'cotizar') && !a.vencida, txt(a));
a = accion({ altaHace: 1, borrador: hace(0.5) }); check('presupuesto armado y nunca enviado: informa, NO vence', es(a, 'cotizar') && !a.vencida, txt(a));
a = accion({ altaHace: 3 }); check('3 días sin receta: retomar la charla (sin receta)', es(a, 'plantilla', 'seguimiento_lentes_sin_receta') && a.vencida, txt(a));
a = accion({ altaHace: 3, receta: true }); check('3 días con receta: retomar la charla (con receta)', es(a, 'plantilla', 'seguimiento_lentes_con_receta') && a.vencida, txt(a));
a = accion({ altaHace: 3, labels: ['SEGUIMIENTO_DIA_1'] }); check('3 días ya retomada: esperar al día 4 (antes: "Falta cotizar")', es(a, 'esperar'), txt(a));
a = accion({ altaHace: 6, labels: ['SEGUIMIENTO_DIA_1'] }); check('6 días con DIA_1: invitar al local', es(a, 'plantilla', 'invitacion_local_v4') && a.vencida, txt(a));
a = accion({ altaHace: 20, labels: ['SEGUIMIENTO_DIA_1', 'SEGUIMIENTO_DIA_4'] }); check('20 días con DIA_4: último toque', es(a, 'plantilla', 'ultimo_seguimiento') && a.vencida, txt(a));
a = accion({ altaHace: 25, labels: ['SEGUIMIENTO_DIA_1', 'SEGUIMIENTO_DIA_4', 'SEGUIMIENTO_DIA_15'], ultimoToqueHace: 8 }); check('último toque hace 8 días: CERRAR', es(a, 'cerrar') && a.vencida, txt(a));
a = accion({ altaHace: 10, chat: false }); check('sin chat: nada que mandar, espera al cierre del día 30', es(a, 'esperar') && !a.vencida, txt(a));
a = accion({ altaHace: 40, chat: false }); check('sin chat, 40 días: CERRAR', es(a, 'cerrar') && a.vencida, txt(a));
a = accion({ altaHace: 40 }); check('sin presupuesto, 40 días, con chat: último intento', es(a, 'plantilla', 'retomar_con_cupon'), txt(a));

console.log('\nOrden del día: la cadencia primero, los últimos intentos después y del más nuevo al más viejo');
{
    const item = (o, stage = 'seguimiento1') => ({ proximaAccion: accion(o), stage });
    const lista = ordenarPorUrgencia([item({ presupuestoHace: 100, labels: ['SEGUIMIENTO_DIA_1'] }), item({ presupuestoHace: 35, labels: ['SEGUIMIENTO_DIA_1'] }), item({ presupuestoHace: 3 }), item({ presupuestoHace: 0.4 })]);
    check('1º el toque de la cadencia, 2º el retome de 35 días, 3º el de 100, último lo que no vence',
        lista[0].proximaAccion.plantilla === 'seguimiento_presupuesto' && lista[1].proximaAccion.etiqueta.includes('35 días') && lista[2].proximaAccion.etiqueta.includes('100 días') && !lista[3].proximaAccion.vencida,
        lista.map(x => x.proximaAccion.etiqueta).join(' | '));
}

console.log('\nEl presupuesto cuenta como entregado si...');
check('...hay nota de PDF posterior', presupuestoFueEnviado({ quoteCreatedAt: hace(3), pdfEnviadoAt: hace(2.9), ultimoMensajeHumano: null }));
check('...una persona le escribió después', presupuestoFueEnviado({ quoteCreatedAt: hace(3), pdfEnviadoAt: null, ultimoMensajeHumano: hace(2) }));
check('...vino al local DESPUÉS de armarlo (se lo mostraron en el mostrador)', presupuestoFueEnviado({ quoteCreatedAt: hace(3), pdfEnviadoAt: null, ultimoMensajeHumano: null, visitaAt: hace(2) }));
check('...pero una visita de hace meses NO prueba este presupuesto', !presupuestoFueEnviado({ quoteCreatedAt: hace(3), pdfEnviadoAt: null, ultimoMensajeHumano: null, visitaAt: hace(90) }));
check('...y sin ninguna prueba, no', !presupuestoFueEnviado({ quoteCreatedAt: hace(3), pdfEnviadoAt: null, ultimoMensajeHumano: null }));

console.log('\nNingún paso vencido es de una persona');
{
    const casos = [];
    for (const p of [null, 1, 3, 5, 10, 16, 25, 35, 100]) for (const labels of [[], ['SEGUIMIENTO_DIA_1'], ['SEGUIMIENTO_DIA_1', 'SEGUIMIENTO_DIA_4'], ['SEGUIMIENTO_DIA_1', 'SEGUIMIENTO_DIA_4', 'SEGUIMIENTO_DIA_15']]) for (const chat of [true, false]) for (const u of [null, 1, 10])
        casos.push(accion({ presupuestoHace: p, altaHace: p ?? 12, labels, chat, ultimoToqueHace: u }));
    const malos = casos.filter(c => c.vencida && c.tipo !== 'plantilla' && c.tipo !== 'cerrar');
    check(`en ${casos.length} combinaciones, todo lo vencido es plantilla o cierre`, malos.length === 0, JSON.stringify(malos.slice(0, 3)));
    check('"decidir" ya no existe como tipo', !casos.some(c => c.tipo === 'decidir'));
}

console.log('\nLa respuesta del cliente se lee');
const r = (t) => clasificarMensaje({ content: t, type: 'TEXT' }, { primera: true });
for (const [t, esperado] of [
    ['Gracias', 'seguir'], ['Ok gracias', 'seguir'], ['👍', 'seguir'], ['[Reacción] 👍', 'seguir'], ['Si claro', 'seguir'], ['Bien', 'seguir'],
    ['Hola como estas. Si. Lo vi. Pero me pasaron presupuesto de otra óptica más barato', 'cierre'],
    ['No.muchas gracias.', 'cierre'], ['No', 'cierre'], ['No te agradezco', 'cierre'], ['no me interesa', 'cierre'],
    ['No me pasaron presupuesto. Ya compre en otra optica. Saludos', 'cierre'],
    ['Hola .. gracias, conseguí hacerlos x Pami', 'cierre'],
    ['Buenas tardes.. no, no esta dentro del presupuesto previsto,, veo otras opciones, gracias', 'cierre'],
    ['por favor no me escriban más', 'cierre'],
    ['Buen día si los vi gracias🙏💕 debo esperar cobrar', 'posponer'],
    ['por ahora no, gracias, en todo caso me vuelvo a comunicar', 'posponer'],
    ['Muchísimas gracias cualquier cosa les escribo por ahora sigo viendo', 'posponer'],
    ['En el momento que decida veo . Gracias', 'seguir'],
    ['¿Cuánto salen los de sol?', 'seguir'],
]) check(`"${t.slice(0, 50)}" → ${esperado}`, r(t) === esperado, `(dio ${r(t)})`);
check('"No" pelado en la PRIMERA burbuja es cierre', clasificarRespuesta([{ content: 'No' }, { content: 'gracias' }]) === 'cierre');
check('"No" pelado más adelante (contesta al bot) NO es cierre', clasificarRespuesta([{ content: 'Si tengo receta' }, { content: 'No' }, { content: 'Con una intermedia estaría bien' }]) === 'seguir');
check('"¿Atienden por obra social?" es una pregunta: seguir', r('Atienden por obra social') === 'seguir');
check('"ya tengo los marcos, pasame presupuesto": seguir', r('Pásame presupuesto tengo 1.75 en cada ojo y ya tengo los marcos') === 'seguir');
check('"ya realicé mis lentes en otro lugar": cierre', r('Hola gracias por la información. Ya realicé mis lentes en otro lugar') === 'cierre');
check('una pregunta con un "no" adentro es seguir', r('No trabajan con obra social? Y que calidad de cristal?') === 'seguir');
check('una pregunta después de "ya compré" sigue siendo cierre', r('Ya compré en otro lado, ¿igual me mandan el catálogo?') === 'cierre');
check('"me hice por pami y no me sirven, quiero precio": seguir (pide precio)', r('Me hice por pami de cerca y de lejos y.no.me sirven. Quiero precio de.multifocales y cuotas') === 'seguir');
check('"por el momento no voy a comprar": posponer, no cierre', r('si lo vi al presupuesto, por el momento no voy a comprar por qué surgieron otros gastos. Gracias') === 'posponer');
{
    const toque = new Date('2026-09-01T12:00:00Z');
    const m = (d, content) => ({ createdAt: new Date(toque.getTime() + d * D), content });
    const suyos = respuestasAlToque([m(-1, 'antes'), m(1, 'Gracias'), m(1.5, 'ok'), m(20, 'Ya compré')], toque);
    check(`solo cuenta la primera ráfaga de respuesta (${VENTANA_RESPUESTA_HORAS} h desde que empezó a contestar): un "ya compré" de semanas después no cierra`, suyos.length === 2 && suyos[1].content === 'ok');
    const tardio = respuestasAlToque([m(10, 'No, gracias'), m(10.5, 'saludos')], toque);
    check('contestó a los 10 días: esa respuesta SÍ se lee (la ventana arranca cuando él arranca)', tardio.length === 2 && clasificarRespuesta(tardio) === 'cierre');
}
check('"no sigas insistiendo" es cierre aunque antes haya dicho "te aviso"', clasificarRespuesta([{ content: 'Quiero tenerte para cuando pueda, te aviso' }, { content: 'Hola, porfavor no sigas insistiendo' }]) === 'cierre');
check('botón "Ahora no" → posponer', r('Ahora no') === 'posponer');
check('botón "¡Sí, quiero mi descuento!" → seguir (y el motor reserva el 10 %)', r('¡Sí, quiero mi descuento!') === 'seguir');
check('un audio es seguir', clasificarMensaje({ content: '[Mensaje audio]', type: 'AUDIO' }) === 'seguir');
check('tres burbujas, una dice que no: cierre', clasificarRespuesta([{ content: '👍' }, { content: 'No, gracias' }, { content: 'saludos' }]) === 'cierre');
check('"más adelante" + "gracias": posponer', clasificarRespuesta([{ content: 'gracias' }, { content: 'más adelante veo' }]) === 'posponer');
check('nada contestado: seguir', clasificarRespuesta([]) === 'seguir');

console.log(`\n${ok} ok, ${fallas.length} fallas`);
if (fallas.length) { console.log('FALLAS:', fallas.join(' · ')); process.exit(1); }

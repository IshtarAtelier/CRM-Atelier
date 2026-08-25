// ────────────────────────────────────────────────────────────────────────────
// MENSAJERÍA INTERNA: que nadie lea lo que no es suyo.
//
// La regla que protege este check es la más importante del módulo: se ve una
// conversación si y solo si sos participante. Vive en un único lugar del
// service (`assertParticipante`), y por eso mismo es frágil — alcanza con que
// alguien agregue una consulta que no pase por ahí para abrir los mensajes de
// todo el equipo, sin que falle ningún typecheck ni ningún build.
//
// De paso verifica lo que se rompe en silencio: los no leídos (que en el
// sistema viejo directamente no existían), los urgentes y la presencia.
//
// Corre contra la base LOCAL. Crea y borra sus propios datos.
// Correr:  npm run check:mensajeria
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { InternalMessagingService as S } from '../../src/services/internal-messaging.service.ts';

const prisma = new PrismaClient();
let ok = 0;
const fallas = [];
const check = (nombre, cond, extra = '') => {
    if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
    else { fallas.push(nombre); console.log(`  ✗ ${nombre} ${extra}`); }
};

const MARCA = 'CHECK_MSG_';

/** Borra todo lo que crea este check (y lo de corridas anteriores que hayan fallado). */
async function limpiar() {
    // Repara el rol del Asistente si una corrida anterior murió a mitad de la
    // prueba de usurpación (ver el `finally` de más abajo).
    await prisma.user.updateMany({
        where: { email: S.IA_EMAIL, role: { not: 'SISTEMA' } },
        data: { role: 'SISTEMA' },
    }).catch(() => {});

    const users = await prisma.user.findMany({
        where: { email: { startsWith: MARCA } }, select: { id: true },
    });
    const ids = users.map(u => u.id);
    if (ids.length === 0) return;
    const threads = await prisma.internalThread.findMany({
        where: { participants: { some: { userId: { in: ids } } } }, select: { id: true },
    });
    const tIds = threads.map(t => t.id);
    // Los mensajes primero: la relación es Restrict a propósito (una conversación
    // de trabajo no se borra en cascada por accidente), así que hay que sacarlos
    // a mano antes que el hilo.
    await prisma.internalMessage.deleteMany({ where: { threadId: { in: tIds } } });
    await prisma.internalThreadParticipant.deleteMany({ where: { threadId: { in: tIds } } });
    await prisma.internalThread.deleteMany({ where: { id: { in: tIds } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

console.log('\n— Mensajería interna: privacidad, no leídos, urgentes y presencia —\n');
await limpiar();

const crearUser = (sufijo, role = 'STAFF') => prisma.user.create({
    data: { email: `${MARCA}${sufijo}@test.local`, name: `${MARCA}${sufijo}`, password: 'x', role },
    select: { id: true, name: true },
});

const ana = await crearUser('Ana');
const beto = await crearUser('Beto');
const carla = await crearUser('Carla');            // tercera en discordia: NO participa
const optica = await crearUser('OpticaMayor', 'OPTICA'); // cliente, no colaboradora

// Beto le escribe a Ana: un urgente y uno normal.
const { id: threadId } = await S.crearConversacion({
    creadorId: beto.id, paraIds: [ana.id], primerMensaje: 'Se rompió la impresora.', urgent: true,
});
await S.responder({ threadId, senderId: beto.id, body: 'Ya llamé al técnico.' });

check('la conversación aparece en la bandeja de Ana', (await S.bandeja(ana.id)).some(c => c.id === threadId));
check('Ana tiene 2 sin leer', (await S.contarNoLeidos(ana.id)) === 2, `(dio ${await S.contarNoLeidos(ana.id)})`);
check('quien escribió no se cuenta a sí mismo', (await S.contarNoLeidos(beto.id)) === 0);

const urgentes = await S.urgentesPendientes(ana.id);
check('Ana tiene 1 urgente pendiente', urgentes.length === 1, `(dio ${urgentes.length})`);
check('el urgente dice quién lo mandó', urgentes[0]?.senderName === beto.name);
check('el segundo mensaje NO es urgente', urgentes.every(u => !u.body.includes('técnico')));

// ── PRIVACIDAD: lo que este check existe para proteger ──
//
// Carla necesita una conversación PROPIA antes de estas pruebas. Sin ella,
// `filtroNoLeidos` corta en su early-return («no participa de nada») y los dos
// checks de abajo miden "Carla no tiene conversaciones" en vez de "el filtro la
// excluye de la de Ana y Beto": una regresión que rompiera el filtro por
// threadId seguiría dando verde.
const jefa = await crearUser('Jefa', 'ADMIN');
await S.crearConversacion({ creadorId: jefa.id, paraIds: [carla.id], primerMensaje: 'algo propio de Carla' });

let bloqueada = false;
try { await S.leerConversacion(threadId, carla.id); } catch { bloqueada = true; }
check('un tercero NO puede leer la conversación', bloqueada);
check('y no le aparece en su bandeja', (await S.bandeja(carla.id)).every(c => c.id !== threadId));
check('ni le cuenta como no leída (teniendo ella otras conversaciones)',
    (await S.bandeja(carla.id)).every(c => c.id !== threadId));
check('ni le llega el urgente', (await S.urgentesPendientes(carla.id)).every(u => u.threadId !== threadId));

// La frase del encabezado del service — "ni un ADMIN lee los mensajes ajenos" —
// era la única regla elevada a principio que NINGÚN check sostenía.
let adminBloqueada = false;
try { await S.leerConversacion(threadId, jefa.id); } catch { adminBloqueada = true; }
check('un ADMIN tampoco lee una conversación de la que no participa', adminBloqueada);
check('ni le aparece en su bandeja', (await S.bandeja(jefa.id)).every(c => c.id !== threadId));

let bloqueadaEscritura = false;
try { await S.responder({ threadId, senderId: carla.id, body: 'me cuelo' }); } catch { bloqueadaEscritura = true; }
check('un tercero tampoco puede ESCRIBIR en ella', bloqueadaEscritura);

// ── Leer apaga el contador y el urgente ──
await S.leerConversacion(threadId, ana.id);
check('tras leer, no leídos = 0', (await S.contarNoLeidos(ana.id)) === 0);
check('tras leer, el urgente deja de gritar', (await S.urgentesPendientes(ana.id)).length === 0);

// ── El directo se reusa, no se abre uno nuevo por mensaje ──
await S.crearConversacion({ creadorId: beto.id, paraIds: [ana.id], primerMensaje: 'Otra cosa más.' });
const directos = (await S.bandeja(ana.id)).filter(c => c.participantes.some(p => p.id === beto.id));
check('un segundo mensaje reusa el mismo hilo', directos.length === 1, `(dio ${directos.length})`);

// ── Copia: ve todo, pero marcado como copia ──
const { id: conCopia } = await S.crearConversacion({
    creadorId: beto.id, paraIds: [ana.id], copiaIds: [carla.id],
    subject: 'Con copia', primerMensaje: 'Ojo con esto.',
});
check('quien está en copia SÍ la ve', (await S.bandeja(carla.id)).some(c => c.id === conCopia));
check('y figura como copia', (await S.bandeja(carla.id)).find(c => c.id === conCopia)?.miRol === 'CC');

// ── Las cuentas de óptica mayorista no son destinatarios posibles ──
await S.usuarioIA(); // si no existe, la aserción de abajo pasaría por vacío
const colabs = await S.listarColaboradores(ana.id);
check('una cuenta OPTICA no aparece en el selector', colabs.every(c => c.id !== optica.id));
check('la IA tampoco aparece', colabs.every(c => c.name !== S.IA_NOMBRE));

let rechazada = false;
try { await S.crearConversacion({ creadorId: ana.id, paraIds: [optica.id], primerMensaje: 'hola' }); }
catch { rechazada = true; }
check('y el servidor rechaza escribirle aunque se fuerce el pedido', rechazada);

// ── Presencia ──
check('sin latido no figura en línea', !(await S.enLinea()).includes(ana.id));
await S.latido(ana.id);
check('con latido figura en línea', (await S.enLinea()).includes(ana.id));

// Que el verde SE APAGUE es lo que hay que vigilar: mostrar "en línea" a quien
// cerró todo hace media hora es peor que no mostrar nada, porque lleva a
// esperar una respuesta que no va a llegar. Se simula un latido viejo.
await prisma.user.update({
    where: { id: ana.id },
    data: { lastSeenAt: new Date(Date.now() - 5 * 60 * 1000) },
});
check('un latido de hace 5 minutos ya NO cuenta como en línea', !(await S.enLinea()).includes(ana.id));

// Y que tolere una falla puntual de red: a los 40 s (dos latidos perdidos)
// tiene que seguir en verde, si no el puntito parpadea todo el tiempo.
await prisma.user.update({
    where: { id: ana.id },
    data: { lastSeenAt: new Date(Date.now() - 40 * 1000) },
});
check('un latido de hace 40 s sigue contando (tolera fallas de red)', (await S.enLinea()).includes(ana.id));

// ── Lo que encontró la auditoría del 22/8/2026 ──────────────────────────────
// Cada uno de estos era un bug real que pasaba typecheck, lint y los 23 checks
// anteriores sin decir nada.

// El urgente tiene que llegar MARCADO hasta la pantalla. Faltaba `urgent` en el
// select: ningún mensaje se veía nunca como urgente dentro de la conversación.
const { id: hiloU } = await S.crearConversacion({
    creadorId: beto.id, paraIds: [carla.id], primerMensaje: 'Urgente de verdad', urgent: true,
});
const leidoU = await S.leerConversacion(hiloU, carla.id);
check('el mensaje llega con su marca de urgente', leidoU.mensajes[0]?.urgent === true);

// Leer una PÁGINA VIEJA no puede marcar leído el hilo entero, y leer no puede
// marcar como visto un mensaje que no vino en la respuesta.
await S.responder({ threadId: hiloU, senderId: beto.id, body: 'posterior' });
const antesDe = new Date(leidoU.mensajes[0].createdAt);
await S.leerConversacion(hiloU, carla.id, { antesDe });
const sinLeerEnHilo = async (uid, hid) => (await S.bandeja(uid)).find(c => c.id === hid)?.noLeidos ?? -1;
check('leer una página vieja NO marca leído lo nuevo', (await sinLeerEnHilo(carla.id, hiloU)) === 1,
    `(dio ${await sinLeerEnHilo(carla.id, hiloU)})`);

// Quien entra después no ve lo que se dijo antes.
await S.leerConversacion(hiloU, carla.id);
await S.agregarParticipante({ threadId: hiloU, porUserId: beto.id, nuevoUserId: ana.id });
const loDeAna = await S.leerConversacion(hiloU, ana.id);
check('quien se suma DESPUÉS no ve el historial previo', loDeAna.mensajes.length === 0,
    `(vio ${loDeAna.mensajes.length})`);

// Agregar "en copia" a alguien que ya era destinatario no puede degradarlo.
await S.agregarParticipante({ threadId: hiloU, porUserId: beto.id, nuevoUserId: carla.id, role: 'CC' });
const rolCarla = (await S.bandeja(carla.id)).find(c => c.id === hiloU)?.miRol;
check('agregar en copia NO degrada a quien ya participaba', rolCarla === 'MEMBER', `(quedó ${rolCarla})`);

// Dos personas escribiéndose a la vez no pueden crear dos hilos uno-a-uno.
//
// CON USUARIOS FRESCOS, sí o sí. Antes usaba a Ana y Beto, que YA tenían hilo
// desde el principio del script: las dos llamadas lo encontraban por el camino
// trivial y ni el constraint único, ni el P2002, ni el catch — o sea nada de lo
// que el check dice cubrir — llegaban a ejecutarse. Pasaba con el constraint
// borrado. Era el test de la invariante más difícil del módulo y no probaba nada.
const eze = await crearUser('Eze');
const flor = await crearUser('Flor');
const [r1, r2] = await Promise.all([
    S.crearConversacion({ creadorId: eze.id, paraIds: [flor.id], primerMensaje: 'simultáneo A' }),
    S.crearConversacion({ creadorId: flor.id, paraIds: [eze.id], primerMensaje: 'simultáneo B' }),
]);
check('dos envíos simultáneos NO crean dos hilos', r1.id === r2.id, `(${r1.id} vs ${r2.id})`);
const hilosEze = (await S.bandeja(eze.id)).filter(c => c.participantes.some(p => p.id === flor.id));
check('y queda UNO solo en la bandeja de los dos', hilosEze.length === 1, `(dio ${hilosEze.length})`);

// El Asistente reusa un solo hilo y no repite el mismo resumen dos veces.
await S.mensajeDeIA({ paraUserId: ana.id, cuerpo: '📋 Tu resumen del lunes\nalgo', dedupePrefijo: '📋 Tu resumen del lunes' });
const dup = await S.mensajeDeIA({ paraUserId: ana.id, cuerpo: '📋 Tu resumen del lunes\nalgo', dedupePrefijo: '📋 Tu resumen del lunes' });
check('el resumen del día no se manda dos veces', dup === null);
await S.mensajeDeIA({ paraUserId: ana.id, cuerpo: '📋 Tu resumen del martes\notro', dedupePrefijo: '📋 Tu resumen del martes' });
const hilosIA = (await S.bandeja(ana.id)).filter(c => c.participantes.some(p => p.name === S.IA_NOMBRE));
check('el del día siguiente SÍ sale, y en el mismo hilo', hilosIA.length === 1);

// La cuenta del Asistente no se puede secuestrar. Se simula degradándole el rol:
// si `usuarioIA()` solo mirara el email, devolvería igual esa cuenta y el
// Asistente pasaría a escribir DESDE ella.
const iaReal = await prisma.user.findUnique({ where: { email: S.IA_EMAIL }, select: { id: true } });
if (iaReal) {
    // `finally` OBLIGATORIO: si algo entre medio lanza, el Asistente queda como
    // STAFF, `limpiar()` no lo toca (su email no lleva la marca del check) y
    // TODA corrida futura muere en `usuarioIA()`. El check quedaría trabado en
    // rojo para siempre por una cuenta que nadie sabría que hay que arreglar.
    let rechazo = false;
    try {
        await prisma.user.update({ where: { id: iaReal.id }, data: { role: 'STAFF' } });
        try { await S.usuarioIA(); } catch { rechazo = true; }
    } finally {
        await prisma.user.update({ where: { id: iaReal.id }, data: { role: 'SISTEMA' } });
    }
    check('una cuenta que no es del sistema NO puede usurpar al Asistente', rechazo);
} else {
    check('una cuenta que no es del sistema NO puede usurpar al Asistente', false, '(no se pudo probar)');
}

// ── Ronda 2 de la auditoría: regresiones de los arreglos de la ronda 1 ───────
// El corte de historial se había aplicado en UNO de tres lugares. Estos tres
// checks cubren los otros dos, más una regresión que rompía el constraint nuevo.

const dani = await crearUser('Dani');
const { id: hiloViejo } = await S.crearConversacion({
    creadorId: beto.id, paraIds: [ana.id], subject: 'Charla previa',
    primerMensaje: 'Algo confidencial de antes', urgent: true,
});
await S.responder({ threadId: hiloViejo, senderId: beto.id, body: 'Más de lo mismo' });

// Dani entra DESPUÉS de esos dos mensajes.
await S.agregarParticipante({ threadId: hiloViejo, porUserId: beto.id, nuevoUserId: dani.id });

const sinLeerDani = (await S.bandeja(dani.id)).find(c => c.id === hiloViejo)?.noLeidos;
check('el badge NO cuenta los mensajes anteriores al alta', sinLeerDani === 0, `(dio ${sinLeerDani})`);

const previaDani = (await S.bandeja(dani.id)).find(c => c.id === hiloViejo)?.ultimoMensaje;
check('la vista previa NO filtra el texto que el hilo oculta', previaDani === null,
    `(mostró "${previaDani?.body ?? ''}")`);

check('un urgente anterior al alta NO le tapa la pantalla',
    (await S.urgentesPendientes(dani.id)).every(u => u.threadId !== hiloViejo));

// Agregar a alguien que YA está activo no puede romper el hilo uno-a-uno.
const { id: directo } = await S.crearConversacion({
    creadorId: ana.id, paraIds: [carla.id], primerMensaje: 'uno a uno',
});
await S.agregarParticipante({ threadId: directo, porUserId: ana.id, nuevoUserId: carla.id, role: 'CC' });
const traíDeNuevo = await S.crearConversacion({
    creadorId: ana.id, paraIds: [carla.id], primerMensaje: 'segundo mensaje',
});
check('agregar a quien ya participa NO parte la conversación en dos',
    traíDeNuevo.id === directo, `(${traíDeNuevo.id} vs ${directo})`);

// ── Ronda 3: el asunto también es contenido, y el historial tiene que alcanzarse ──

// El ASUNTO era el cuarto lugar por donde se filtraba lo que el corte oculta:
// tapar los mensajes de "Aumento de sueldo de Matías" pero mostrar ese título en
// la lista no tapa nada.
const { id: hiloConAsunto } = await S.crearConversacion({
    creadorId: beto.id, paraIds: [ana.id], subject: 'Aumento de sueldo',
    primerMensaje: 'lo hablamos el lunes',
});
const gus = await crearUser('Gus');
await S.agregarParticipante({ threadId: hiloConAsunto, porUserId: beto.id, nuevoUserId: gus.id });
const filaGus = (await S.bandeja(gus.id)).find(c => c.id === hiloConAsunto);
check('el ASUNTO tampoco se ve si no ve ningún mensaje', filaGus?.subject === null,
    `(mostró "${filaGus?.subject ?? ''}")`);
check('y al abrirla, el asunto sigue oculto',
    (await S.leerConversacion(hiloConAsunto, gus.id)).subject === null);
// Pero en cuanto se escribe algo nuevo, ya es parte de su conversación.
await S.responder({ threadId: hiloConAsunto, senderId: beto.id, body: 'Gus, mirá esto' });
check('cuando SÍ ve un mensaje, el asunto aparece',
    (await S.bandeja(gus.id)).find(c => c.id === hiloConAsunto)?.subject === 'Aumento de sueldo');

// PAGINADO: el historial viejo tiene que poder pedirse.
const { id: hiloLargo } = await S.crearConversacion({
    creadorId: ana.id, paraIds: [beto.id], subject: 'Largo', primerMensaje: 'mensaje 1',
});
for (let i = 2; i <= 55; i++) {
    await S.responder({ threadId: hiloLargo, senderId: ana.id, body: `mensaje ${i}` });
}
const pag1 = await S.leerConversacion(hiloLargo, beto.id);
check('la primera página trae 50 y avisa que hay más', pag1.mensajes.length === 50 && pag1.hayMas === true,
    `(${pag1.mensajes.length} mensajes, hayMas=${pag1.hayMas})`);
const pag2 = await S.leerConversacion(hiloLargo, beto.id, { antesDe: new Date(pag1.mensajes[0].createdAt) });
check('la segunda página trae los 5 anteriores', pag2.mensajes.length === 5, `(dio ${pag2.mensajes.length})`);
check('y el más viejo es el primero de todos', pag2.mensajes[0]?.body === 'mensaje 1',
    `(dio "${pag2.mensajes[0]?.body}")`);

await limpiar();
await prisma.$disconnect();

if (fallas.length > 0) {
    console.log(`\n❌ ${fallas.length} falla(s): ${fallas.join(' · ')}\n`);
    process.exit(1);
}
console.log(`\n✅ ${ok} checks OK — nadie lee lo que no es suyo\n`);

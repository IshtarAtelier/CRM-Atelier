// ────────────────────────────────────────────────────────────────────────────
// FUERA DE HORARIO, EL BOT SE PRENDE SOLO.
//
// Milena apagó el bot el 12/9/2026 a las 10:07 y quedó apagado casi 4 días —
// 828 mensajes entrantes, 0 respondidos, noches y fin de semana incluidos.
// Acá se fija el horario real del local (el del cartel, no uno escrito de
// nuevo) y que el tilde "mantener apagado fuera de horario" siga siendo un
// escape de verdad.
//
// Puro: sin base y sin red.
//   node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/checks/horario-bot.check.mjs
// ────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { dentroDelHorarioComercial } from '../../src/lib/whatsapp/horario-comercial.ts';
import { BUSINESS_INFO } from '../../src/lib/business-info.ts';

let ok = 0;
const fallas = [];
const check = (nombre, cond, extra = '') => {
    if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
    else { fallas.push(nombre); console.log(`  ✗ ${nombre} ${extra}`); }
};

/** Un instante de Córdoba (UTC−3) como Date real. */
const art = (iso) => new Date(`${iso}:00.000-03:00`);

console.log('\nHorario del local (Lun-Vie 9-20, Sáb 9-17, Dom cerrado)');
// 2026-09-16 es miércoles; 19 sábado; 20 domingo.
check('miércoles 11:00 → abierto', dentroDelHorarioComercial(art('2026-09-16T11:00')));
check('miércoles 08:59 → cerrado (abre 9)', !dentroDelHorarioComercial(art('2026-09-16T08:59')));
check('miércoles 09:00 → abierto (el minuto de apertura cuenta)', dentroDelHorarioComercial(art('2026-09-16T09:00')));
check('miércoles 19:59 → abierto', dentroDelHorarioComercial(art('2026-09-16T19:59')));
check('miércoles 20:00 → cerrado (cierra 20)', !dentroDelHorarioComercial(art('2026-09-16T20:00')));
check('miércoles 23:30 → cerrado', !dentroDelHorarioComercial(art('2026-09-16T23:30')));
check('miércoles 03:00 → cerrado (madrugada)', !dentroDelHorarioComercial(art('2026-09-16T03:00')));
check('sábado 16:00 → abierto', dentroDelHorarioComercial(art('2026-09-19T16:00')));
check('sábado 17:30 → cerrado (sábado cierra 17)', !dentroDelHorarioComercial(art('2026-09-19T17:30')));
check('domingo 12:00 → cerrado (no abre)', !dentroDelHorarioComercial(art('2026-09-20T12:00')));

console.log('\nEl horario sale del cartel, no de un número escrito a mano');
const fuente = readFileSync(new URL('../../src/lib/whatsapp/horario-comercial.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
check('lee BUSINESS_INFO.openingHoursSpecification', fuente.includes('BUSINESS_INFO.openingHoursSpecification'));
check('no tiene horarios escritos a mano', !/['"]\d{2}:\d{2}['"]/.test(fuente));
check('el cartel sigue teniendo las dos franjas', BUSINESS_INFO.openingHoursSpecification.length === 2);

console.log('\nEl reloj: una vez por día, a la hora de cierre');
import { horaDeCierreDeHoy } from '../../src/lib/whatsapp/horario-comercial.ts';
check('miércoles cierra a las 20', horaDeCierreDeHoy(art('2026-09-16T11:00')) === 20);
check('sábado cierra a las 17', horaDeCierreDeHoy(art('2026-09-19T11:00')) === 17);
check('domingo no tiene cierre (no abre)', horaDeCierreDeHoy(art('2026-09-20T11:00')) === null);

console.log('\nEl vigilante: qué mira antes de prender');
const vig = readFileSync(new URL('../../src/lib/whatsapp/vigilar-horario-bot.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
check('en horario comercial NO toca nada', vig.includes("if (dentroDelHorarioComercial(now)) return { accion: 'nada'"));
check('respeta el tilde "mantener apagado fuera de horario"', vig.includes("bot_mantener_apagado_fuera_horario") && vig.includes("mantener apagado fuera de horario está tildado"));
check('el tilde se consulta ANTES de prender', vig.indexOf('bot_mantener_apagado_fuera_horario') < vig.indexOf("data: { value: 'true' }"));
check('prende de forma atómica (una sola instancia avisa)', vig.includes('updateMany') && vig.includes('tomado.count === 1'));
check('deja rastro en el audit y le avisa al equipo', vig.includes('logAudit(') && vig.includes('avisarAlEquipo('));

const inst = readFileSync(new URL('../../src/instrumentation.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
check('el reloj espera a la hora de cierre, no vigila todo el día', inst.includes('horaDeCierreDeHoy()') && inst.includes('if (cierre === null || hour < cierre) return;'));
check('corre UNA sola vez por día entre las dos instancias', inst.includes("reclamarCorrida(CIERRE_BOT_KEY, dateKey)"));
check('el domingo (sin cierre) no hace nada', inst.includes('cierre === null'));

const ruta = readFileSync(new URL('../../src/app/api/whatsapp/bot-horario/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
check('el tilde queda firmado con quién lo tocó', ruta.includes('getActor(request)') && ruta.includes('logAudit('));

console.log('\nEl bot se calla cuando interviene una persona');
{
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const { esRemitenteHumano, NOMBRES_NO_HUMANOS } = require('../../wa-service/shared/remitentes.js');
    check('"Teléfono" (escribieron desde el celular del local) ES una persona', esRemitenteHumano('Teléfono'));
    check('"Matias Turchi" es una persona', esRemitenteHumano('Matias Turchi'));
    check('"Bot" y "Sistema" no lo son', !esRemitenteHumano('Bot') && !esRemitenteHumano('Sistema'));
    check('la lista para consultar la base coincide con el Set', NOMBRES_NO_HUMANOS.length === 3 && NOMBRES_NO_HUMANOS.includes('Bot'));

    const api = readFileSync(new URL('../../wa-service/routes/api.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('escribir desde el CRM apaga el bot de ese chat', api.includes('marcarTraspasoHumano') && api.includes('esRemitenteHumano(senderName'));
    const cloud = readFileSync(new URL('../../wa-service/cloud.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    check('escribir desde el CELULAR (eco) también lo apaga', cloud.includes('async function onEcho') && cloud.includes('marcarTraspasoHumano'));

    const bc = readFileSync(new URL('../../wa-service/bot-cloud.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    // Se afirma la CONDUCTA, no el nombre de una variable. Antes se buscaba
    // `humanoMientrasTanto` literal: al renombrarla, dos de estas tres
    // fallaron sin que la conducta hubiera cambiado, y la tercera pasó EN
    // FALSO —comparaba `indexOf(...) < indexOf(...)` y el primero valía −1,
    // que es menor que cualquier cosa—. Un check que pasa porque no encuentra
    // lo que busca es el peor de todos.
    const preguntaPorHumano = /senderName: \{ notIn: NOMBRES_NO_HUMANOS \}/;
    check('si una persona contesta MIENTRAS el bot piensa, la respuesta se descarta',
        preguntaPorHumano.test(bc) && bc.includes('comienzoDelTurno'));

    const posPregunta = bc.search(preguntaPorHumano);
    const posEnvio = bc.indexOf('botReplyingTo.add(waId)');
    check('ese control va ANTES de enviar', posPregunta > -1 && posEnvio > -1 && posPregunta < posEnvio);

    // Por `marcarTraspasoHumano` y no por `disableBotForChatById` a secas: el
    // helper apaga Y deja la etiqueta de traspaso, que es lo que después
    // habilita que el bot vuelva solo a las 3 horas.
    check('y además apaga el bot en ese chat', bc.includes('marcarTraspasoHumano'));

    // La garantía fuerte, agregada el 17/9/2026 después de que el bot se
    // encimara con Milena: preguntar una vez antes del primer envío no alcanza
    // —entre burbuja y burbuja pasan segundos— así que se pregunta antes de
    // CADA una. Se verifica que la pregunta viva en una función reusable y que
    // se la llame más de una vez.
    const llamadas = (bc.match(/await humanoSeAdelanto\(\)/g) || []).length;
    check('y se vuelve a preguntar antes de CADA burbuja', llamadas >= 2);
    check('un turno con el bot apagado en el chat no llega a hablar', bc.includes('if (!freshChat || !freshChat.botEnabled)'));
}

console.log(`\n${ok} ok, ${fallas.length} fallas`);
if (fallas.length) { console.log('FALLAS:', fallas.join(' · ')); process.exit(1); }

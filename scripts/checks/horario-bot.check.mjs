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

console.log('\nEl vigilante: qué mira antes de prender');
const vig = readFileSync(new URL('../../src/lib/whatsapp/vigilar-horario-bot.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
check('en horario comercial NO toca nada', vig.includes("if (dentroDelHorarioComercial(now)) return { accion: 'nada'"));
check('respeta el tilde "mantener apagado fuera de horario"', vig.includes("bot_mantener_apagado_fuera_horario") && vig.includes("mantener apagado fuera de horario está tildado"));
check('el tilde se consulta ANTES de prender', vig.indexOf('bot_mantener_apagado_fuera_horario') < vig.indexOf("data: { value: 'true' }"));
check('prende de forma atómica (una sola instancia avisa)', vig.includes('updateMany') && vig.includes('tomado.count === 1'));
check('deja rastro en el audit y le avisa al equipo', vig.includes('logAudit(') && vig.includes('avisarAlEquipo('));

const inst = readFileSync(new URL('../../src/instrumentation.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
check('corre en cada tick del reloj (cada 10 min, también de madrugada)', inst.includes('vigilarBotFueraDeHorario()') && inst.indexOf('vigilarBotFueraDeHorario()') < inst.indexOf('if (!isBusinessHours()) {'));

const ruta = readFileSync(new URL('../../src/app/api/whatsapp/bot-horario/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
check('el tilde queda firmado con quién lo tocó', ruta.includes('getActor(request)') && ruta.includes('logAudit('));

console.log(`\n${ok} ok, ${fallas.length} fallas`);
if (fallas.length) { console.log('FALLAS:', fallas.join(' · ')); process.exit(1); }

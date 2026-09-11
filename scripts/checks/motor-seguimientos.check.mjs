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
veta('lead anterior al arranque del motor', cand({ createdAt: new Date('2026-09-01T12:00:00-03:00') }), chat(), 'a mano');
veta('sin chat', cand({ waChatId: null }), null, 'chat');
veta('sin nombre de pila', cand({ nombre: 'Cliente' }), chat(), 'nombre');
veta('seguimientos pausados', cand(), chat({ followUpPausedUntil: hace(-24) }), 'pausados');
veta('el cliente escribió hace 10 h (charla viva)', cand(), chat({ lastInboundAt: hace(10) }), 'charla está viva');
veta('respondió al último seguimiento', cand(), chat({ lastFollowUpAt: hace(100), lastInboundAt: hace(60) }), 'respondió');
veta('NUEVO · ya se le mandó un seguimiento hace 20 h', cand(), chat({ lastFollowUpAt: hace(20) }), 'seguimiento hace menos');
veta('NUEVO · un vendedor le escribió hace 5 h', cand(), chat({ lastOutboundAt: hace(5) }), 'le escribieron');

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

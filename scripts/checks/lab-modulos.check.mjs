// ────────────────────────────────────────────────────────────────────────────
// MÓDULOS DE LABORATORIO: la lógica pura del marco (src/services/lab-modules).
//
// Lo que NO puede pasar (cada punto ya costó plata o días en Grupo Óptico):
//  · dos pasadas contra el mismo portal a la vez (PDFs a medias, 24/9/2026);
//  · una credencial rechazada esperando 12 h como si fuera lentitud (15 días
//    de corte en 2026);
//  · un pedido del portal vinculado a la venta equivocada;
//  · una venta que baja de estado, o que pasa a FINISHED con un par sin terminar;
//  · un "restablecido" por un micro-corte que nunca se alertó.
//
// Sin base ni red. Corre en CI.
// Correr:  npm run check:lab-modulos
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { leerTurno, turnoVigente, debeEsperar } from '../../src/services/lab-modules/portal/turno.ts';
import { decidirAlertaDeCaida, debeAvisarRecuperacion, UMBRAL_CAIDA_MS, REPETIR_ALERTA_MS } from '../../src/services/lab-modules/portal/salud.ts';
import { transicionDeVenta, estadoConjunto, numeroProvisorio } from '../../src/services/lab-modules/estados.ts';
import { ventaDelPedido, cambioEnPedido, ventasSinPedidoEnPortal, pedidosAtrasados } from '../../src/services/lab-modules/espejo.ts';

const ahora = new Date('2026-10-01T12:00:00Z');
const hace = (ms) => new Date(ahora.getTime() - ms);
const en = (ms) => new Date(ahora.getTime() + ms);
let fallas = 0;
const ok = (desc, fn) => {
    try { fn(); console.log(`  ✅ ${desc}`); }
    catch (e) { fallas++; console.log(`  ❌ ${desc}\n     ${e.message}`); }
};

console.log('\n— Turno por portal —');
ok('un valor viejo o vacío no es turno', () => {
    assert.equal(turnoVigente('', ahora), null);
    assert.equal(turnoVigente(null, ahora), null);
    assert.equal(turnoVigente(`${hace(1000).toISOString()}|completa`, ahora), null);
});
ok('un turno vigente dice qué pasada lo tiene', () => {
    assert.equal(turnoVigente(`${en(60000).toISOString()}|rapida`, ahora), 'rapida');
    assert.equal(turnoVigente(`${en(60000).toISOString()}|completa`, ahora), 'completa');
    assert.equal(leerTurno(`${en(60000).toISOString()}|cualquiera`).pasada, 'completa');
});
ok('solo la completa espera a una rápida; nadie espera a una completa', () => {
    assert.equal(debeEsperar('rapida', 'completa'), true);
    assert.equal(debeEsperar('completa', 'completa'), false);
    assert.equal(debeEsperar('completa', 'rapida'), false);
    assert.equal(debeEsperar('rapida', 'rapida'), false);
    assert.equal(debeEsperar(null, 'completa'), false);
});

console.log('\n— Salud y alertas —');
const sano = { ultimaOkAt: hace(600000), caidoDesde: null, alertadoEn: null };
ok('un corte corto todavía no alerta', () => {
    const d = decidirAlertaDeCaida({ ...sano, caidoDesde: hace(UMBRAL_CAIDA_MS / 2) }, ahora);
    assert.equal(d.alertar, false); assert.equal(d.motivo, 'todavia-no');
});
ok('pasado el umbral alerta una vez', () => {
    const d = decidirAlertaDeCaida({ ...sano, caidoDesde: hace(UMBRAL_CAIDA_MS + 1) }, ahora);
    assert.equal(d.alertar, true); assert.equal(d.motivo, 'umbral');
});
ok('ya alertado, no repite hasta pasado el enfriamiento', () => {
    const base = { ...sano, caidoDesde: hace(UMBRAL_CAIDA_MS * 3) };
    assert.equal(decidirAlertaDeCaida({ ...base, alertadoEn: hace(REPETIR_ALERTA_MS / 2) }, ahora).alertar, false);
    const d = decidirAlertaDeCaida({ ...base, alertadoEn: hace(REPETIR_ALERTA_MS + 1) }, ahora);
    assert.equal(d.alertar, true); assert.equal(d.motivo, 'repeticion');
});
ok('credencial rechazada alerta en el acto, sin esperar el umbral', () => {
    const d = decidirAlertaDeCaida({ ...sano, caidoDesde: ahora }, ahora, true);
    assert.equal(d.alertar, true); assert.equal(d.motivo, 'credencial');
});
ok('la recuperación se avisa solo si el corte llegó a alertarse', () => {
    assert.equal(debeAvisarRecuperacion({ ...sano, caidoDesde: hace(1000), alertadoEn: null }), false);
    assert.equal(debeAvisarRecuperacion({ ...sano, caidoDesde: hace(1000), alertadoEn: hace(500) }), true);
});

console.log('\n— Estado de la venta —');
ok('el par más atrasado manda; el anulado no frena', () => {
    assert.equal(estadoConjunto(['TERMINADO', 'EN_PROCESO']), 'EN_PROCESO');
    assert.equal(estadoConjunto(['TERMINADO', 'ANULADO']), 'TERMINADO');
    assert.equal(estadoConjunto(['TERMINADO', 'DESCONOCIDO']), 'DESCONOCIDO');
    assert.equal(estadoConjunto(['ANULADO']), 'ANULADO');
    assert.equal(estadoConjunto([]), 'DESCONOCIDO');
});
ok('SENT avanza a IN_PROGRESS cuando el lab lo recibió, y a FINISHED cuando terminó', () => {
    assert.equal(transicionDeVenta('SENT', 'INGRESADO'), 'IN_PROGRESS');
    assert.equal(transicionDeVenta('SENT', 'EN_PROCESO'), 'IN_PROGRESS');
    assert.equal(transicionDeVenta('SENT', 'TERMINADO'), 'FINISHED');
    assert.equal(transicionDeVenta('IN_PROGRESS', 'DESPACHADO'), 'FINISHED');
});
ok('nunca baja, nunca toca READY/DELIVERED/NONE, nunca afirma sobre lo desconocido', () => {
    assert.equal(transicionDeVenta('IN_PROGRESS', 'EN_PROCESO'), null);
    assert.equal(transicionDeVenta('FINISHED', 'EN_PROCESO'), null);
    assert.equal(transicionDeVenta('READY', 'TERMINADO'), null);
    assert.equal(transicionDeVenta('DELIVERED', 'TERMINADO'), null);
    assert.equal(transicionDeVenta('NONE', 'TERMINADO'), null);
    assert.equal(transicionDeVenta(null, 'TERMINADO'), null);
    assert.equal(transicionDeVenta('SENT', 'DESCONOCIDO'), null);
    assert.equal(transicionDeVenta('SENT', 'ANULADO'), null);
});
ok('un nº provisorio se puede reemplazar; uno real no', () => {
    assert.equal(numeroProvisorio(null), true);
    assert.equal(numeroProvisorio('SML-1234'), true);
    assert.equal(numeroProvisorio('Borrador-77'), true);
    assert.equal(numeroProvisorio('sin numero'), true);
    assert.equal(numeroProvisorio('2026001234'), false);
});

console.log('\n— Vinculación y espejo —');
const ventas = [
    { id: 'cm00000000000000000ab12', labOrderNumber: '5001234', postSaleNumbers: [], clientName: 'Ana Pérez' },
    { id: 'cm00000000000000000cd34', labOrderNumber: null, postSaleNumbers: ['5009999'], clientName: 'Juan López' },
    { id: 'cm00000000000000000ef56', labOrderNumber: 'SML-8', postSaleNumbers: [], clientName: 'Ana Perez' },
];
const pedido = (extra) => ({ portalNumber: '1', statusRaw: 'x', status: 'INGRESADO', ...extra });
ok('primero por nº de pedido (venta o reproceso)', () => {
    assert.equal(ventaDelPedido(pedido({ portalNumber: '5001234' }), ventas)?.id, ventas[0].id);
    assert.equal(ventaDelPedido(pedido({ portalNumber: '5009999' }), ventas)?.id, ventas[1].id);
});
ok('después por el código corto de la venta (#EF56), con o sin numeral y en cualquier caja', () => {
    assert.equal(ventaDelPedido(pedido({ internalRef: '#EF56' }), ventas)?.id, ventas[2].id);
    assert.equal(ventaDelPedido(pedido({ internalRef: 'ef56' }), ventas)?.id, ventas[2].id);
});
ok('por nombre solo si es único: dos "Ana Pérez" no vinculan', () => {
    assert.equal(ventaDelPedido(pedido({ internalRef: 'Juan Lopez' }), ventas)?.id, ventas[1].id);
    assert.equal(ventaDelPedido(pedido({ internalRef: 'Ana Pérez' }), ventas), null);
    assert.equal(ventaDelPedido(pedido({ internalRef: '' }), ventas), null);
});
ok('cambio de estado o de fecha se detecta; misma lectura no', () => {
    const previo = { status: 'EN_PROCESO', estimatedAt: new Date('2026-10-05'), finishedAt: null };
    assert.equal(cambioEnPedido(null, pedido({})), true);
    assert.equal(cambioEnPedido(previo, pedido({ status: 'EN_PROCESO', estimatedAt: new Date('2026-10-05'), finishedAt: null })), false);
    assert.equal(cambioEnPedido(previo, pedido({ status: 'TERMINADO', estimatedAt: new Date('2026-10-05'), finishedAt: null })), true);
    assert.equal(cambioEnPedido(previo, pedido({ status: 'EN_PROCESO', estimatedAt: new Date('2026-10-07'), finishedAt: null })), true);
});
ok('venta enviada sin pedido en el portal: recién pasado el día de gracia', () => {
    const v = [
        { ...ventas[0], labSentAt: hace(2 * 86400000) },
        { ...ventas[1], labSentAt: hace(3600000) },
        { ...ventas[2], labSentAt: hace(5 * 86400000) },
    ];
    const r = ventasSinPedidoEnPortal(v, new Set([ventas[2].id]), ahora);
    assert.deepEqual(r.map(x => x.orderId), [ventas[0].id]);
    assert.equal(r[0].enviadaHace, 2);
});
ok('atrasado = fecha estimada vencida y sin terminar', () => {
    const r = pedidosAtrasados([
        { portalNumber: 'a', cliente: null, status: 'EN_PROCESO', estimatedAt: hace(3 * 86400000) },
        { portalNumber: 'b', cliente: null, status: 'TERMINADO', estimatedAt: hace(3 * 86400000) },
        { portalNumber: 'c', cliente: null, status: 'EN_PROCESO', estimatedAt: en(86400000) },
        { portalNumber: 'd', cliente: null, status: 'EN_PROCESO', estimatedAt: null },
    ], ahora);
    assert.deepEqual(r.map(x => x.portalNumber), ['a']);
    assert.equal(r[0].diasDeAtraso, 3);
});

console.log(fallas === 0 ? '\n✅ Marco de módulos de laboratorio: todo en orden.\n' : `\n❌ ${fallas} falla(s).\n`);
process.exit(fallas === 0 ? 0 : 1);

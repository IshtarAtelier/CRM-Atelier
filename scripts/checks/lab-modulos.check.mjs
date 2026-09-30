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
import { transicionValida, borradorVivo, puedeAprobar } from '../../src/services/lab-modules/carga/borrador.ts';
import { armarFormulario, codigoDeCristal, tipoRecetaDe } from '../../src/services/lab-modules/vitolen/carga.ts';
import { CATALOGO_VITOLEN, cristalVitolenPorNombre } from '../../src/services/lab-modules/vitolen/catalogo.ts';
import { armarCatalogo } from '../maintenance/precios-vitolen/generar-catalogo-ts.mjs';
import { leerLista } from '../maintenance/precios-vitolen/subir-catalogo-vitolen.mjs';

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

console.log('\n— Carga asistida: el OK es humano —');
ok('el camino feliz: preparado → en revisión → aprobado → cargado', () => {
    assert.equal(transicionValida('PREPARADO', 'EN_REVISION'), true);
    assert.equal(transicionValida('EN_REVISION', 'APROBADO'), true);
    assert.equal(transicionValida('APROBADO', 'CARGADO'), true);
});
ok('no se carga sin pasar por la revisión ni sin aprobación', () => {
    assert.equal(transicionValida('PREPARADO', 'CARGADO'), false);
    assert.equal(transicionValida('PREPARADO', 'APROBADO'), false);
    assert.equal(transicionValida('EN_REVISION', 'CARGADO'), false);
    assert.equal(transicionValida('RECHAZADO', 'APROBADO'), false);
    assert.equal(transicionValida('CARGADO', 'ERROR'), false);
});
ok('un borrador vivo bloquea otro; uno cerrado no', () => {
    assert.equal(borradorVivo('EN_REVISION'), true);
    assert.equal(borradorVivo('APROBADO'), true);
    assert.equal(borradorVivo('CARGADO'), false);
    assert.equal(borradorVivo('RECHAZADO'), false);
    assert.equal(borradorVivo('ERROR'), false);
});
ok('aprueba una persona identificada; ni el robot, ni "Sistema", ni un anónimo', () => {
    assert.equal(puedeAprobar({ id: 'u1', name: 'Milena', role: 'STAFF' }), true);
    assert.equal(puedeAprobar({ id: null, name: 'Sistema', role: null }), false);
    assert.equal(puedeAprobar({ id: 'u2', name: 'Robot Vitolen', role: null }), false);
    assert.equal(puedeAprobar({ id: null, name: 'Milena', role: null }), false);
    assert.equal(puedeAprobar(null), false);
});

console.log('\n— Vitolen: catálogo generado y armado del pedido —');
ok('catalogo.ts coincide con la lista L96 (si falla: regenerar con generar-catalogo-ts.mjs)', () => {
    const esperado = armarCatalogo(leerLista());
    assert.deepEqual(CATALOGO_VITOLEN, esperado);
    assert.equal(CATALOGO_VITOLEN.length, 114);
});
ok('cada cristal del catálogo se encuentra por su nombre exacto, sin importar la caja', () => {
    assert.equal(cristalVitolenPorNombre('hoya array 2 - 1.50 clear blue filter')?.codigos[0], '10050');
    assert.equal(cristalVitolenPorNombre('HOYA LIFESTYLE 4 - 1.50 CLEAR')?.variantes.length, 3);
    assert.equal(cristalVitolenPorNombre('nada'), null);
});
ok('el tipo de receta sale del tipo del cristal', () => {
    assert.equal(tipoRecetaDe('Cristal Multifocal'), 'Progresivo');
    assert.equal(tipoRecetaDe('Cristal Ocupacional'), 'Ocupacional');
    assert.equal(tipoRecetaDe('Cristal Monofocal'), 'Monofocal');
    assert.equal(tipoRecetaDe('Armazón'), null);
});
ok('un diseño con variantes exige elegir una; sin variantes va el único código', () => {
    const lifestyle = cristalVitolenPorNombre('HOYA LIFESTYLE 4 - 1.50 CLEAR');
    assert.equal(codigoDeCristal(lifestyle, null).codigo, null);
    assert.equal(codigoDeCristal(lifestyle, 'urban').codigo, '11000');
    assert.equal(codigoDeCristal(lifestyle, 'Outdoor').codigo, '11100');
    const array = cristalVitolenPorNombre('HOYA ARRAY 2 - 1.59 SENSITY 2');
    assert.equal(codigoDeCristal(array, null).codigo, '10062');
});
const ventaBase = () => ({
    id: 'cm00000000000000000ab12',
    clienteNombre: 'Ana Pérez',
    labNotes: 'sin apuro',
    labFrameType: 'Metálico',
    userFrameBrand: 'Vulk', userFrameModel: 'Roma', labFrameDetails: 'color rojo',
    frames: [{ position: 1, shape: null, a: '52', b: '40', dbl: '18', edc: '56', details: null, heightOD: 24, heightOI: 24 }],
    prescription: { sphereOD: 1.25, cylinderOD: 0.75, axisOD: 5, sphereOI: 1.25, cylinderOI: 0.5, axisOI: 70, addition: 2.25, additionOD: null, additionOI: null, pd: null, distanceOD: 32, distanceOI: 31, heightOD: null, heightOI: null },
    items: [
        { eye: 'OD', productNameSnapshot: 'HOYA ARRAY 2 - 1.60 CLEAR', productTypeSnapshot: 'Cristal Multifocal', laboratorySnapshot: 'VITOLEN', productCategorySnapshot: 'Cristal', sphereVal: 1.25, cylinderVal: 0.75, axisVal: 5, additionVal: 2.25, pdVal: 32, heightVal: 28, crystalColor: null, framePosition: 1, price: 100 },
        { eye: 'OI', productNameSnapshot: 'HOYA ARRAY 2 - 1.60 CLEAR', productTypeSnapshot: 'Cristal Multifocal', laboratorySnapshot: 'VITOLEN', productCategorySnapshot: 'Cristal', sphereVal: 1.25, cylinderVal: 0.5, axisVal: 70, additionVal: 2.25, pdVal: 31, heightVal: 28, crystalColor: null, framePosition: 1, price: 100 },
        { eye: null, productNameSnapshot: 'Vulk Roma', productTypeSnapshot: 'Armazón', laboratorySnapshot: null, productCategorySnapshot: 'Armazón', sphereVal: null, cylinderVal: null, axisVal: null, additionVal: null, pdVal: null, heightVal: null, crystalColor: null, framePosition: 1, price: 50 },
    ],
});
ok('una venta completa arma el pedido igual al ejemplo del video de Vitolen', () => {
    const r = armarFormulario(ventaBase(), { forma: 'Forma 7' });
    assert.deepEqual(r.faltantes, []);
    assert.equal(r.ok, true);
    const p = r.payload;
    assert.equal(p.nroCasoInterno, '#AB12');
    assert.equal(p.tipoReceta, 'Progresivo');
    assert.equal(p.diseno, 'Array 2');
    assert.equal(p.ojos, 'AMBOS');
    assert.deepEqual([p.od.esferico, p.od.cilindrico, p.od.eje, p.od.adicion, p.od.dnp, p.od.altura, p.od.codigo], [1.25, 0.75, 5, 2.25, 32, 28, '10070']);
    assert.deepEqual([p.oi.esferico, p.oi.cilindrico, p.oi.eje, p.oi.adicion, p.oi.dnp, p.oi.altura], [1.25, 0.5, 70, 2.25, 31, 28]);
    assert.deepEqual([p.armazon.largo, p.armazon.alto, p.armazon.diagonalMayor, p.armazon.puente, p.armazon.forma], [52, 40, 56, 18, 'Forma 7']);
    assert.equal(p.armazon.caracteristicas, 'Vulk Roma color rojo');
    assert.equal(p.montajes.calibrado, true);
    assert.equal(p.tratamientos.antirreflejo, true);
    assert.equal(p.distanciaVertice, 14);
    assert.equal(p.anguloPantoscopico, 6);
});
ok('la receta cae a la ficha cuando el ítem no la tiene; la DNP a la mitad de la DP', () => {
    const v = ventaBase();
    v.items[0].sphereVal = null; v.items[0].pdVal = null; v.items[1].pdVal = null;
    v.prescription.distanceOD = null; v.prescription.distanceOI = null; v.prescription.pd = 63;
    const r = armarFormulario(v, { forma: 'Forma 1' });
    assert.equal(r.ok, true);
    assert.equal(r.payload.od.esferico, 1.25);
    assert.equal(r.payload.od.dnp, 31.5);
});
ok('lo que falta se dice, y no se prepara: forma, DNP, adición y variante', () => {
    const v = ventaBase();
    v.items[0].pdVal = null; v.items[1].pdVal = null; v.prescription.distanceOD = null; v.prescription.distanceOI = null;
    v.items[0].additionVal = null; v.items[1].additionVal = null; v.prescription.addition = null;
    const r = armarFormulario(v);
    assert.equal(r.ok, false);
    assert.ok(r.faltantes.some(f => /forma del armazón/.test(f)));
    assert.ok(r.faltantes.some(f => /DNP OD/.test(f)));
    assert.ok(r.faltantes.some(f => /adición OD/.test(f)));
    const l = ventaBase();
    l.items[0].productNameSnapshot = l.items[1].productNameSnapshot = 'HOYA LIFESTYLE 4 - 1.50 CLEAR';
    assert.ok(armarFormulario(l, { forma: 'Forma 2' }).faltantes.some(f => /variante/.test(f)));
    assert.equal(armarFormulario(l, { forma: 'Forma 2', variante: 'Indoor' }).payload.od.codigo, '11050');
});
ok('sin cristales de Vitolen para ese par, no arma nada', () => {
    const v = ventaBase();
    v.items.forEach(i => { i.laboratorySnapshot = 'OPTOVISION'; });
    const r = armarFormulario(v, { forma: 'Forma 1' });
    assert.equal(r.ok, false);
    assert.equal(r.payload, null);
});
ok('el segundo par lleva el pedido origen del primero', () => {
    const v = ventaBase();
    v.items.forEach(i => { i.framePosition = 2; });
    v.frames = [{ position: 2, shape: null, a: '50', b: '38', dbl: '17', edc: '54', details: null, heightOD: 22, heightOI: 22 }];
    const r = armarFormulario(v, { pair: 2, forma: 'Forma 3', pedidoOrigen: '5001234' });
    assert.equal(r.ok, true);
    assert.equal(r.payload.pedidoOrigen, '5001234');
    assert.equal(r.payload.armazon.largo, 50);
});

console.log(fallas === 0 ? '\n✅ Marco de módulos de laboratorio: todo en orden.\n' : `\n❌ ${fallas} falla(s).\n`);
process.exit(fallas === 0 ? 0 : 1);

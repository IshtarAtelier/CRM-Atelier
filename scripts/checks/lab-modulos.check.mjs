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
import { tocaPaseRapido } from '../../src/services/lab-modules/corrida.ts';
import { armarFormulario, codigoDeCristal, tipoRecetaDe } from '../../src/services/lab-modules/vitolen/carga.ts';
import { CATALOGO_VITOLEN, cristalVitolenPorNombre } from '../../src/services/lab-modules/vitolen/catalogo.ts';
import { importeEsperadoSegundoPar, importeEsperadoSegundoParDe, segundoParCobradoDeMas } from '../../src/services/lab-modules/vitolen/promo.ts';
import { estadoDe } from '../../src/services/lab-modules/vitolen/estados.ts';
import { materialDelPortal, disenoDelPortal, colorDe } from '../../src/services/lab-modules/vitolen/materiales.ts';
import { DISENOS_PORTAL } from '../../src/services/lab-modules/vitolen/portal-materiales.ts';
import { parsearCuentaCorriente, leerPaginadorCuenta, importeArgentino, facturasVigentes, urlCuentaCorriente, tipoDeComprobante } from '../../src/services/lab-modules/vitolen/cuenta-corriente.ts';
import { extraerHtmlDeRespuestaJs, parsearListado, leerPaginador, fechaArgentina, normalizarPedido, periodoDeListado, urlListado } from '../../src/services/lab-modules/vitolen/pedidos.ts';
import { labKeyDeNombre } from '../../src/services/lab-recon/types.ts';
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
        { portalNumber: 'viejo', cliente: null, status: 'INGRESADO', estimatedAt: hace(779 * 86400000) },
    ], ahora);
    assert.deepEqual(r.map(x => x.portalNumber), ['a']);
    assert.equal(r[0].diasDeAtraso, 3);
});
ok('un atraso de más de 30 días es historia, no aviso (los pedidos de Vitolen de 2024)', () => {
    const r = pedidosAtrasados([
        { portalNumber: 'limite', cliente: null, status: 'EN_PROCESO', estimatedAt: hace(30 * 86400000) },
        { portalNumber: 'fuera', cliente: null, status: 'EN_PROCESO', estimatedAt: hace(31 * 86400000) },
    ], ahora);
    assert.deepEqual(r.map(x => x.portalNumber), ['limite']);
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
    const r = armarFormulario(ventaBase(), { forma: 'Forma 7', ejeDiagonal: 15 });
    assert.deepEqual(r.faltantes, []);
    assert.equal(r.ok, true);
    const p = r.payload;
    assert.equal(p.nroCasoInterno, '#AB12');
    assert.equal(p.tipoReceta, 'Progresivo');
    assert.equal(p.diseno, 'Array 2');
    assert.equal(p.ojos, 'AMBOS');
    assert.deepEqual([p.od.esferico, p.od.cilindrico, p.od.eje, p.od.adicion, p.od.dnp, p.od.altura, p.od.codigo], [1.25, 0.75, 5, 2.25, 32, 28, '10070']);
    assert.deepEqual(p.portalDiseno, { dataId: '23', nombre: 'Hoya Array 2' });
    assert.deepEqual(p.od.portalMaterial, { id: '1644', texto: 'Array 2 1.60 Hilux MR-8 Clear' });
    assert.deepEqual(p.oi.portalMaterial, p.od.portalMaterial);
    assert.deepEqual([p.oi.esferico, p.oi.cilindrico, p.oi.eje, p.oi.adicion, p.oi.dnp, p.oi.altura], [1.25, 0.5, 70, 2.25, 31, 28]);
    assert.deepEqual([p.armazon.largo, p.armazon.alto, p.armazon.diagonalMayor, p.armazon.puente, p.armazon.forma, p.armazon.ejeDiagonal], [52, 40, 56, 18, 'Forma 7', 15]);
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
    const r = armarFormulario(v, { forma: 'Forma 1', ejeDiagonal: 0 });
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
    assert.ok(r.faltantes.some(f => /eje de la diagonal/.test(f)));
    assert.ok(armarFormulario(ventaBase(), { forma: 'Forma 1', ejeDiagonal: 200 }).faltantes.some(f => /eje de la diagonal/.test(f)));
    assert.ok(r.faltantes.some(f => /DNP OD/.test(f)));
    assert.ok(r.faltantes.some(f => /adición OD/.test(f)));
    const l = ventaBase();
    l.items[0].productNameSnapshot = l.items[1].productNameSnapshot = 'HOYA LIFESTYLE 4 - 1.50 CLEAR';
    assert.ok(armarFormulario(l, { forma: 'Forma 2', ejeDiagonal: 0 }).faltantes.some(f => /variante/.test(f)));
    const indoor = armarFormulario(l, { forma: 'Forma 2', variante: 'Indoor', ejeDiagonal: 0 });
    assert.equal(indoor.payload.od.codigo, '11050');
    assert.deepEqual(indoor.payload.od.portalMaterial, { id: '2260', texto: 'IDLS4 INDOOR 1.50 Hilux Clear' });
});
ok('un cristal cuyo diseño no está relevado en el portal no se prepara: se dice', () => {
    const v = ventaBase();
    v.items[0].productNameSnapshot = v.items[1].productNameSnapshot = 'HOYA NULUX IDENTITY V+ - 1.60 CLEAR';
    v.items[0].productTypeSnapshot = v.items[1].productTypeSnapshot = 'Cristal Monofocal';
    const r = armarFormulario(v, { forma: 'Forma 1', ejeDiagonal: 0 });
    assert.equal(r.ok, false);
    assert.ok(r.faltantes.some(f => /material OD en el portal: .*no está relevado/.test(f)), r.faltantes.join(' | '));
});

console.log('\n— Vitolen: el material del portal se elige por texto, y solo si es uno —');
const cristal = (nombre) => cristalVitolenPorNombre(nombre);
ok('el relevamiento trae los 10 diseños del formulario Progresivo', () => {
    assert.equal(DISENOS_PORTAL.length, 10);
    assert.equal(disenoDelPortal(cristal('HOYA ARRAY 2 - 1.50 CLEAR BLUE FILTER')).nombre, 'Hoya Array 2');
    assert.equal(disenoDelPortal(cristal('HOYA SUMMIT - 1.67 CLEAR')).dataId, '25');
    assert.equal(disenoDelPortal({ linea: 'nulux' }), null);
});
ok('Array 2: cada material del CRM cae en UNA opción del portal (y nunca en Array Wrap)', () => {
    const esperado = {
        'HOYA ARRAY 2 - 1.50 CLEAR BLUE FILTER': '1635',
        'HOYA ARRAY 2 - 1.50 SENSITY 2': '1637',
        'HOYA ARRAY 2 - 1.59 CLEAR BLUE FILTER': '1639',
        'HOYA ARRAY 2 - 1.59 SENSITY 2': '1640',
        'HOYA ARRAY 2 - 1.59 POLARIZED': '1641',
        'HOYA ARRAY 2 - 1.60 CLEAR': '1644',
        'HOYA ARRAY 2 - 1.60 BLUE FILTER UV-420': '1645',
        'HOYA ARRAY 2 - 1.60 SENSITY 2': '1646',
        'HOYA ARRAY 2 - 1.67 CLEAR': '1649',
        'HOYA ARRAY 2 - 1.67 CLEAR BLUE FILTER': '1650',
        'HOYA ARRAY 2 - 1.67 SENSITY 2': '1651',
        'HOYA ARRAY 2 - 1.74 CLEAR': '1652',
    };
    for (const [nombre, id] of Object.entries(esperado)) {
        const r = materialDelPortal(cristal(nombre));
        assert.equal(r.opcion?.id, id, `${nombre}: ${r.motivo ?? r.opcion?.texto}`);
        assert.ok(!/wrap/i.test(r.opcion.texto));
    }
});
ok('todo el catálogo progresivo de Hoya resuelve a una opción (Lifestyle con variante)', () => {
    const sinResolver = [];
    for (const c of CATALOGO_VITOLEN) {
        if (!disenoDelPortal(c)) continue;
        for (const variante of (c.variantes.length > 1 ? c.variantes : [null])) {
            const r = materialDelPortal(c, { variante });
            if (!r.opcion) sinResolver.push(`${c.nombre}${variante ? ` (${variante})` : ''}: ${r.motivo}`);
        }
    }
    assert.deepEqual(sinResolver, []);
});
ok('el color de la venta elige el Sensity / Polarized; sin color, gris; un color que no existe se dice', () => {
    assert.equal(colorDe('Marrón'), 'Brown');
    assert.equal(colorDe('gris'), 'Grey');
    assert.equal(colorDe('G15'), 'Green');
    assert.equal(colorDe(''), null);
    const pol = cristal('HOYA ARRAY 2 - 1.59 POLARIZED');
    assert.equal(materialDelPortal(pol, { color: 'Marrón' }).opcion.id, '1642');
    assert.equal(materialDelPortal(pol, { color: 'verde' }).opcion.id, '1643');
    assert.equal(materialDelPortal(pol, { color: null }).opcion.id, '1641');
    const r = materialDelPortal(cristal('HOYA ARRAY 2 - 1.50 SENSITY 2'), { color: 'Marrón' });
    assert.equal(r.opcion, null);
    assert.match(r.motivo, /no viene en Brown/);
});
ok('Mi Primer Hoya separa Array de Summit; Argos y Summit resuelven su "Clear" sin pisar el Blue Filter', () => {
    const mphArray = CATALOGO_VITOLEN.find(c => c.linea === 'mph-array-2' && c.material === '1.50 CLEAR BLUE FILTER');
    const mphSummit = CATALOGO_VITOLEN.find(c => c.linea === 'mph-summit' && c.material === '1.60 CLEAR');
    assert.equal(materialDelPortal(mphArray).opcion?.id, '2300', mphArray.nombre);
    assert.equal(materialDelPortal(mphSummit).opcion?.id, '2320', mphSummit.nombre);
    assert.equal(materialDelPortal(cristal('HOYA ARGOS - 1.50 CLEAR')).opcion?.id, '1623');
    assert.equal(materialDelPortal(cristal('HOYA ARGOS - 1.50 CLEAR BLUE FILTER')).opcion?.id, '1624');
    assert.equal(materialDelPortal(cristal('HOYA SUMMIT - 1.67 CLEAR BLUE FILTER')).opcion?.id, '1584');
});
ok('si el portal ofreciera dos opciones iguales, no se elige ninguna', () => {
    const disenos = [{ dataId: '23', nombre: 'Hoya Array 2', materiales: [{ id: '1', texto: 'Array 2 1.74 Hilux Clear' }, { id: '2', texto: 'Array 2 1.74 Hilux Clear' }] }];
    const r = materialDelPortal(cristal('HOYA ARRAY 2 - 1.74 CLEAR'), {}, disenos);
    assert.equal(r.opcion, null);
    assert.match(r.motivo, /varias opciones/);
});
ok('sin cristales de Vitolen para ese par, no arma nada', () => {
    const v = ventaBase();
    v.items.forEach(i => { i.laboratorySnapshot = 'OPTOVISION'; });
    const r = armarFormulario(v, { forma: 'Forma 1', ejeDiagonal: 0 });
    assert.equal(r.ok, false);
    assert.equal(r.payload, null);
});
ok('el segundo par lleva el pedido origen del primero', () => {
    const v = ventaBase();
    v.items.forEach(i => { i.framePosition = 2; });
    v.frames = [{ position: 2, shape: null, a: '50', b: '38', dbl: '17', edc: '54', details: null, heightOD: 22, heightOI: 22 }];
    const r = armarFormulario(v, { pair: 2, forma: 'Forma 3', ejeDiagonal: 20, pedidoOrigen: '5001234' });
    assert.equal(r.ok, true);
    assert.equal(r.payload.pedidoOrigen, '5001234');
    assert.equal(r.payload.armazon.largo, 50);
});

console.log('\n— Vitolen: el 2º par al 20 % y el cruce lo reconoce —');
ok('el cruce reconoce VITOLEN por el nombre del producto', () => {
    assert.equal(labKeyDeNombre('VITOLEN'), 'VITOLEN');
    assert.equal(labKeyDeNombre('Vitolen (Hoya)'), 'VITOLEN');
    assert.equal(labKeyDeNombre('OPTOVISION'), 'OPTOVISION');
});
ok('2º par = 20 % de lista + calibrado, con IVA (Array 2 1.50 Blue Filter: $428.000 → $131.406)', () => {
    assert.equal(importeEsperadoSegundoPar(428000, { calibrado: 23000, iva: 21 }), Math.round((85600 + 23000) * 1.21));
    assert.equal(importeEsperadoSegundoParDe('HOYA ARRAY 2 - 1.50 CLEAR BLUE FILTER', 428000, { calibrado: 23000, iva: 21 }), 131406);
});
ok('sin pelado o si no es de Vitolen, no hay esperado', () => {
    assert.equal(importeEsperadoSegundoParDe('HOYA ARRAY 2 - 1.50 CLEAR BLUE FILTER', null, { calibrado: 23000, iva: 21 }), null);
    assert.equal(importeEsperadoSegundoParDe('VARILUX COMFORT - ORMA + CRIZAL 2x1', 439340, { calibrado: 23000, iva: 21 }), null);
});
ok('cobrado de más solo por encima del 5 % de tolerancia', () => {
    assert.equal(segundoParCobradoDeMas(131406, 131406), false);
    assert.equal(segundoParCobradoDeMas(137000, 131406), false);
    assert.equal(segundoParCobradoDeMas(140000, 131406), true);
    assert.equal(segundoParCobradoDeMas(545710, 131406), true);
});

console.log('\n— Cadencia del pase rápido —');
ok('sin cadencia o sin corrida previa corre siempre; con cadencia, recién pasado el plazo', () => {
    assert.equal(tocaPaseRapido(null, 30, ahora), true);
    assert.equal(tocaPaseRapido(hace(5 * 60000), undefined, ahora), true);
    assert.equal(tocaPaseRapido(hace(5 * 60000), 30, ahora), false);
    assert.equal(tocaPaseRapido(hace(30 * 60000), 30, ahora), true);
});

console.log('\n— Vitolen: estados del portal —');
ok('la barra del detalle, en orden: Confirmación → En Proceso → Tránsito a OF → En Oficina → Despachado', () => {
    assert.equal(estadoDe('Confirmación'), 'INGRESADO');
    assert.equal(estadoDe('  En Proceso\n'), 'EN_PROCESO');
    assert.equal(estadoDe('Tránsito a OF'), 'EN_PROCESO');
    assert.equal(estadoDe('En Oficina'), 'TERMINADO');
    assert.equal(estadoDe('Despachado'), 'DESPACHADO');
});
ok('un estado que no conoce no se afirma; un anulado no frena a los demás', () => {
    assert.equal(estadoDe('Demorado'), 'DESCONOCIDO');
    assert.equal(estadoDe(''), 'DESCONOCIDO');
    assert.equal(estadoDe(null), 'DESCONOCIDO');
    assert.equal(estadoDe('Anulado'), 'ANULADO');
});

console.log('\n— Vitolen: lectura del listado —');
// Respuesta real del portal (3/10/2026), recortada a dos pedidos.
const RESPUESTA_JS = String.raw`$("#pedidos-container").html("  \n<table class=\"datatable kb-table\" id=\"pedidos\"><thead><tr><th class=\"nro_trabajo right\">#<\/th><\/tr><\/thead><tbody><tr class=\"kb-row\" id=\"pedido_laboratorio_8669159\"><td class=\"nro_trabajo right\"><a href=\"/ventas/pedidos_laboratorio/8669159\">6981382L<\/a><\/td><td class=\"fecha\">18/10/2024 14:24<\/td><td class=\"nro_caso\">Burban Nahuel - padre Juan carlos<\/td><td class=\"estado\">        Despachado\n<\/td><td class=\"frd center\">22/10/2024<\/td><td class=\"actions\"><div class=\"actions \"><a class=\"silentprint\" href=\"/ventas/pedidos_laboratorio/8669159.pdf\">Imprimir<\/a> | <a class=\"silentprint\" href=\"/ventas/facturacion_automatica.pdf?codigo=698138200\">Factura<\/a><\/div><\/td><\/tr><tr class=\"kb-row\" id=\"pedido_laboratorio_8469745\"><td class=\"nro_trabajo right\"><a href=\"/ventas/pedidos_laboratorio/8469745\">6822439L<\/a><\/td><td class=\"fecha\">26/07/2024 13:35<\/td><td class=\"nro_caso\">Tarcisio Granadillo Martinez 2do par<\/td><td class=\"estado\">        Confirmación\n<\/td><td class=\"frd center\">15/08/2024<\/td><td class=\"actions\"><div class=\"actions \"><a class=\"silentprint\" href=\"/ventas/pedidos_laboratorio/8469745.pdf\">Imprimir<\/a> | <a class=\"silentprint\" href=\"/ventas/facturacion_automatica.pdf?codigo=682243900\">Factura<\/a><\/div><\/td><\/tr><\/tbody><\/table>\n\n  <div class=\"paginator apple_pagination ajax\">\n    Mostrando registros <b>1&nbsp;-&nbsp;2<\/b> de <b>2<\/b> en total\n    \n  <\/div>\n");
$(":input:focus").select();
$('.export-link').attr('href', "/ventas/pedidos?format=xlsx&amp;q%5Bcargado_en_periodo%5D=all_history");`;
ok('de la respuesta JS sale el HTML de la tabla, sin los escapes de Rails', () => {
    const html = extraerHtmlDeRespuestaJs(RESPUESTA_JS);
    assert.ok(html.includes('<table class="datatable kb-table" id="pedidos">'));
    assert.ok(html.includes('</td>'));
    assert.equal(extraerHtmlDeRespuestaJs('$("#flash-container").html("");'), null);
});
ok('cada fila trae nº de trabajo, fecha, caso, estado, despacho estimado y los dos PDFs', () => {
    const filas = parsearListado(extraerHtmlDeRespuestaJs(RESPUESTA_JS));
    assert.equal(filas.length, 2);
    assert.deepEqual(filas[0], {
        id: '8669159', numero: '6981382L', fecha: '18/10/2024 14:24', nroCaso: 'Burban Nahuel - padre Juan carlos',
        estado: 'Despachado', despachoEstimado: '22/10/2024',
        pdfPedido: '/ventas/pedidos_laboratorio/8669159.pdf',
        pdfFactura: '/ventas/facturacion_automatica.pdf?codigo=698138200', codigoFactura: '698138200',
    });
    assert.equal(filas[1].estado, 'Confirmación');
});
ok('el paginador dice cuántos hay en total y qué páginas faltan', () => {
    const pag = leerPaginador(extraerHtmlDeRespuestaJs(RESPUESTA_JS));
    assert.deepEqual(pag, { desde: 1, hasta: 2, total: 2, paginas: [] });
    const conPaginas = leerPaginador('<div class="paginator apple_pagination ajax"> Mostrando registros <b>1&nbsp;-&nbsp;25</b> de <b>60</b> en total <a href="/ventas/pedidos?page=2&amp;q=1">2</a> <a href="/ventas/pedidos?page=3">3</a> <a href="/ventas/pedidos?page=2">›</a></div>');
    assert.deepEqual(conPaginas, { desde: 1, hasta: 25, total: 60, paginas: [2, 3] });
});
ok('las fechas del portal son hora de Argentina (−03:00)', () => {
    assert.equal(fechaArgentina('18/10/2024 14:24').toISOString(), '2024-10-18T17:24:00.000Z');
    assert.equal(fechaArgentina('22/10/2024').toISOString(), '2024-10-22T03:00:00.000Z');
    assert.equal(fechaArgentina(''), null);
    assert.equal(fechaArgentina('Martes 22 de Octubre'), null);
});
ok('el pedido normalizado: nº, caso como referencia y cliente, estado, fechas, segundo par', () => {
    const [p1, p2] = parsearListado(extraerHtmlDeRespuestaJs(RESPUESTA_JS)).map(normalizarPedido);
    assert.equal(p1.portalNumber, '6981382L');
    assert.equal(p1.internalRef, 'Burban Nahuel - padre Juan carlos');
    assert.equal(p1.cliente, p1.internalRef);
    assert.equal(p1.status, 'DESPACHADO');
    assert.equal(p1.statusRaw, 'Despachado');
    assert.equal(p1.pair, null);
    assert.equal(p1.enteredAt.toISOString(), '2024-10-18T17:24:00.000Z');
    assert.equal(p1.estimatedAt.toISOString(), '2024-10-22T03:00:00.000Z');
    assert.equal(p1.raw.pdfFactura, 'https://gestion.vitolen.com/ventas/facturacion_automatica.pdf?codigo=698138200');
    assert.equal(p2.pair, 2);
    assert.equal(p2.status, 'INGRESADO');
});
ok('un caso vacío no inventa referencia ni cliente', () => {
    const p = normalizarPedido({ id: '1', numero: '1L', fecha: '', nroCaso: '  ', estado: 'Despachado', despachoEstimado: '', pdfPedido: null, pdfFactura: null, codigoFactura: null });
    assert.equal(p.internalRef, null);
    assert.equal(p.cliente, null);
    assert.equal(p.enteredAt, null);
});
ok('el pase rápido pide 30 días; la pasada completa, todo el historial', () => {
    assert.equal(periodoDeListado(21), 'last_30_days');
    assert.equal(periodoDeListado(60), 'last_90_days');
    assert.equal(periodoDeListado(undefined), 'all_history');
    assert.equal(periodoDeListado(400), 'all_history');
    assert.equal(urlListado('all_history'), '/ventas/pedidos?utf8=%E2%9C%93&q%5Bcargado_en_periodo%5D=all_history&q%5Bvista%5D=lista&commit=Buscar');
    assert.ok(urlListado('last_30_days', 2).endsWith('&page=2'));
});
ok('el pedido del portal se vincula a la venta por el código corto que el vendedor carga como caso', () => {
    const fila = { id: '9', numero: '7000001L', fecha: '01/10/2026 10:00', nroCaso: '#s3ep', estado: 'Confirmación', despachoEstimado: '08/10/2026', pdfPedido: null, pdfFactura: null, codigoFactura: null };
    const venta = ventaDelPedido(normalizarPedido(fila), [{ id: 'cmupti2m00005bva8sqrls3ep', labOrderNumber: null, postSaleNumbers: [], clientName: 'Prueba' }]);
    assert.equal(venta?.id, 'cmupti2m00005bva8sqrls3ep');
});

console.log('\n— Vitolen: cuenta corriente —');
// Markup real del portal (3/10/2026), recortado: encabezado de cuenta, una
// factura, su nota de crédito, un recibo sin link y el paginador suelto.
const CUENTA_HTML = `<div id="page-movimientos-index"><table class="datatable mbn" id="movimientos">
      <thead><tr><th>Fecha</th><th>Comprobante</th><th>Estado</th><th>Vencimiento</th><th>Cancela a</th><th class="right">Debe</th><th class="right">Haber</th><th class="right">Saldo</th></tr></thead>
      <tbody>
          <tr><td colspan="10" class="strong">11302 - ATELIER OPTICA- CORDOBA</td></tr>
          <tr><td>19/08/2024</td><td><span title="Total: $195.294,00"><a class="silentprint" href="/ventas/comprobantes/8230155.pdf">FA 0067-01186779</a></span></td><td>Cancelado</td><td>30/08/2024</td><td></td><td class="right">$195.294,00</td><td class="right"></td><td class="right">$635.791,59</td></tr>
          <tr><td>19/08/2024</td><td><span title="Total: $195.294,00"><a class="silentprint" href="/ventas/comprobantes/8230156.pdf">NCA 0067-00012681</a></span></td><td>Cancelado</td><td>30/08/2024</td><td><a class="silentprint" href="/ventas/comprobantes/8230155.pdf">FA 0067-01186779</a></td><td class="right"></td><td class="right">$195.294,00</td><td class="right">$440.497,59</td></tr>
          <tr><td>30/07/2024</td><td><span title="Total: $159.359,90"><a class="silentprint" href="/ventas/comprobantes/8182860.pdf">FA 0067-01168210</a></span></td><td>Cancelado</td><td>09/08/2024</td><td></td><td class="right">$159.359,90</td><td class="right"></td><td class="right">$159.359,90</td></tr>
          <tr><td>06/09/2024</td><td>REC 00890360</td><td>Cancelado</td><td>06/09/2024</td><td><a class="silentprint" href="/ventas/comprobantes/8182860.pdf">FA 0067-01168210</a></td><td class="right"></td><td class="right">$159.359,90</td><td class="right">$281.137,69</td></tr>
      </tbody></table>
  Mostrando registros <b>1&nbsp;-&nbsp;20</b> de <b>22</b> en total <span class="previous_page disabled">« Anterior</span> <em class="current">1</em> <a rel="next" href="/contabilidad/movimientos?commit=Buscar&amp;page=2&amp;q%5Bdesde%5D=01%2F01%2F2024">2</a> <a class="next_page" rel="next" href="/contabilidad/movimientos?commit=Buscar&amp;page=2">Siguiente »</a></div>`;
ok('cada movimiento trae cuenta, fecha, comprobante con tipo, estado, cancela a, importes, total y PDF', () => {
    const m = parsearCuentaCorriente(CUENTA_HTML);
    assert.equal(m.length, 4);
    assert.deepEqual({ ...m[0], fecha: m[0].fecha.toISOString(), vencimiento: m[0].vencimiento.toISOString() }, {
        cuenta: '11302 - ATELIER OPTICA- CORDOBA', fecha: '2024-08-19T03:00:00.000Z', comprobante: 'FA 0067-01186779', tipo: 'FA', numero: '0067-01186779',
        estado: 'Cancelado', vencimiento: '2024-08-30T03:00:00.000Z', cancelaA: null, debe: 195294, haber: null, saldo: 635791.59, total: 195294, pdf: '/ventas/comprobantes/8230155.pdf',
    });
    assert.equal(m[1].tipo, 'NCA');
    assert.equal(m[1].cancelaA, 'FA 0067-01186779');
    assert.equal(m[1].haber, 195294);
    assert.equal(m[3].tipo, 'REC');
    assert.equal(m[3].pdf, null);
    assert.equal(m[3].total, null);
    assert.equal(parsearCuentaCorriente('<html>sin tabla</html>').length, 0);
});
ok('importes argentinos: miles con punto, decimales con coma', () => {
    assert.equal(importeArgentino('$159.359,90'), 159359.9);
    assert.equal(importeArgentino('$5.183,64'), 5183.64);
    assert.equal(importeArgentino('$0,00'), 0);
    assert.equal(importeArgentino(''), null);
    assert.equal(tipoDeComprobante('ND 0001-00000001'), 'OTRO');
});
ok('el paginador suelto de la cuenta corriente también se lee', () => {
    assert.deepEqual(leerPaginadorCuenta(CUENTA_HTML), { desde: 1, hasta: 20, total: 22, paginas: [2] });
});
ok('una factura anulada entera por su nota de crédito no es costo; la cancelada por recibo sí', () => {
    const vigentes = facturasVigentes(parsearCuentaCorriente(CUENTA_HTML));
    assert.deepEqual(vigentes.map(f => f.comprobante), ['FA 0067-01168210']);
});
ok('la URL de la cuenta corriente pide "Todos" desde la fecha, en las dos cuentas', () => {
    const u = urlCuentaCorriente(new Date(2024, 0, 1));
    assert.ok(u.startsWith('/contabilidad/movimientos?utf8=%E2%9C%93&q%5Bcondicion_eq%5D=&q%5Bdesde%5D=01%2F01%2F2024&q%5Bhasta%5D=&q%5Bcuentas_ids%5D=12019%2C12020&q%5Bcuentas_ids_mode%5D=include&commit=Buscar'), u);
    assert.ok(urlCuentaCorriente(new Date(2024, 0, 1), null, 2).endsWith('&page=2'));
});

console.log(fallas === 0 ? '\n✅ Marco de módulos de laboratorio: todo en orden.\n' : `\n❌ ${fallas} falla(s).\n`);
process.exit(fallas === 0 ? 0 : 1);

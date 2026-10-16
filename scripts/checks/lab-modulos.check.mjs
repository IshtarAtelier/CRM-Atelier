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
import { transicionDeVenta, estadoConjunto, estadoConjuntoDeVenta, paresCompletos, numeroProvisorio, numerosQueFaltan } from '../../src/services/lab-modules/estados.ts';
import { ventaDelPedido, cambioEnPedido, ventasSinPedidoEnPortal, pedidosAtrasados } from '../../src/services/lab-modules/espejo.ts';
import { transicionValida, borradorVivo, puedeAprobar, portalSinResolver, colgados, SALIDAS_A_ERROR_CON_PRUEBA, Borradores } from '../../src/services/lab-modules/carga/borrador.ts';
import { DURACION_TURNO_MIN, RENOVAR_TURNO_CADA_MS } from '../../src/services/lab-modules/portal/turno.ts';
import { CARGAS } from '../../src/services/lab-modules/carga/registro.ts';
import { LABS_CON_CARGA_ASISTIDA, NOMBRE_DE_LAB } from '../../src/lib/laboratorios/identidad.ts';
import { statSync } from 'node:fs';
import { join as unirRuta } from 'node:path';
import { tocaPaseRapido } from '../../src/services/lab-modules/corrida.ts';
import { retiroAutomaticoPermitido } from '../../src/services/lab-modules/retiro.ts';
import { idDeBorradorDeUrl, numeroDeTrabajoDe, estadoDeCabecera, resumenComparable, leerResumen } from '../../src/services/lab-modules/vitolen/resumen.ts';
import { cambiosAMano, impactoDeCambios, lineasDeCambios, precioDeCodigo, DESCUENTO_SIN_AR } from '../../src/services/lab-modules/vitolen/cambios-a-mano.ts';
import { tocaPasadaCompleta } from '../../src/services/lab-modules/corrida.ts';
import { armarFormulario, codigoDeCristal, tipoRecetaDe, esSegundoParDePromo, diferenciasDePayloadVitolen, cristalesPorPar, tipoArmazonDelPortal, TIPOS_ARMAZON } from '../../src/services/lab-modules/vitolen/carga.ts';
import { cristalesPorArmazon } from '../../src/lib/order-frames.ts';
import { rolesDeLaPromoHoya, rolDeLaPromo } from '../../src/lib/laboratorios/vitolen-promo.ts';
import { CATALOGO_VITOLEN, cristalVitolenPorNombre } from '../../src/lib/laboratorios/vitolen-catalogo.ts';
import { importeEsperadoSegundoPar, importeEsperadoSegundoParDe, segundoParCobradoDeMas } from '../../src/lib/laboratorios/vitolen-promo.ts';
import { estadoDe } from '../../src/services/lab-modules/vitolen/estados.ts';
import { materialDelPortal, disenoDelPortal, colorDe } from '../../src/services/lab-modules/vitolen/materiales.ts';
import { DISENOS_PORTAL } from '../../src/services/lab-modules/vitolen/portal-materiales.ts';
import { parsearCuentaCorriente, leerPaginadorCuenta, importeArgentino, facturasVigentes, urlCuentaCorriente, tipoDeComprobante } from '../../src/services/lab-modules/vitolen/cuenta-corriente.ts';
import { parsearFacturaVitolen, parsearFacturasDelPedido, pedidoDeCodigo, codigoDePedido, costoFacturadoDelPedido, pdfCoincideConCuenta } from '../../src/services/lab-modules/vitolen/comprobantes.ts';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { LABS_FACTURA_A } from '../../src/services/lab-recon/cost-matching.ts';
import { extraerHtmlDeRespuestaJs, parsearListado, leerPaginador, fechaArgentina, normalizarPedido, periodoDeListado, urlListado } from '../../src/services/lab-modules/vitolen/pedidos.ts';
import { labKeyDeNombre } from '../../src/services/lab-recon/types.ts';
import { armarCatalogo } from '../maintenance/precios-vitolen/generar-catalogo-ts.mjs';
import { leerLista } from '../maintenance/precios-vitolen/subir-catalogo-vitolen.mjs';
import { estadoDeFila, parDeFila, fechaDelPortal, fechaDelPortalEnTexto, esTrabado, normalizarPedido as normalizarPedidoGO, seguirPaginando, numerosNoEncontrados, numerosActivosDeVenta, detalleDeFila, resumenTracker, diasDesde, comprobantesDeFila, TEXTO_NO_ENCONTRADO } from '../../src/services/lab-modules/grupo-optico/pedidos.ts';
import { MODULO_GRUPO_OPTICO } from '../../src/services/lab-modules/grupo-optico/modulo.ts';
import { REGISTRO_MODULOS } from '../../src/services/lab-modules/registro.ts';

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
ok('un 2x1 no termina hasta que lleguen AMBOS pares (Ishtar, 3/10/2026)', () => {
    assert.equal(paresCompletos(2, 1), false);
    assert.equal(paresCompletos(2, 2), true);
    assert.equal(paresCompletos(1, 1), true);
    assert.equal(paresCompletos(0, 1), true, 'sin cristales contados, un pedido alcanza');
    assert.equal(paresCompletos(1, 0), false);
    // Un solo pedido TERMINADO en una venta de dos pares: EN_PROCESO, nunca FINISHED.
    assert.equal(estadoConjuntoDeVenta(['TERMINADO'], 2), 'EN_PROCESO');
    assert.equal(estadoConjuntoDeVenta(['DESPACHADO'], 2), 'EN_PROCESO');
    assert.equal(transicionDeVenta('IN_PROGRESS', estadoConjuntoDeVenta(['TERMINADO'], 2)), null);
    assert.equal(transicionDeVenta('SENT', estadoConjuntoDeVenta(['TERMINADO'], 2)), 'IN_PROGRESS');
    // Con los dos pedidos, manda el más atrasado como siempre.
    assert.equal(estadoConjuntoDeVenta(['TERMINADO', 'TERMINADO'], 2), 'TERMINADO');
    assert.equal(estadoConjuntoDeVenta(['TERMINADO', 'EN_PROCESO'], 2), 'EN_PROCESO');
    // Un anulado no cuenta como par vivo: TERMINADO + ANULADO en un 2x1 sigue faltando uno.
    assert.equal(estadoConjuntoDeVenta(['TERMINADO', 'ANULADO'], 2), 'EN_PROCESO');
    assert.equal(estadoConjuntoDeVenta(['TERMINADO', 'ANULADO'], 1), 'TERMINADO');
    // Lo que no es "terminado" no se toca: ingresado, desconocido, anulado.
    assert.equal(estadoConjuntoDeVenta(['INGRESADO'], 2), 'INGRESADO');
    assert.equal(estadoConjuntoDeVenta(['DESCONOCIDO'], 2), 'DESCONOCIDO');
    assert.equal(estadoConjuntoDeVenta(['ANULADO'], 2), 'ANULADO');
    assert.equal(estadoConjuntoDeVenta([], 2), 'DESCONOCIDO');
    // Un solo par: igual que estadoConjunto.
    assert.equal(estadoConjuntoDeVenta(['TERMINADO'], 1), 'TERMINADO');
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
ok('el día prometido no es atraso, y un DESCONOCIDO no se afirma atrasado', () => {
    const r = pedidosAtrasados([
        { portalNumber: 'hoy', cliente: null, status: 'EN_PROCESO', estimatedAt: hace(6 * 3600000) },
        { portalNumber: 'raro', cliente: null, status: 'DESCONOCIDO', estimatedAt: hace(5 * 86400000) },
        { portalNumber: 'si', cliente: null, status: 'INGRESADO', estimatedAt: hace(2 * 86400000) },
    ], ahora);
    assert.deepEqual(r.map(x => x.portalNumber), ['si']);
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
    // La venta guarda el nombre SIN la marca (productNameSnapshot = modelo): el
    // 15/10/2026 la primera venta real (Moroncini) no se podía preparar por esto.
    assert.equal(cristalVitolenPorNombre('Array 2 - 1.60 Blue Filter UV-420')?.nombre, 'HOYA ARRAY 2 - 1.60 BLUE FILTER UV-420');
    assert.equal(cristalVitolenPorNombre('Mi Primer Hoya Array 2 - 1.50 Clear Blue Filter')?.linea, 'mph-array-2');
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
        const r = materialDelPortal(cristal(nombre), { color: /POLARIZED|SENSITY/.test(nombre) ? 'Gris' : null });
        assert.equal(r.opcion?.id, id, `${nombre}: ${r.motivo ?? r.opcion?.texto}`);
        assert.ok(!/wrap/i.test(r.opcion.texto));
    }
});
ok('todo el catálogo progresivo de Hoya resuelve a una opción (Lifestyle con variante)', () => {
    const sinResolver = [];
    for (const c of CATALOGO_VITOLEN) {
        if (!disenoDelPortal(c)) continue;
        for (const variante of (c.variantes.length > 1 ? c.variantes : [null])) {
            const r = materialDelPortal(c, { variante, color: /sensity|polari/i.test(c.material) ? 'Gris' : null });
            if (!r.opcion) sinResolver.push(`${c.nombre}${variante ? ` (${variante})` : ''}: ${r.motivo}`);
        }
    }
    assert.deepEqual(sinResolver, []);
});
ok('el color de la venta elige el Sensity / Polarized; con varios colores y sin color no se inventa; un color que no existe se dice', () => {
    assert.equal(colorDe('Marrón'), 'Brown');
    assert.equal(colorDe('gris'), 'Grey');
    assert.equal(colorDe('G15'), 'Green');
    assert.equal(colorDe(''), null);
    const pol = cristal('HOYA ARRAY 2 - 1.59 POLARIZED');
    assert.equal(materialDelPortal(pol, { color: 'Marrón' }).opcion.id, '1642');
    assert.equal(materialDelPortal(pol, { color: 'verde' }).opcion.id, '1643');
    const sinColor = materialDelPortal(pol, { color: null });
    assert.equal(sinColor.opcion, null, 'tres colores: hay que elegir');
    assert.match(sinColor.motivo, /necesita el color/);
    assert.equal(materialDelPortal(cristal('HOYA ARRAY 2 - 1.50 SENSITY 2'), { color: null }).opcion?.id, '1637', 'un solo color: no hay nada que elegir');
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
    // dos pares de verdad: los cristales del par 1 y una copia en el armazón 2
    v.items.push(...v.items.filter(i => i.eye).map(i => ({ ...i, framePosition: 2 })));
    v.frames = [v.frames[0], { position: 2, shape: null, a: '50', b: '38', dbl: '17', edc: '54', details: null, heightOD: 22, heightOI: 22 }];
    const r = armarFormulario(v, { pair: 2, forma: 'Forma 3', ejeDiagonal: 20, pedidoOrigen: '5001234' });
    assert.equal(r.ok, true);
    assert.equal(r.payload.pedidoOrigen, '5001234');
    assert.equal(r.payload.armazon.largo, 50);
});
ok('dos pares SIN armazón asignado se arman en el orden del carrito (como la promo del 2º par)', () => {
    // Así llegó la primera venta real (Moroncini, 15/10/2026): dos armazones y
    // cuatro cristales con framePosition vacío, nombre sin la marca.
    const v = ventaBase();
    const cristal = (eye, s) => ({ ...v.items[0], eye, productNameSnapshot: 'Array 2 - 1.60 Clear', sphereVal: s, framePosition: null });
    v.items = [cristal('OD', 1), cristal('OI', 2), cristal('OD', 3), cristal('OI', 4)];
    v.frames = [
        { position: 1, shape: null, a: '56', b: '39', dbl: '17', edc: '58', details: 'Harper', heightOD: 25, heightOI: 25 },
        { position: 2, shape: null, a: '58', b: '40', dbl: '18', edc: '61', details: 'Aviador', heightOD: 26, heightOI: 26 },
    ];
    const p1 = armarFormulario(v, { forma: 'Forma 1', ejeDiagonal: 0 });
    const p2 = armarFormulario(v, { pair: 2, forma: 'Forma 1', ejeDiagonal: 0, pedidoOrigen: '1L' });
    assert.equal(p1.ok, true, p1.faltantes.join(' · '));
    assert.equal(p2.ok, true, p2.faltantes.join(' · '));
    assert.deepEqual([p1.payload.od.esferico, p1.payload.oi.esferico, p1.payload.armazon.largo], [1, 2, 56]);
    assert.deepEqual([p2.payload.od.esferico, p2.payload.oi.esferico, p2.payload.armazon.largo], [3, 4, 58]);
});
ok('qué par es cada cristal lo decide UN solo repartidor: la promo del 2º par, la carga de Vitolen y el cruce coinciden en todas las permutaciones', () => {
    const LS = 'HOYA LIFESTYLE 4 - 1.50 CLEAR', TACT = 'HOYA TACT BKS - 1.50 CLEAR BLUE FILTER';
    const c = (fp, eye, nombre, price) => ({ eye, framePosition: fp, price, quantity: 1, productNameSnapshot: nombre, laboratorySnapshot: 'VITOLEN', productCategorySnapshot: 'Cristal', product: { name: nombre, category: 'Cristal' } });
    const rolDe = (roles, pair) => (!roles ? null : pair === roles.conCargo ? 'PRIMER_PAR' : pair === roles.sinCargo ? 'SEGUNDO_PAR' : null);
    // el barato PRIMERO en el carrito, sin armazón asignado: el caro (LS4, par 2 por orden) es el 1º de la promo
    const barataPrimero = [c(null, 'OD', TACT, 80000), c(null, 'OI', TACT, 80000), c(null, 'OD', LS, 100000), c(null, 'OI', LS, 100000)];
    const roles = rolesDeLaPromoHoya(barataPrimero);
    assert.deepEqual([roles.conCargo, roles.sinCargo, roles.porValor], [2, 1, true]);
    const porPar = cristalesPorPar({ items: barataPrimero });
    assert.equal(porPar.get(1)[0].productNameSnapshot, TACT); assert.equal(porPar.get(2)[0].productNameSnapshot, LS);
    assert.deepEqual([rolDe(roles, 1), rolDe(roles, 2)], ['SEGUNDO_PAR', 'PRIMER_PAR']);
    // carrito OD, OD, OI, OI sin asignar: el 2º OD y el 2º OI son del par 2 (antes tres cristales caían en el par 2)
    const intercalado = [c(null, 'OD', TACT, 80000), c(null, 'OD', LS, 100000), c(null, 'OI', TACT, 80000), c(null, 'OI', LS, 100000)];
    const pp = cristalesPorArmazon({ items: intercalado });
    assert.deepEqual(pp.get(1).map(i => i.eye + ' ' + i.productNameSnapshot), ['OD ' + TACT, 'OI ' + TACT]);
    assert.deepEqual(pp.get(2).map(i => i.eye + ' ' + i.productNameSnapshot), ['OD ' + LS, 'OI ' + LS]);
    assert.equal(rolesDeLaPromoHoya(intercalado).conCargo, 2);
    // venta mixta: Grupo Óptico asignado al armazón 1, Vitolen sin asignar → Vitolen cae en el armazón 2 (el libre)
    const go = (eye) => ({ eye, framePosition: 1, price: 50000, quantity: 1, productNameSnapshot: 'Multifocal Smart FREE · Orgánico Blanco 1.49', laboratorySnapshot: 'GRUPO OPTICO', productCategorySnapshot: 'Cristal', product: { name: 'Multifocal Smart FREE · Orgánico Blanco 1.49', category: 'Cristal' } });
    const mixta = cristalesPorPar({ items: [go('OD'), go('OI'), c(null, 'OD', LS, 100000), c(null, 'OI', LS, 100000)] });
    assert.deepEqual([...mixta.keys()], [2]);
    // asignación PARCIAL: el caro asignado al armazón 1, el barato sin asignar → el barato cae en el armazón libre (2), no se pega al 1
    const parcial = cristalesPorPar({ items: [c(null, 'OD', TACT, 80000), c(null, 'OI', TACT, 80000), c(1, 'OD', LS, 100000), c(1, 'OI', LS, 100000)] });
    assert.deepEqual([parcial.get(1)[0].productNameSnapshot, parcial.get(2)[0].productNameSnapshot], [LS, TACT]);
    assert.deepEqual([rolesDeLaPromoHoya([c(null, 'OD', TACT, 80000), c(null, 'OI', TACT, 80000), c(1, 'OD', LS, 100000), c(1, 'OI', LS, 100000)]).conCargo], [1]);
    // con armazón asignado manda el armazón, no el orden ni el valor
    const asignado = rolesDeLaPromoHoya([c(2, 'OD', TACT, 80000), c(2, 'OI', TACT, 80000), c(1, 'OD', LS, 100000), c(1, 'OI', LS, 100000)]);
    assert.deepEqual([asignado.conCargo, asignado.sinCargo], [1, 2]);
    // mismo valor sin asignar: queda el orden del carrito (par 1 con cargo)
    const iguales = rolesDeLaPromoHoya([c(null, 'OD', LS, 100000), c(null, 'OI', LS, 100000), c(null, 'OD', LS, 100000), c(null, 'OI', LS, 100000)]);
    assert.deepEqual([iguales.conCargo, iguales.sinCargo, iguales.porValor], [1, 2, false]);
});
const RESUMEN_MORONCINI = `Pedido de Laboratorio
Nro de Trabajo\tPor Asignar\tFecha\t15/10/2026 22:10
Cliente\t11302 - ATELIER OPTICA- CORDOBA\tNro de Caso Interno\t#TDHB 1°par
Estado\tConfirmación
\t
Receta

\t\tTipo de Lente\tMarcas y Modelos de Lentes\tOrigen
OD\tProgresivo\t10072 - Array 2 1.60 Hilux MR-8 Filter 420\tBloque/Lente de Vitolen
OI\tProgresivo\t10072 - Array 2 1.60 Hilux MR-8 Filter 420\tBloque/Lente de Vitolen
\t\tEsférico\tCilíndrico\tEje Cil.\tAdición\tDNP-L\tAltura Pupilar Lejos\tDist. Vértice\tÁng. Pantoscópico\tÁng Envolvencia
OD\t+2.25\t-0.75\t90\t2.75\t33.00\t25.00\t14\t6\t4
OI\t+1.75\t-0.50\t101\t2.75\t34.00\t25.00\t14\t6\t4
\t
Armazón

Origen\tArmazón del cliente
Medidas\tLargo\tAltura\tDiag. Mayor\tEje\tPuente\tTipo\tFuncionalidad
56.00\t39.00\t58.00\t0\t17.00\tZilo\tAro Convencional 
Forma OD - 1

Características\tHarper Color Marron
\t
Trabajos

Tratamientos\tUltra Hi-Vision
Montajes\tCalibrado
© 2026 Vitolen S.A | Av. Roque Sáenz Peña 786`;
ok('el resumen del portal se lee campo por campo (el de Moroncini, 15/10/2026)', () => {
    const r = leerResumen(RESUMEN_MORONCINI);
    assert.deepEqual(r.codigos, { od: '10072', oi: '10072' });
    assert.equal(r.modelos.od, 'Array 2 1.60 Hilux MR-8 Filter 420');
    assert.deepEqual(r.tratamientos, ['Ultra Hi-Vision']); assert.deepEqual(r.montajes, ['Calibrado']);
    assert.deepEqual(r.armazon, { largo: '56.00', altura: '39.00', diagonal: '58.00', eje: '0', puente: '17.00', tipo: 'Zilo', forma: 'Forma OD - 1' });
    assert.deepEqual(r.angulos.od, { vertice: '14', pantoscopico: '6', envolvencia: '4' });
    assert.equal(r.graduacion.oi, '+1.75 -0.50 101 2.75 34.00 25.00');
    assert.equal(leerResumen('').codigos.od, null);
});
ok('un cambio a mano en el portal se detecta y se valúa con la lista (cristal, AR, calibrado); lo demás se anota sin costo', () => {
    const antes = leerResumen(RESUMEN_MORONCINI);
    const precios = { calibrado: 23000 };
    assert.deepEqual(cambiosAMano(antes, leerResumen(RESUMEN_MORONCINI), precios), []);
    // destildar el calibrado y cambiar vértice/pantoscópico (como la carga a mano de Ishtar)
    const t1 = RESUMEN_MORONCINI.replace('Montajes\tCalibrado\n', '').replace(/\t14\t6\t4/g, '\t12\t8\t4');
    const c1 = cambiosAMano(antes, leerResumen(t1), precios);
    assert.deepEqual(c1.map(c => [c.campo, c.costo]), [['Montajes', -23000], ['Vértice / pantoscópico / envolvencia OD', 0], ['Vértice / pantoscópico / envolvencia OI', 0]]);
    assert.deepEqual(impactoDeCambios(c1), { costoExtra: -23000, aConfirmar: false });
    assert.match(lineasDeCambios(c1)[0], /Montajes: Calibrado → ninguno \(se sacó el calibrado: −\$ 23\.000\)/);
    // cambiar el cristal a otro código de la lista: diferencia de lista por par
    const p10072 = precioDeCodigo('10072'); assert.ok(p10072.precio > 0, 'el 10072 tiene precio en la lista');
    const otro = CATALOGO_VITOLEN.find(c => c.linea === 'lifestyle-4' && c.precioLista);
    const t2 = RESUMEN_MORONCINI.replace(/10072 - Array 2 1.60 Hilux MR-8 Filter 420/g, `${otro.codigos[0]} - ${otro.nombre}`);
    const c2 = cambiosAMano(antes, leerResumen(t2), precios);
    assert.equal(c2.length, 2); assert.equal(c2[0].costo, otro.precioLista - p10072.precio);
    // sacar el antirreflejo: la lista lo incluye, se descuenta lo de "pedido sin AR"
    const t3 = RESUMEN_MORONCINI.replace('Tratamientos\tUltra Hi-Vision\n', '');
    const c3 = cambiosAMano(antes, leerResumen(t3), precios);
    assert.deepEqual(c3.map(c => [c.campo, c.costo]), [['Tratamientos', -DESCUENTO_SIN_AR]]);
    // agregar un tratamiento que la lista no valúa: queda "a confirmar"
    const t4 = RESUMEN_MORONCINI.replace('Tratamientos\tUltra Hi-Vision', 'Tratamientos\tUltra Hi-Vision\tColor');
    const c4 = cambiosAMano(antes, leerResumen(t4), precios);
    assert.equal(c4[0].costo, null); assert.equal(impactoDeCambios(c4).aConfirmar, true);
});
ok('el tipo de armazón elegido al preparar sobrevive al re-armado del confirm (round-trip etiqueta → portal → etiqueta)', () => {
    for (const t of TIPOS_ARMAZON) assert.equal(tipoArmazonDelPortal(t)?.[2], t);
    assert.equal(tipoArmazonDelPortal('acetato')?.[2], 'Zilo');
    assert.equal(tipoArmazonDelPortal(null), null);
});
ok('el tipo de armazón se elige al preparar; sin él (la venta casi nunca lo trae) no se arma', () => {
    const v = ventaBase();
    v.labFrameType = null;
    assert.ok(armarFormulario(v, { forma: 'Forma 1', ejeDiagonal: 0 }).faltantes.some(f => /tipo de armazón/.test(f)));
    const r = armarFormulario(v, { forma: 'Forma 1', ejeDiagonal: 0, tipoArmazon: 'Ranurado' });
    assert.equal(r.ok, true);
    assert.equal(r.payload.armazon.tipo, 'Ranurado');
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

console.log('\n— Carga asistida: lo que la auditoría del 3/10 pidió —');
ok('APROBADO no va a ERROR por la tabla (el portal puede haber confirmado); puede volver a revisión', () => {
    assert.equal(transicionValida('APROBADO', 'ERROR'), false);
    assert.equal(transicionValida('APROBADO', 'EN_REVISION'), true);
    assert.equal(transicionValida('PREPARADO', 'ERROR'), true);
});
ok('los laboratorios con carga asistida que conoce el navegador son exactamente los del registro del servidor', () => {
    assert.deepEqual([...LABS_CON_CARGA_ASISTIDA].sort(), CARGAS.map(c => c.lab).sort());
    for (const lab of LABS_CON_CARGA_ASISTIDA) assert.ok(NOMBRE_DE_LAB[lab], `falta el nombre de ${lab}`);
});
ok('las salidas a ERROR con prueba en el WHERE están declaradas, y son exactamente las que Borradores tiene', () => {
    // La tabla dice que APROBADO → ERROR no existe "en general"; estas tres son
    // las excepciones, cada una con su prueba de que no hay pedido en el portal.
    // Si aparece una cuarta función que escriba ERROR con SQL crudo, tiene que
    // declararse acá (auditoría de arquitectura 3).
    assert.deepEqual(Object.keys(SALIDAS_A_ERROR_CON_PRUEBA).sort(), ['anular', 'invalidarPorBorradorDesaparecido', 'invalidarSinPedido']);
    for (const via of Object.keys(SALIDAS_A_ERROR_CON_PRUEBA)) assert.equal(typeof Borradores[via], 'function', `Borradores.${via} no existe`);
    for (const texto of Object.values(SALIDAS_A_ERROR_CON_PRUEBA)) assert.match(texto, /^(APROBADO|PREPARADO)/);
    // Y nadie escribe status = 'ERROR' por fuera de salirAError: se lee el código
    // de todos los módulos (un guardián que no puede fallar es peor que ninguno).
    const raiz = new URL('../../src/services/lab-modules/', import.meta.url).pathname;
    const archivos = [];
    const recorrer = (dir) => { for (const f of readdirSync(dir)) { const p = unirRuta(dir, f); if (statSync(p).isDirectory()) recorrer(p); else if (/\.ts$/.test(f)) archivos.push(p); } };
    recorrer(raiz);
    const escrituras = [];
    for (const f of archivos) {
        const texto = readFileSync(f, 'utf8');
        for (const m of texto.matchAll(/status\s*[:=]\s*'ERROR'/g)) escrituras.push(`${f.replace(raiz, '')}:${texto.slice(0, m.index).split('\n').length}`);
    }
    assert.deepEqual(escrituras, ['carga/borrador.ts:' + (readFileSync(unirRuta(raiz, 'carga/borrador.ts'), 'utf8').split('\n').findIndex(l => /SET status = 'ERROR'/.test(l)) + 1)], `escrituras de ERROR fuera de salirAError: ${escrituras.join(', ')}`);
});
ok('el turno guarda quién lo tiene y hasta cuándo; dura poco y se renueva seguido (si el proceso muere, el portal se libera solo)', () => {
    const t = leerTurno('2026-10-10T12:45:00.000Z|robot');
    assert.deepEqual(t, { vence: '2026-10-10T12:45:00.000Z', pasada: 'robot' });
    assert.equal(leerTurno('basura'), null);
    assert.ok(DURACION_TURNO_MIN <= 15, 'un turno sin renovar no puede bloquear el portal más de 15 min');
    assert.ok(RENOVAR_TURNO_CADA_MS * 3 <= DURACION_TURNO_MIN * 60_000, 'la renovación tiene que entrar al menos tres veces en la duración del turno');
});
ok('un borrador que dejó un pedido en el portal bloquea preparar otro hasta cancelarlo o confirmarlo', () => {
    assert.equal(portalSinResolver({ status: 'ERROR', resumenPortal: { portalDraftId: '10441994' } }), true);
    assert.equal(portalSinResolver({ status: 'RECHAZADO', resumenPortal: { portalDraftId: '10441994', canceladoEl: '2026-10-03' } }), false);
    assert.equal(portalSinResolver({ status: 'CARGADO', resumenPortal: { portalDraftId: '10441994' } }), false);
    assert.equal(portalSinResolver({ status: 'ERROR', resumenPortal: null }), false);
    assert.equal(portalSinResolver({ status: 'ERROR', resumenPortal: { pasos: [] } }), false);
});
ok('Vitolen: los roles de la promo salen de la MISMA regla con la que el CRM la cobra (líneas que la encienden, caro = 1º)', () => {
    const c = (fp, eye, nombre, price) => ({ eye, framePosition: fp, price, quantity: 1, productNameSnapshot: nombre, product: { name: nombre, category: 'Cristal' } });
    const LS = 'HOYA LIFESTYLE 4 - 1.50 CLEAR', TACT = 'HOYA TACT BKS - 1.50 CLEAR BLUE FILTER';
    const r = rolesDeLaPromoHoya([c(1, 'OD', LS, 100000), c(1, 'OI', LS, 100000), c(2, 'OD', LS, 100000), c(2, 'OI', LS, 100000)]);
    assert.deepEqual([r.conCargo, r.sinCargo, r.porValor], [1, 2, false]);
    // el par 2 más caro: es el 1º de la promo
    const caro = rolesDeLaPromoHoya([c(1, 'OD', LS, 90000), c(1, 'OI', LS, 90000), c(2, 'OD', LS, 100000), c(2, 'OI', LS, 100000)]);
    assert.deepEqual([caro.conCargo, caro.sinCargo], [2, 1]);
    // Tact solo puede ser 2º
    const tact = rolesDeLaPromoHoya([c(1, 'OD', TACT, 80000), c(1, 'OI', TACT, 80000), c(2, 'OD', LS, 100000), c(2, 'OI', LS, 100000)]);
    assert.deepEqual([tact.conCargo, tact.sinCargo], [2, 1]);
    // sin promo: un solo par, o una línea que no la enciende
    assert.equal(rolesDeLaPromoHoya([c(1, 'OD', LS, 100000), c(1, 'OI', LS, 100000)]), null);
    assert.equal(rolesDeLaPromoHoya([c(1, 'OD', TACT, 80000), c(1, 'OI', TACT, 80000), c(2, 'OD', TACT, 80000), c(2, 'OI', TACT, 80000)]), null);
    // un 3er par no tiene rol
    assert.equal(rolDeLaPromo(r, 3), null); assert.equal(rolDeLaPromo(r, 2), 'SEGUNDO_PAR'); assert.equal(rolDeLaPromo(null, 2), null);
});
ok('Vitolen: al confirmar, la venta de HOY tiene que armar lo aprobado (receta, diseño, armazón)', () => {
    const r = armarFormulario(ventaBase(), { forma: 'Forma 1', ejeDiagonal: 0 });
    assert.deepEqual(diferenciasDePayloadVitolen(r.payload, r.payload), []);
    const v = ventaBase(); v.items[0].sphereVal = 1.5;
    const hoy = armarFormulario(v, { forma: 'Forma 1', ejeDiagonal: 0 });
    assert.deepEqual(diferenciasDePayloadVitolen(r.payload, hoy.payload), ['OD']);
    assert.deepEqual(diferenciasDePayloadVitolen(r.payload, null), ['la venta ya no arma el pedido']);
});
ok('Vitolen: qué payload es el 2º par de la promo (con rol manda el rol; sin rol, el par 2; o si lleva pedido origen)', () => {
    assert.equal(esSegundoParDePromo({ par: 2, rolPromo: null }), false); // null = la regla dijo "sin promo"
    assert.equal(esSegundoParDePromo({ par: 2 }), true); // sin el campo = borrador viejo: el par 2 era el 2º
    assert.equal(esSegundoParDePromo({ par: 2, rolPromo: 'PRIMER_PAR' }), false);
    assert.equal(esSegundoParDePromo({ par: 1, rolPromo: 'SEGUNDO_PAR' }), true);
    assert.equal(esSegundoParDePromo({ par: 1, rolPromo: null }), false);
    assert.equal(esSegundoParDePromo({ par: 1, rolPromo: null, pedidoOrigen: '6981382L' }), true);
});
ok('Vitolen: el rol en la promo del 2º par lo decide quien prepara (el de mayor valor es el 1º); sin rol, el par 2 es el 2º', () => {
    const base = armarFormulario(ventaBase(), { forma: 'Forma 1', ejeDiagonal: 0 });
    assert.equal(base.payload.rolPromo, null); assert.equal(base.payload.pedidoOrigen, null);
    const segundo = armarFormulario(ventaBase(), { forma: 'Forma 1', ejeDiagonal: 0, rolPromo: 'SEGUNDO_PAR', pedidoOrigen: '6981382L' });
    assert.equal(segundo.payload.rolPromo, 'SEGUNDO_PAR'); assert.equal(segundo.payload.pedidoOrigen, '6981382L');
    // el 1º de la promo no lleva pedido origen aunque se lo pasen
    const primero = armarFormulario(ventaBase(), { forma: 'Forma 1', ejeDiagonal: 0, rolPromo: 'PRIMER_PAR', pedidoOrigen: '6981382L' });
    assert.equal(primero.payload.pedidoOrigen, null);
});
ok('un PREPARADO colgado 30 min va a ERROR (más que el peor caso del robot, ~22 min); un APROBADO colgado se reintenta, nunca ERROR', () => {
    const r = colgados([
        { id: 'p-viejo', status: 'PREPARADO', updatedAt: hace(35 * 60000) },
        { id: 'p-nuevo', status: 'PREPARADO', updatedAt: hace(22 * 60000) },
        { id: 'a-viejo', status: 'APROBADO', updatedAt: hace(35 * 60000) },
        { id: 'r', status: 'EN_REVISION', updatedAt: hace(500 * 60000) },
    ], ahora);
    assert.deepEqual(r, { aError: ['p-viejo'], aReintentar: ['a-viejo'] });
});
ok('lo que se aprueba es el resumen del portal: si cambia, no se confirma', () => {
    const a = 'Pedidos\nModificar | Cancelar\nPedido de Laboratorio\nNro de Trabajo\tPor Asignar\tFecha\t03/10/2026 12:24\nReceta\nOD\tProgresivo\t10070 - Array 2 1.60 Hilux MR-8 Clear\nArmazón\nForma OD - 3\nTrabajos\nMontajes\tCalibrado\n© 2026 Vitolen S.A';
    const b = a.replace('12:24', '13:00');
    const c = a.replace('Forma OD - 3', 'Forma OD - 4');
    assert.equal(resumenComparable(a), resumenComparable(b), 'la hora de la cabecera no cuenta');
    assert.notEqual(resumenComparable(a), resumenComparable(c), 'la forma sí');
    assert.ok(!resumenComparable(a).includes('Por Asignar'));
});
ok('la pasada completa se decide sola cada 20 h', () => {
    assert.equal(tocaPasadaCompleta(null, ahora), true);
    assert.equal(tocaPasadaCompleta(hace(2 * 3600000), ahora), false);
    assert.equal(tocaPasadaCompleta(hace(21 * 3600000), ahora), true);
});

console.log('\n— Aviso de retiro a las 24 h —');
ok('Grupo Óptico (sin módulo) avisa solo; Vitolen deja el aviso al vendedor', () => {
    const modulos = [{ nombre: 'Vitolen', patronProducto: /vitolen/i, avisoDeRetiroAutomatico: false }, { nombre: 'Otro', patronProducto: /otro/i }];
    assert.deepEqual(retiroAutomaticoPermitido([{ laboratorySnapshot: 'GRUPO OPTICO' }], modulos), { permitido: true, modulo: null });
    assert.deepEqual(retiroAutomaticoPermitido([{ laboratorySnapshot: 'VITOLEN' }, { laboratorySnapshot: null }], modulos), { permitido: false, modulo: 'Vitolen' });
    assert.deepEqual(retiroAutomaticoPermitido([{ product: { laboratory: 'Otro lab' } }], modulos), { permitido: true, modulo: 'Otro' });
    assert.deepEqual(retiroAutomaticoPermitido([], modulos), { permitido: true, modulo: null });
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
ok('el nº de Vitolen lleva L y vincula igual contra el campo de la venta', () => {
    const fila = { id: '9', numero: '6981382L', fecha: '01/10/2026 10:00', nroCaso: '', estado: 'En Proceso', despachoEstimado: '08/10/2026', pdfPedido: null, pdfFactura: null, codigoFactura: null };
    const ventas = [{ id: 'cm1', labOrderNumber: '6981382L', postSaleNumbers: [], clientName: 'A' }, { id: 'cm2', labOrderNumber: '6981382L, 6981390L', postSaleNumbers: [], clientName: 'B' }];
    assert.equal(ventaDelPedido(normalizarPedido(fila), [ventas[0]])?.id, 'cm1');
    assert.equal(ventaDelPedido(normalizarPedido(fila), ventas), null, 'dos ventas con el mismo nº: no se vincula');
    assert.deepEqual(numerosQueFaltan('6981382L', ['6981382L', '6981390L']), ['6981390L']);
    assert.deepEqual(numerosQueFaltan('6981382L, 6981390L', ['6981390L']), []);
});
ok('el pedido del portal se vincula a la venta por el código corto que el vendedor carga como caso', () => {
    const fila = { id: '9', numero: '7000001L', fecha: '01/10/2026 10:00', nroCaso: '#s3ep', estado: 'Confirmación', despachoEstimado: '08/10/2026', pdfPedido: null, pdfFactura: null, codigoFactura: null };
    const venta = ventaDelPedido(normalizarPedido(fila), [{ id: 'cmupti2m00005bva8sqrls3ep', labOrderNumber: null, postSaleNumbers: [], clientName: 'Prueba' }]);
    assert.equal(venta?.id, 'cmupti2m00005bva8sqrls3ep');
});

console.log('\n— Vitolen: la pantalla del borrador del portal —');
ok('"Crear" redirige al borrador con id propio; el formulario rechazado se queda sin id', () => {
    assert.equal(idDeBorradorDeUrl('https://gestion.vitolen.com/ventas/pedidos_laboratorio/10441994'), '10441994');
    assert.equal(idDeBorradorDeUrl('https://gestion.vitolen.com/ventas/pedidos_laboratorio/10441994/edit'), '10441994');
    assert.equal(idDeBorradorDeUrl('https://gestion.vitolen.com/ventas/pedidos_laboratorio'), null);
    assert.equal(idDeBorradorDeUrl('https://gestion.vitolen.com/ventas/pedidos_laboratorio/new'), null);
});
ok('el nº de trabajo aparece recién al confirmar ("Por Asignar" antes)', () => {
    assert.equal(numeroDeTrabajoDe('Pedido de Laboratorio\nNro de Trabajo\tPor Asignar\tFecha\t03/10/2026 12:24'), null);
    assert.equal(numeroDeTrabajoDe('Nro de Trabajo\t6981382L\tFecha\t18/10/2024 14:24'), '6981382L');
    assert.equal(estadoDeCabecera('Cliente\t11302\nEstado\tConfirmación\nObservaciones\tx'), 'Confirmación');
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
    // Fecha al mediodía UTC: en hora argentina sigue siendo el mismo día (el CI corre en UTC).
    const u = urlCuentaCorriente(new Date('2024-01-01T12:00:00Z'));
    assert.ok(u.startsWith('/contabilidad/movimientos?utf8=%E2%9C%93&q%5Bcondicion_eq%5D=&q%5Bdesde%5D=01%2F01%2F2024&q%5Bhasta%5D=&q%5Bcuentas_ids%5D=12019%2C12020&q%5Bcuentas_ids_mode%5D=include&commit=Buscar'), u);
    assert.ok(urlCuentaCorriente(new Date('2024-01-01T12:00:00Z'), null, 2).endsWith('&page=2'));
    // Y a las 23:00 de Argentina (02:00 UTC del día siguiente) el "desde" sigue siendo el día argentino.
    assert.ok(urlCuentaCorriente(new Date('2024-01-02T02:00:00Z')).includes('q%5Bdesde%5D=01%2F01%2F2024'));
});

console.log('\n— Vitolen: las facturas de un pedido (PDF) —');
// Texto REAL de una página del PDF facturacion_automatica.pdf del pedido
// 6981382L tal como lo entrega pdf2json (3/10/2026): el orden es el inverso
// al visual, con \r\n. El parser ancla por etiqueta, no por posición.
const PAGINA_FACTURA = [
    'Tribunales de la Provincia de Santa Fe, en la ciudad de Rafaela, renunciando a otros fueros inclusive el federal.',
    'TOTAL  $44.986,59',
    'Comprobante Autorizado',
    'IVA 21,0%  $7.807,59',
    'Gravado 21.0%  $37.179,00',
    'Vencimiento CAEA31/10/2024',
    'TOTALES',
    '(1) 24093IC05000715S ESTADOS UNIDOS',
    '00000001 Recargo Operativo                             2 21,0%  $364,50  $729,00',
    '00005150 Descuento L241 - 25% Amplitude Dual Blue Stock Rango Extendido       2 21,0% -$6.075,00 -$12.150,00',
    '209168521 Amplitude HD Dual Blue Stock Rango Extendido | Esf -7.00, Cil +2.50, Eje 90(1)  2 21,0% $24.300,00 $48.600,00',
    'CÓDIGO                     DESCRIPCIÓN                   CANT. IVA PRECIO UNIT. PRECIO TOTAL',
    'VENCIMIENTO CBTE 25/10/2024                               CONDICIÓN DE VTA Cuenta Corriente',
    'RAZÓN SOCIAL   PISSANO ISHTAR                             REMITO/CASO Nº  Burban Nahuel -',
    'SEÑOR(ES)    ATELIER OPTICA- CORDOBA                        CUENTA      11302',
    'Código 01',
    '698138200',
    'Ing. Brutos (C.M.): 92130521189203',
    'CUIT: 30-52118920-3',
    'Fecha de Emisión: 18/10/2024',
    'A',
    'Factura',
    'INNER - CORDOBA 17:00hs, COR - T2Nº 0067-01243373',
].join('\r\n');
const PAGINA_CALIBRADO = PAGINA_FACTURA
    .replace('Nº 0067-01243373', 'Nº 0032-00179696').replace('Fecha de Emisión: 18/10/2024', 'Fecha de Emisión: 21/10/2024')
    .replace('TOTAL  $44.986,59', 'TOTAL   $5.183,64').replace('Gravado 21.0%  $37.179,00', 'Gravado 21.0%  $4.284,00').replace('IVA 21,0%  $7.807,59', 'IVA 21,0%   $899,64')
    .replace(/^00000001 .*$/m, '00000001 Recargo Operativo   2 21,0%  $42,00  $84,00')
    .replace(/^00005150 .*$/m, '98009724 Descuento L241 - 30% Calibrados Stock   2 21,0%  -$900,00  -$1.800,00')
    .replace(/^209168521 .*$/m, '00007062 Calib. MonoStockOtrosMat   2 21,0%  $3.000,00  $6.000,00');
ok('una página del PDF es una factura: nº, fecha, código y nº de pedido, caso, líneas y totales', () => {
    const f = parsearFacturaVitolen(PAGINA_FACTURA);
    assert.equal(f.tipo, 'FA');
    assert.equal(f.numero, '0067-01243373');
    assert.equal(f.fecha.toISOString(), '2024-10-18T03:00:00.000Z');
    assert.equal(f.codigoPedido, '698138200');
    assert.equal(f.pedido, '6981382L');
    assert.equal(f.caso, 'Burban Nahuel -');
    assert.deepEqual(f.lineas.map(l => [l.codigo, l.cantidad, l.unitario, l.total]), [['00000001', 2, 364.5, 729], ['00005150', 2, -6075, -12150], ['209168521', 2, 24300, 48600]]);
    assert.equal(f.lineas[2].descripcion, 'Amplitude HD Dual Blue Stock Rango Extendido | Esf -7.00, Cil +2.50, Eje 90');
    assert.deepEqual([f.gravado, f.iva, f.total, f.lineasCompletas], [37179, 7807.59, 44986.59, true]);
    assert.equal(parsearFacturaVitolen('Las partes pactan que …'), null);
});
ok('el código del PDF es el nº de trabajo sin la L y con 00; y al revés', () => {
    assert.equal(pedidoDeCodigo('698138200'), '6981382L');
    assert.equal(pedidoDeCodigo('682240800'), '6822408L');
    assert.equal(pedidoDeCodigo('12'), null);
    assert.equal(codigoDePedido('6981382L'), '698138200');
    assert.equal(codigoDePedido('6981382'), '698138200');
});
ok('el pedido cuesta la suma de sus facturas vigentes: cristales + calibrado, con IVA', () => {
    const facturas = parsearFacturasDelPedido([PAGINA_FACTURA, PAGINA_CALIBRADO, 'página sin comprobante']);
    assert.equal(facturas.length, 2);
    const c = costoFacturadoDelPedido('6981382L', facturas, new Set(), 'https://x/f.pdf');
    assert.equal(c.billedNet, 41463);
    assert.equal(Math.round(c.billedTotal * 100) / 100, 50170.23);
    assert.equal(c.invoiceDate.toISOString(), '2024-10-18T03:00:00.000Z');
    assert.deepEqual(c.invoiceRefs.map(r => [r.comprobante, r.importe, r.tipo]), [['0067-01243373', 44986.59, 'factura'], ['0032-00179696', 5183.64, 'factura']]);
    assert.deepEqual(c.descartadas, []);
});
ok('una factura anulada por nota de crédito, o de otro pedido, no suma y se dice', () => {
    const facturas = parsearFacturasDelPedido([PAGINA_FACTURA, PAGINA_CALIBRADO]);
    const anulada = costoFacturadoDelPedido('6981382L', facturas, new Set(['FA 0032-00179696']), null);
    assert.equal(anulada.billedTotal, 44986.59);
    assert.deepEqual(anulada.descartadas, ['FA 0032-00179696 anulada por nota de crédito']);
    const ajena = costoFacturadoDelPedido('7000000L', facturas, new Set(), null);
    assert.equal(ajena.billedTotal, null);
    assert.equal(ajena.descartadas.length, 2);
});
ok('Vitolen compara el TOTAL con IVA, como Optovisión y La Cámara (Factura A, monotributo)', () => {
    assert.ok(LABS_FACTURA_A.has('VITOLEN') && LABS_FACTURA_A.has('OPTOVISION') && LABS_FACTURA_A.has('LA_CAMARA'));
    assert.ok(!LABS_FACTURA_A.has('GRUPO_OPTICO'));
});

console.log('\n— Segunda auditoría (3/10): lo que pidió —');
ok('el robot de la carga espera a cualquier pasada; la completa solo a una rápida', () => {
    assert.equal(debeEsperar('rapida', 'robot'), true);
    assert.equal(debeEsperar('completa', 'robot'), true);
    assert.equal(debeEsperar(null, 'robot'), false);
    assert.equal(debeEsperar('rapida', 'completa'), true);
    assert.equal(debeEsperar('completa', 'rapida'), false);
    assert.equal(debeEsperar('robot', 'rapida'), false);
});
ok('un pedido confirmado a mano en el portal deja de bloquear preparar', () => {
    assert.equal(portalSinResolver({ status: 'RECHAZADO', resumenPortal: { portalDraftId: '1', confirmadoAManoEl: '2026-10-03', confirmadoAManoNumero: '7000001L' } }), false);
});
ok('una factura repetida en el PDF (dos páginas, duplicado) entra una sola vez', () => {
    const sinTotal = PAGINA_FACTURA.replace('TOTAL  $44.986,59', 'continúa');
    const f = parsearFacturasDelPedido([sinTotal, PAGINA_FACTURA, PAGINA_FACTURA]);
    assert.equal(f.length, 1);
    assert.equal(f[0].total, 44986.59);
});
ok('el código del pedido es el vecino de "Código 01", no cualquier número de 9 dígitos', () => {
    const conProducto = PAGINA_FACTURA.replace('(1) 24093IC05000715S ESTADOS UNIDOS', '209168599\n(1) ESTADOS UNIDOS');
    assert.equal(parsearFacturaVitolen(conProducto).codigoPedido, '698138200');
});
ok('un PDF a medias o distinto de la cuenta corriente no toca importes', () => {
    const facturas = parsearFacturasDelPedido([PAGINA_FACTURA, PAGINA_CALIBRADO]);
    const cuenta = new Map([['FA 0067-01243373', 44986.59], ['FA 0032-00179696', 5183.64]]);
    assert.deepEqual(pdfCoincideConCuenta(facturas, cuenta), { confiable: true });
    assert.equal(pdfCoincideConCuenta(facturas, new Map([['FA 0067-01243373', 44986.59]])).confiable, false, 'falta una en la cuenta');
    assert.equal(pdfCoincideConCuenta(facturas, new Map([['FA 0067-01243373', 44986.59], ['FA 0032-00179696', 5000]])).confiable, false, 'difiere el total');
    assert.equal(pdfCoincideConCuenta([], cuenta).confiable, true);
});
ok('una factura anulada queda en los comprobantes sin importe (la pantalla la muestra sin plata)', () => {
    const facturas = parsearFacturasDelPedido([PAGINA_FACTURA, PAGINA_CALIBRADO]);
    const c = costoFacturadoDelPedido('6981382L', facturas, new Set(['FA 0032-00179696']), null);
    assert.deepEqual(c.invoiceRefs.map(r => [r.comprobante, r.importe]), [['0067-01243373', 44986.59], ['0032-00179696', null]]);
});
ok('el payload sabe qué par es; el 2º par sin pedido origen igual queda pendiente a mano', () => {
    const v = ventaBase();
    assert.equal(armarFormulario(v, { forma: 'Forma 1', ejeDiagonal: 0 }).payload.par, 1);
    v.items.push(...v.items.filter(i => i.eye).map(i => ({ ...i, framePosition: 2 })));
    v.frames = [v.frames[0], { position: 2, shape: null, a: '50', b: '38', dbl: '17', edc: '54', details: null, heightOD: 22, heightOI: 22 }];
    assert.equal(armarFormulario(v, { pair: 2, forma: 'Forma 1', ejeDiagonal: 0 }).payload.par, 2);
    // un cristal asignado a un armazón que la venta no tiene: frena (no se ofrece como otro par)
    const w = ventaBase(); w.items.forEach(i => { i.framePosition = 2; });
    assert.ok(armarFormulario(w, { pair: 1, forma: 'Forma 1', ejeDiagonal: 0 }).faltantes.some(f => /asignado al armazón 2/.test(f)));
});
ok('ninguna migración borra el índice único parcial de los borradores', () => {
    const dir = new URL('../../prisma/migrations/', import.meta.url).pathname;
    const sqls = readdirSync(dir).filter(d => existsSync(`${dir}${d}/migration.sql`)).map(d => readFileSync(`${dir}${d}/migration.sql`, 'utf8'));
    assert.ok(sqls.some(s => /CREATE UNIQUE INDEX IF NOT EXISTS "LabOrderDraft_vivo_key"/.test(s)), 'la migración que lo crea existe');
    assert.ok(!sqls.some(s => /DROP INDEX[^;]*LabOrderDraft_vivo_key/i.test(s)), 'un prisma migrate dev propuso borrarlo: no aceptar');
});

console.log('\n— Grupo Óptico (SmartLab): lo puro del módulo —');
// Una fila como la devuelve la API del portal (relevada el 3/10/2026).
const filaGO = (extra = {}) => ({
    IdPedido: '80554323', FechaRegistro: '2026-10-02 18:02:01.000', FechaFin: null, FechaFinEstimada: '2026-10-02 18:02:01.000',
    Anulado: '0', CodigoOptica: 'Laura Santucho 1°par', Observacion: '', sector: 'Calibrado Automático', sector_id: '5',
    progress: 40, is_rework: false, validated: '1', invoices: [], material: 'CR', tipoLente: 'Monofocal', ...extra,
});
const hoyGO = new Date('2026-10-03T12:00:00-03:00');
ok('el estado sale de anulado, sector, progreso y fecha de fin, en ese orden', () => {
    assert.equal(estadoDeFila(filaGO({ progress: 0 })), 'INGRESADO');
    assert.equal(estadoDeFila(filaGO({ progress: '0' })), 'INGRESADO');
    assert.equal(estadoDeFila(filaGO({ progress: 1 })), 'EN_PROCESO');
    assert.equal(estadoDeFila(filaGO({ progress: 99 })), 'EN_PROCESO');
    assert.equal(estadoDeFila(filaGO({ progress: 100 })), 'TERMINADO');
    assert.equal(estadoDeFila(filaGO({ progress: 80, FechaFin: '2026-10-03 10:00:00.000' })), 'TERMINADO', 'con fecha de fin está terminado aunque la barra no llegue');
    assert.equal(estadoDeFila(filaGO({ progress: 100, sector_id: '20', sector: 'Entregado' })), 'DESPACHADO');
    assert.equal(estadoDeFila(filaGO({ progress: 100, sector_id: 20 })), 'DESPACHADO', 'sector_id numérico también');
    assert.equal(estadoDeFila(filaGO({ progress: 100, sector_id: '20', Anulado: '1' })), 'ANULADO', 'anulado manda');
});
ok('la fecha de la API ("2026-10-02 18:02:01.000") es hora argentina, no la del servidor', () => {
    assert.equal(fechaDelPortal('2026-10-02 18:02:01.000').toISOString(), '2026-10-02T21:02:01.000Z');
    assert.equal(fechaDelPortal('2026-10-02').toISOString(), '2026-10-02T03:00:00.000Z');
    assert.equal(fechaDelPortal(null), null);
    assert.equal(fechaDelPortal(''), null);
    assert.equal(fechaDelPortal('02-10-26 18:02'), null, 'el formato de la tabla vieja ya no se lee');
    assert.equal(fechaDelPortal('2026-99-99 00:00:00.000'), null);
    assert.equal(fechaDelPortalEnTexto('2026-10-02 18:02:01.000'), '02/10/2026 18:02');
    assert.equal(fechaDelPortalEnTexto('2026-10-02'), '02/10/2026');
    assert.equal(fechaDelPortalEnTexto(null), '');
    assert.equal(diasDesde(fechaDelPortal('2026-10-01 12:00:00.000'), hoyGO), 2);
    assert.equal(diasDesde(null, hoyGO), 0);
});
ok('qué par es, si el vendedor lo escribió (1°par, 2° par, 1º par, primer par)', () => {
    assert.equal(parDeFila({ CodigoOptica: 'Laura Santucho 1°par' }), 1);
    assert.equal(parDeFila({ CodigoOptica: 'Laura Santucho 2° par' }), 2);
    assert.equal(parDeFila({ CodigoOptica: 'Laura Santucho', Observacion: '2° par SIN CARGO' }), null); // la observación no decide el armazón
    assert.equal(parDeFila({ CodigoOptica: 'Laura Santucho', Observacion: '1º par' }), null);
    // "2do par" / "1er par" son como lo escribe el equipo en el portal (auditoría del 3/10/2026).
    assert.equal(parDeFila({ CodigoOptica: 'Pérez 2do par' }), 2);
    assert.equal(parDeFila({ CodigoOptica: 'Pérez 1er par' }), 1);
    assert.equal(parDeFila({ CodigoOptica: 'Pérez', Observacion: 'urgente' }), null, 'lo que no dice par no se adivina');
    assert.equal(parDeFila({ CodigoOptica: 'Pérez segundo par' }), 2);
    assert.equal(parDeFila({ CodigoOptica: 'Pérez 1 par' }), 1);
    assert.equal(parDeFila({ CodigoOptica: 'Pérez' }), null);
    assert.equal(parDeFila({ CodigoOptica: '21 pares' }), null, 'un 21 no es el par 1');
});
ok('trabado = en validación (sector 2) o < 15 % de avance, SOLO con 2+ días y sin estar anulado ni terminado', () => {
    assert.equal(esTrabado(filaGO({ sector_id: '2', sector: 'Pedido en proceso de validación', progress: 0, FechaRegistro: '2026-10-01 10:00:00.000' }), hoyGO), true);
    assert.equal(esTrabado(filaGO({ sector_id: '2', progress: 50, FechaRegistro: '2026-10-01 10:00:00.000' }), hoyGO), true, 'validación con avance también');
    assert.equal(esTrabado(filaGO({ sector_id: '5', progress: 10, FechaRegistro: '2026-10-01 10:00:00.000' }), hoyGO), true, 'casi sin avance');
    assert.equal(esTrabado(filaGO({ sector_id: '5', progress: 15, FechaRegistro: '2026-09-20 10:00:00.000' }), hoyGO), false, '15 % ya es avance');
    assert.equal(esTrabado(filaGO({ sector_id: '2', progress: 0, FechaRegistro: '2026-10-02 18:02:01.000' }), hoyGO), false, 'un día todavía no es trabado');
    assert.equal(esTrabado(filaGO({ sector_id: '2', progress: 0, FechaRegistro: '2026-10-01 10:00:00.000', Anulado: '1' }), hoyGO), false, 'anulado no');
    assert.equal(esTrabado(filaGO({ sector_id: '17', progress: 10, FechaRegistro: '2026-09-01 10:00:00.000', FechaFin: '2026-09-10 10:00:00.000' }), hoyGO), false, 'terminado no');
});
ok('el pedido del marco: el nombre del código interno como cliente (no vincula), par, fechas en -03:00, comprobantes con link', () => {
    const p = normalizarPedidoGO(filaGO({ invoices: [{ salesId: '123', letter: 'X', number: '00004-00023793', type: 'r' }, { salesId: null, letter: 'B', number: '00004-00353854', type: 'f' }, { number: '' }] }));
    assert.equal(p.portalNumber, '80554323');
    assert.equal(p.internalRef, null);
    assert.equal(p.cliente, 'Laura Santucho 1°par');
    assert.equal(p.pair, 1);
    assert.equal(p.status, 'EN_PROCESO');
    assert.equal(p.statusRaw, 'Calibrado Automático');
    assert.equal(p.enteredAt.toISOString(), '2026-10-02T21:02:01.000Z');
    assert.equal(p.finishedAt, null);
    assert.equal(p.estimatedAt, null, 'FechaFinEstimada no sirve: es la de registro');
    assert.equal(p.dispatchedAt, null);
    assert.deepEqual(p.raw, { progress: 40, sector_id: 5, is_rework: false });
    assert.deepEqual(p.invoices, [
        { comprobante: 'X-00004-00023793', importe: null, url: 'https://grupooptico.dyndns.info/smartlab-api-v2/public/index.php/laboratory/order/invoice?id=123&pedido=80554323&t=2&c=1', tipo: 'remito' },
        { comprobante: 'B-00004-00353854', importe: null, url: null, tipo: 'factura' },
    ]);
    assert.equal(normalizarPedidoGO(filaGO({ invoices: [] })).invoices, undefined, 'sin comprobantes no se escribe la columna');
    assert.equal(normalizarPedidoGO(filaGO({ IdPedido: '' })), null, 'sin nº no es un pedido');
    assert.equal(normalizarPedidoGO(filaGO({ CodigoOptica: '  ' })).internalRef, null);
    // Vincular por nombre escribiría el nº en la venta equivocada (dos ventas de
    // la misma persona, un reproceso): en Grupo Óptico solo vale el código #XXXX.
    assert.equal(normalizarPedidoGO(filaGO({ CodigoOptica: 'Laura Santucho 1°par' })).internalRef, null, 'el nombre del cliente no vincula');
    assert.equal(normalizarPedidoGO(filaGO({ CodigoOptica: '#s3ep Laura Santucho' })).internalRef, '#S3EP', 'el código corto sí');
    assert.equal(normalizarPedidoGO(filaGO({ CodigoOptica: 'Laura Santucho 1°par' })).cliente, 'Laura Santucho 1°par', 'el nombre queda como cliente, para leerlo');
    const fin = normalizarPedidoGO(filaGO({ progress: 100, FechaFin: '2026-10-03 09:30:00.000', is_rework: '1' }));
    assert.equal(fin.status, 'TERMINADO');
    assert.equal(fin.finishedAt.toISOString(), '2026-10-03T12:30:00.000Z');
    assert.equal(fin.raw.is_rework, true);
    assert.deepEqual(comprobantesDeFila(filaGO(), '80554323'), []);
});
ok('se pide la página siguiente mientras venga llena y su pedido más viejo siga en la ventana', () => {
    const desde = new Date('2026-09-01T00:00:00-03:00');
    const llena = (ultimaFecha) => Array.from({ length: 100 }, (_, i) => ({ FechaRegistro: i === 99 ? ultimaFecha : '2026-10-01 10:00:00.000' }));
    assert.equal(seguirPaginando(llena('2026-09-15 10:00:00.000'), desde), true);
    assert.equal(seguirPaginando(llena('2026-08-31 10:00:00.000'), desde), false, 'la última ya es anterior a la ventana');
    assert.equal(seguirPaginando(llena(null), desde), true, 'sin fecha legible no se corta: mejor una página de más');
    assert.equal(seguirPaginando(llena('2026-09-15 10:00:00.000').slice(0, 99), desde), false, 'una página corta es la última');
    assert.equal(seguirPaginando([], desde), false);
});
ok('"no encontrado" = número activo del CRM que no está ni en la lectura ni en el espejo', () => {
    assert.deepEqual(numerosNoEncontrados(['80544194', '80544195', '80544196', '80544194'], ['80544195'], ['80544196']), ['80544194']);
    assert.deepEqual(numerosNoEncontrados([], ['1'], []), []);
    assert.deepEqual(numerosNoEncontrados(['80544194'], new Set(['80544194']), new Set()), []);
});
ok('los números activos de una venta: parseLabNumbers, sin provisorios, con los reprocesos', () => {
    assert.deepEqual(numerosActivosDeVenta({ labOrderNumber: '80544194 - 80544195', postSaleNumbers: ['80544300'] }), ['80544194', '80544195', '80544300']);
    assert.deepEqual(numerosActivosDeVenta({ labOrderNumber: 'SML-1234', postSaleNumbers: [] }), [], 'un borrador no se busca');
    assert.deepEqual(numerosActivosDeVenta({ labOrderNumber: 'sin numero', postSaleNumbers: ['80544300'] }), ['80544300']);
    assert.deepEqual(numerosActivosDeVenta({ labOrderNumber: null, postSaleNumbers: [] }), []);
});
ok('el tracker de la ficha: progreso MÍNIMO, días del más viejo, un sector por pedido, misma forma de siempre', () => {
    const a = detalleDeFila(filaGO({ IdPedido: '80544194', sector: 'Tallado', progress: 100, FechaRegistro: '2026-10-01 09:30:00.000' }), hoyGO);
    const b = detalleDeFila(filaGO({ IdPedido: '80544195', sector: 'Montaje', progress: 40, FechaRegistro: '2026-09-28 09:30:00.000' }), hoyGO);
    assert.deepEqual(a, { num: '80544194', sector: 'Tallado', progress: 100, entryDate: '01/10/2026 09:30', days: 2, anulado: false });
    const t = resumenTracker([a, b], [], hoyGO);
    assert.equal(t.smartLabProgress, 40);
    assert.equal(t.smartLabDays, 5);
    assert.equal(t.smartLabSector, '4194: Tallado | 4195: Montaje');
    assert.equal(t.smartLabEntryDate, '01/10/2026 09:30');
    assert.equal(t.smartLabLastSync, hoyGO);
    assert.deepEqual(JSON.parse(t.smartLabDetails), [
        { num: '80544194', sector: 'Tallado', progress: 100, entryDate: '01/10/2026 09:30', days: 2 },
        { num: '80544195', sector: 'Montaje', progress: 40, entryDate: '28/09/2026 09:30', days: 5 },
    ]);
    assert.equal(resumenTracker([a], [], hoyGO).smartLabSector, 'Tallado', 'un solo pedido: el sector a secas');
    assert.equal(detalleDeFila(filaGO({ IdPedido: null }), hoyGO), null);
});
ok('un pedido anulado no frena el progreso de los demás, y se ve como anulado', () => {
    const vivo = detalleDeFila(filaGO({ IdPedido: '80544194', sector: 'Montaje', progress: 100 }), hoyGO);
    const anulado = detalleDeFila(filaGO({ IdPedido: '80544195', sector: 'Pendiente', progress: 0, Anulado: '1' }), hoyGO);
    const t = resumenTracker([vivo, anulado], [], hoyGO);
    assert.equal(t.smartLabProgress, 100);
    assert.equal(t.smartLabSector, '4194: Montaje | 4195: ANULADO (Pendiente)');
});
ok('un nº que el portal no tiene queda a la vista en la ficha (antes la venta quedaba muda)', () => {
    const solo = resumenTracker([], ['80549999'], hoyGO);
    assert.equal(solo.smartLabSector, TEXTO_NO_ENCONTRADO);
    assert.equal(solo.smartLabProgress, 0);
    assert.equal(JSON.parse(solo.smartLabDetails).length, 0);
    const vivo = detalleDeFila(filaGO({ IdPedido: '80544194', sector: 'Montaje', progress: 70 }), hoyGO);
    assert.equal(resumenTracker([vivo], ['80549999'], hoyGO).smartLabSector, `4194: Montaje | 9999: ${TEXTO_NO_ENCONTRADO}`);
});
ok('el módulo está registrado, hace seguimiento y deja los costos al provider', () => {
    assert.equal(MODULO_GRUPO_OPTICO.clave, 'GRUPO_OPTICO');
    assert.equal(MODULO_GRUPO_OPTICO.nombre, 'Grupo Óptico');
    assert.deepEqual(MODULO_GRUPO_OPTICO.capacidades, { seguimiento: true, costos: false, carga: true });
    assert.equal(MODULO_GRUPO_OPTICO.carga?.lab, 'GRUPO_OPTICO', 'la carga asistida se declara en el módulo');
    assert.equal(MODULO_GRUPO_OPTICO.cadenciaRapidaMin, undefined, 'cada tick de 10 min, como siempre');
    assert.notEqual(MODULO_GRUPO_OPTICO.avisoDeRetiroAutomatico, false, 'el retiro automático a las 24 h es el circuito de Grupo Óptico');
    assert.ok(MODULO_GRUPO_OPTICO.patronProducto.test('Grupo Óptico') && MODULO_GRUPO_OPTICO.patronProducto.test('grupo optico') && !MODULO_GRUPO_OPTICO.patronProducto.test('Vitolen'));
    assert.ok(REGISTRO_MODULOS.some(m => m.clave === 'GRUPO_OPTICO'));
    assert.ok(REGISTRO_MODULOS.every(m => m && m.clave), 'ningún módulo quedó sin inicializar por un import circular');
});
ok('sin clave de respaldo en el código: sin variables, el login se corta antes de abrir el navegador', () => {
    const src = readFileSync(new URL('../../src/services/lab-modules/grupo-optico/portal.ts', import.meta.url), 'utf8');
    assert.ok(!/SMARTLAB_(USER|PASSWORD)\s*\|\|\s*['"][^'"]+['"]/.test(src), 'un `|| "…"` con algo adentro al lado de la variable es una clave en el código');
    const provider = readFileSync(new URL('../../src/services/lab-providers/grupo-optico.provider.ts', import.meta.url), 'utf8');
    assert.ok(!/process\.env\.SMARTLAB_(USER|PASSWORD)/.test(provider), 'el provider no lee la credencial: usa el login del módulo');
    const diag = readFileSync(new URL('./smartlab-diagnostico.check.mjs', import.meta.url), 'utf8');
    assert.ok(!/fill\(['"]/.test(diag), 'el diagnóstico tampoco tiene la clave escrita');
    assert.ok(!existsSync(new URL('../../src/services/smartlab.service.ts', import.meta.url)), 'smartlab.service.ts se borró: el seguimiento es el módulo');
});
ok('el tick de /api/cron/lab-modulos saltea a Grupo Óptico: su tick es /api/cron/smartlab-sync', () => {
    const ruta = readFileSync(new URL('../../src/app/api/cron/lab-modulos/route.ts', import.meta.url), 'utf8');
    assert.ok(/LAB_GRUPO_OPTICO\)\s*continue/.test(ruta));
    const sync = readFileSync(new URL('../../src/app/api/cron/smartlab-sync/route.ts', import.meta.url), 'utf8');
    assert.ok(/correrSeguimiento\(MODULO_GRUPO_OPTICO/.test(sync));
    assert.ok(!/['"]smartlab_(down_since|alerted_at)['"]|process\.env\.ADMIN_EMAIL\b|pisano\.ishtar@gmail\.com/.test(sync), 'ni claves viejas de salud ni direcciones escritas a mano');
    for (const pagina of ['ventas', 'pedidos']) {
        const src = readFileSync(new URL(`../../src/app/admin/${pagina}/page.tsx`, import.meta.url), 'utf8');
        assert.ok(!/const autoSync = /.test(src), `/admin/${pagina} ya no dispara el sync al abrirse`);
    }
});

console.log(fallas === 0 ? '\n✅ Marco de módulos de laboratorio: todo en orden.\n' : `\n❌ ${fallas} falla(s).\n`);
process.exit(fallas === 0 ? 0 : 1);

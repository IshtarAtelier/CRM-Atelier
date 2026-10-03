// ────────────────────────────────────────────────────────────────────────────
// CARGA DE GRUPO ÓPTICO: la equivalencia producto → artículo de SmartLab y el
// pedido que el robot arma (src/services/lab-modules/grupo-optico/{catalogo,carga,robot}.ts).
//
// Lo que NO puede volver a pasar (auditoría del 3/10/2026, 321 pedidos):
//  · cargar "Smart Free Blue Light" común cuando se vendió el C/AR ESSENTIAL (o al revés);
//  · elegir "la primera opción" cuando el portal ofrece varias o ninguna;
//  · el 2º par de sol de un 2x1 en un material que el laboratorio no tiñe;
//  · un 1.67 blanco cargado como blue (el portal lista el blue en los dos);
//  · el 2º par de un 2x1 sin el nº del 1º y sin decir que va sin cargo.
//
// Sin base ni red. Corre en CI.   npm run check:carga-go
// ────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { especificacionDe, elegirArticulo, colorDelItem } from '../../src/services/lab-modules/grupo-optico/catalogo.ts';
import { planDeCarga, payloadCreateUpdate, observacionDelPedido, esVenta2x1 } from '../../src/services/lab-modules/grupo-optico/carga.ts';
import { pedidoYaCreado, diferenciasConLoAprobado, puedeCrearPedidosReales } from '../../src/services/lab-modules/grupo-optico/robot.ts';
import { parDeFila } from '../../src/services/lab-modules/grupo-optico/pedidos.ts';
import { decidirExistente } from '../../src/services/lab-modules/grupo-optico/existentes.ts';
import { huellaDelPlan, cambiosEntrePayloads } from '../../src/services/lab-modules/grupo-optico/borrador-portal.ts';

let fallas = 0;
const ok = (nombre, fn) => { try { fn(); console.log(`  ✅ ${nombre}`); } catch (e) { fallas++; console.log(`  ❌ ${nombre}\n     ${e.message.split('\n').join('\n     ')}`); } };

// La lista real del portal para Multifocal · ORG BLUE LIGHT 1.56 · Blanco · Smart Lens Digital (3/10/2026).
const MULTI_BLUE_156 = [
    ['10325', 'MULTIFOCAL SMART FREE ORGANICO BLUE LIGHT 1.56'], ['11262', 'MULTIFOCAL SMART NEW ORGANICO BLUE LIGHT 1.56'],
    ['11286', 'MULTIFOCAL SMART PRO ORGANICO BLUE LIGHT 1.56'], ['11884', 'MULTI DIGITAL SMART ONE ORG BLUE LIGHT 1.56'],
    ['28463', 'MULTIFOCAL SMART FREE ORGANICO BLUE LIGHT C/AR ESSENTIAL'], ['28478', 'MULTI DIGITAL SMART ONE ORG BLUE LIGHT C/AR ESSENTIAL'],
    ['28489', 'MULTIFOCAL SMART NEW ORGANICO BLUE C/ AR ESSENTIAL'], ['28506', 'MULTIFOCAL SMART PRO ORGANICO BLUE LIGHT C/AR ESSENTIAL'],
    ['28538', 'MULTIFOCAL SMART EXCLUSIVE ORGANICO BLUE LIGHT 1.56'], ['28544', 'MULTIFOCAL SMART EXCLUSIVE ORGANICO BLUE 1.56 C/AR ESSENTIAL'],
    ['28788', 'MULTI DIGITAL SMART DRIVE ORG BLUE LIGHT'], ['28629', 'MULTI DIGITAL SMART DRIVE ORG BLUE LIGHT C/AR ESSENTIAL'],
    ['30979', 'MULTIFOCAL SMART AILENS ORGANICO BLUE LIGHT'], ['30980', 'MULTIFOCAL SMART AILENS ORGANICO BLUE 1.56 C/AR ESSENTIAL'],
].map(([value, label]) => ({ value, label }));
const elegido = (nombre, lista, opts) => { const r = especificacionDe(nombre, opts); assert.ok(r.ok, r.motivo); const a = elegirArticulo(lista, r.especificacion); assert.ok(a.ok, a.motivo); return a.articulo.value; };

console.log('\nEquivalencias producto → artículo');
ok('Essential va al C/AR ESSENTIAL y el común al común, en cada familia', () => {
    assert.equal(elegido('Multifocal Smart FREE · Orgánico Blue Light 1.56 · Essential 2x1', MULTI_BLUE_156), '28463');
    assert.equal(elegido('Multifocal Smart FREE · Orgánico Blue Light 1.56 2x1', MULTI_BLUE_156), '10325');
    assert.equal(elegido('Multifocal Smart ONE · Orgánico Blue Light 1.56 · Essential', MULTI_BLUE_156), '28478');
    assert.equal(elegido('Multifocal Smart NEW · Orgánico Blue Light 1.56 · Essential', MULTI_BLUE_156), '28489');
    assert.equal(elegido('Multifocal Smart PRO · Orgánico Blue Light 1.56', MULTI_BLUE_156), '11286');
    assert.equal(elegido('Multifocal Smart AI LENS · Orgánico Blue Light 1.56 · Essential', MULTI_BLUE_156), '30980');
});
ok('nunca "el primero": dos candidatos o ninguno = no carga y lo dice', () => {
    const esp = especificacionDe('Multifocal Smart FREE · Orgánico Blue Light 1.56 · Essential 2x1').especificacion;
    const doble = [...MULTI_BLUE_156, { value: '99999', label: 'MULTIFOCAL SMART FREE ORGANICO BLUE LIGHT C/AR ESSENTIAL NUEVO' }];
    assert.equal(elegirArticulo(doble, esp).ok, false);
    assert.match(elegirArticulo(doble, esp).motivo, /2 artículos/);
    assert.equal(elegirArticulo([], esp).ok, false);
});
ok('el 2º par de SOL pasa a Orgánico Blanco 1.49 de la misma familia, sin Essential (el portal solo tiñe ese)', () => {
    const r = especificacionDe('Multifocal Smart FREE · Orgánico Blue Light 1.56 · Essential 2x1', { conTenido: true });
    assert.equal(r.especificacion.material.materialId, 3);
    assert.equal(r.especificacion.essential, false);
    assert.equal(r.especificacion.pasoATenible, true);
    const lista = [{ value: '10323', label: 'MULTIFOCAL SMART FREE ORGANICO BLANCO' }, { value: '28461', label: 'MULTIFOCAL SMART FREE ORGANICO BLANCO C/AR ESSENTIAL' }, { value: '10751', label: 'MULTI DIGITAL SMART ONE ORG BLANCO' }];
    assert.equal(elegirArticulo(lista, r.especificacion).articulo.value, '10323');
});
ok('un cristal de stock no se tiñe: corta con el motivo', () => {
    const r = especificacionDe('Stock · Orgánico Blue c/AR 1.56', { conTenido: true });
    assert.equal(r.ok, false);
    assert.match(r.motivo, /no tiñe/);
});
ok('1.67 blanco y 1.67 blue no se cruzan (el portal lista el blue en los dos materiales)', () => {
    const lista = [{ value: '30953', label: 'MONOF MYOFIX ORG BLUE DIGITAL 1.67' }, { value: '30951', label: 'MONOF MYOFIX ORG BCO DIGITAL 1.67' }];
    assert.equal(elegido('Control miopía MyoFix · Orgánico Alto Índice 1.67', lista), '30951');
    assert.equal(elegido('Control miopía MyoFix · Orgánico Blue Light 1.67', [lista[0]]), '30953');
});
ok('Anti Age viene siempre con AR: Essential no lo distingue', () => {
    const lista = [{ value: '31692', label: 'MONOF MYOFIX ORG BLUE ANTI AGE 1.60 C/AR' }, { value: '31691', label: 'MONOF MYOLENS ORG BLUE ANTI AGE 1.60 C/AR' }];
    assert.equal(elegido('Control miopía MyoFix · Orgánico Anti Age Blue Light 1.60 · Essential', lista), '31692');
});
ok('stock: el cristal puntual de la línea; rango extendido solo si se vendió así', () => {
    const lista = [{ value: '9339', label: 'ORG BLUE C/AR 1.56 STOCK ESF-225 CIL+050' }];
    assert.equal(elegido('Stock · Orgánico Blue c/AR 1.56', lista), '9339');
    const ext = [{ value: '14753', label: 'ORG SUPER BLUE ASF C/AR 1.60 R. EXT ESF-650 CIL+250' }];
    assert.equal(elegido('Stock · Orgánico Super Blue Asf. c/AR 1.60 · Rango Extendido', ext), '14753');
    const r = elegirArticulo(ext, especificacionDe('Stock · Orgánico Super Blue Asf. c/AR 1.60').especificacion);
    assert.equal(r.ok, false);
    assert.match(r.motivo, /rango extendido/);
});
ok('colores de varios: el del ítem; sin color, no carga', () => {
    assert.equal(colorDelItem('Brown'), 3);
    assert.equal(colorDelItem('Verde G15'), 9);
    assert.equal(especificacionDe('Multifocal Smart FREE · Orgánico Polarizado Gris / Brown 1.49 2x1').ok, false);
    assert.equal(especificacionDe('Multifocal Smart FREE · Orgánico Polarizado Gris / Brown 1.49 2x1', { colorItem: 'Brown' }).especificacion.colorId, 3);
});
ok('un producto sin equivalencia declarada no se carga (y dice qué falta)', () => {
    const r = especificacionDe('Sol neutro · Orgánico Espejado — Red / Blue');
    assert.equal(r.ok, false);
    assert.match(r.motivo, /catalogo\.ts/);
});

console.log('\nEl pedido armado desde la venta');
const cristal = (fp, eye, extra = {}) => ({ eye, framePosition: fp, quantity: 1, sphereVal: 0.75, cylinderVal: -1, axisVal: eye === 'OD' ? 140 : 40, additionVal: 1.5, product: { name: 'Multifocal Smart FREE · Orgánico Blue Light 1.56 · Essential 2x1', category: 'Cristal', type: 'Cristal Multifocal' }, ...extra });
const venta2x1 = (conTenido = true, fpTenido = 2) => ({
    id: 'cmu6zfb0e00g6oe07n4rbl4au', labType: 'LABORATORY', appliedPromoName: 'Promo 2x1',
    labPdOd: 33, labPdOi: 33, client: { name: 'Laura Santucho' },
    frames: [{ position: 1, a: '54', b: '42', dbl: '18', edc: '55', heightOD: 25, heightOI: 25 }, { position: 2, a: '53', b: '45', dbl: '19', edc: '54', heightOD: 28, heightOI: 28 }],
    items: [cristal(1, 'OD'), cristal(1, 'OI'), cristal(2, 'OD'), cristal(2, 'OI'),
        { framePosition: 1, product: { name: 'Armazón Atelier Premium', category: 'Armazón de Receta', brand: 'Atelier' } },
        { framePosition: 2, product: { name: 'Armazón Atelier Premium Negro', category: 'Armazón de Receta', brand: 'Atelier' } },
        ...(conTenido ? [{ framePosition: fpTenido, crystalColor: 'Gris', crystalColorType: 'COMPACTO', crystalColorNote: '3', product: { name: 'Teñido Compacto', category: 'Tratamiento', type: 'Tratamiento' } }] : [])],
});
ok('2x1: el 1er par es el producto vendido, con su graduación y medidas', () => {
    const r = planDeCarga(venta2x1(), 1, { tipoArmazon: 'PLASTICO' });
    assert.ok(r.ok, r.faltantes?.join(' | '));
    assert.equal(r.plan.especificacion.material.materialId, 20);
    assert.equal(r.plan.od.esferico, '+0.75'); assert.equal(r.plan.od.cilindrico, '-1.00'); assert.equal(r.plan.od.eje, '140');
    assert.equal(r.plan.od.esfericoCerca, '+2.25'); assert.equal(r.plan.od.adicion, 1.5);
    assert.equal(r.plan.armazon.a, '54'); assert.equal(r.plan.armazon.ed, '55');
    assert.equal(r.plan.codigoOptica, '#L4AU Laura Santucho 1°par');
    assert.equal(r.plan.tenido, null);
});
ok('2x1: el 2º par de sol se carga en Blanco 1.49 con el teñido, y dice SIN CARGO + nº del 1º', () => {
    const r = planDeCarga(venta2x1(), 2, { tipoArmazon: 'PLASTICO', pedidoOrigen: '80549878' });
    assert.ok(r.ok, r.faltantes?.join(' | '));
    assert.equal(r.plan.especificacion.material.materialId, 3);
    assert.deepEqual(r.plan.tenido, { tipo: 'COMPACTO', color: 'Gris', colorId: 1, intensidad: '3' });
    assert.match(r.plan.observacion, /2° par SIN CARGO - 1° par n° 80549878/);
    assert.equal(r.plan.armazon.b, '45');
});
ok('2x1: el 2º par no se prepara sin el nº del 1º', () => {
    const r = planDeCarga(venta2x1(), 2, { tipoArmazon: 'PLASTICO' });
    assert.equal(r.ok, false);
    assert.ok(r.faltantes.some(f => /1º ya cargado/.test(f)));
});
ok('2x1: un teñido sin armazón asignado no se adivina', () => {
    const r = planDeCarga(venta2x1(true, null), 1, { tipoArmazon: 'PLASTICO' });
    assert.equal(r.ok, false);
    assert.ok(r.faltantes.some(f => /teñido sin armazón/.test(f)));
});
ok('sin tipo de armazón, lo pide al preparar', () => {
    const r = planDeCarga(venta2x1(), 1, {});
    assert.equal(r.ok, false);
    assert.ok(r.faltantes.some(f => /tipo de armazón/.test(f)));
});
ok('la venta dice Stock y el cristal es de laboratorio: no carga', () => {
    const r = planDeCarga({ ...venta2x1(), labType: 'STOCK' }, 1, { tipoArmazon: 'PLASTICO' });
    assert.equal(r.ok, false);
    assert.ok(r.faltantes.some(f => /dice Stock/.test(f)));
});
ok('es 2x1 solo con dos pares y la promo', () => {
    assert.equal(esVenta2x1(venta2x1()), true);
    assert.equal(esVenta2x1({ ...venta2x1(), appliedPromoName: '', items: venta2x1().items.map(i => ({ ...i, product: { ...i.product, name: String(i.product.name).replace(' 2x1', '') } })) }), false);
});
ok('observación del 1er par y de un pedido suelto', () => {
    assert.equal(observacionDelPedido({ es2x1: true, par: 1, producto: 'Multifocal Smart FREE · X' }), 'Promo 2x1 Smart Free - 1° par');
    assert.equal(observacionDelPedido({ es2x1: false, par: 1, producto: 'Stock · X', notas: 'urgente' }), 'urgente');
});
ok('el payload tiene el formato del portal (pedido real 80549878 capturado el 3/10/2026)', () => {
    const r = planDeCarga(venta2x1(), 1, { tipoArmazon: 'PLASTICO', forma: 1 });
    const p = payloadCreateUpdate(r.plan, { materialId: 20, colorId: 1, brandId: 145, articuloOD: 28463, articuloOI: 28463, typeRimArticleId: 8896, tinted: null, clientId: '2462' });
    const real = { lensTypeId: '5', rightEyeNearSpherical: '+2.25', rightEyeFarSpherical: '+0.75', rightEyeFarCylindrical: '-1.00', rightEyeFarAxis: '140', rightEyeArticle: 28463, rightEyeStockArticle: '0', rightEyeAddition: 1.5, leftEyeFarAxis: '40', materialId: 20, colorId: 1, calibrated: '1', frameType: 'ZILO', typeRimId: '1', typeRimArticleId: 8896, frameBrought: true, bridge: '18', bridgeA: '54', bridgeB: '42', bridgeED: '55', frameShape: 1, brandId: 145, clientId: '2462', userId: '2462', isClient: true, action: 'insert', orderId: null, isEdit: false };
    for (const [k, v] of Object.entries(real)) assert.deepEqual(p[k], v, k);
    assert.equal(p.rightEyeInterpupillaryDistance, '33');
    assert.equal(p.rightEyePupillaryHeight, '25');
});

console.log('\nDespués del OK');
ok('reintento o carga a mano: adopta el pedido de ESE par por el código de la venta, nunca el del otro par ni uno anulado', () => {
    const filas = [
        { IdPedido: '80560003', CodigoOptica: '#L4AU Laura Santucho 2°par', Anulado: '0' },
        { IdPedido: '80560001', CodigoOptica: '#L4AU Laura Santucho 1°par', Anulado: '0' },
        { IdPedido: '80560002', CodigoOptica: '#L4AU Laura Santucho 2°par', Anulado: '1' },
        { IdPedido: '80560009', CodigoOptica: '#XL4AU otro', Anulado: '0' },
    ];
    assert.deepEqual(pedidoYaCreado(filas, '#L4AU', 1), { numero: '80560001', ambiguo: false });
    assert.deepEqual(pedidoYaCreado(filas, '#L4AU', 2), { numero: '80560003', ambiguo: false });
    assert.equal(pedidoYaCreado(filas, '#L4AU', 2, new Set(['80560003'])), null, 'un nº que ya es de otro par no se adopta');
    // venta de un solo par cargada a mano con el favorito
    assert.deepEqual(pedidoYaCreado([{ IdPedido: '80561111', CodigoOptica: '#S3EP Ana', Anulado: '0' }], '#S3EP', null), { numero: '80561111', ambiguo: false });
});
ok('N1: en una venta de dos pares, un pedido con el código y sin par marcado es AMBIGUO (ni se adopta ni se crea)', () => {
    const filas = [{ IdPedido: '80562222', CodigoOptica: '#S3EP Ana', Observacion: 'anteojo de sol', Anulado: '0' }];
    assert.deepEqual(pedidoYaCreado(filas, '#S3EP', 1), { numero: '80562222', ambiguo: true });
    // si la observación dice el par, ya no es ambiguo
    assert.equal(pedidoYaCreado([{ ...filas[0], Observacion: 'Promo 2x1 - 2do par' }], '#S3EP', 1), null);
});
ok('N2/C5: un par con pedido (robot, seguimiento o nº tipeado) no se vuelve a cargar; un anulado no cuenta; un nº sin par es ambiguo', () => {
    const base = { pair: 1, pares: 2, cargadosPorPar: [], espejo: [], numerosEnVenta: [] };
    assert.equal(decidirExistente(base), null);
    assert.deepEqual(decidirExistente({ ...base, cargadosPorPar: [{ pair: 1, numero: '80570001' }] }), { numero: '80570001', ambiguo: false });
    assert.equal(decidirExistente({ ...base, pair: 2, cargadosPorPar: [{ pair: 1, numero: '80570001' }], numerosEnVenta: ['80570001'] }), null, 'el nº del par 1 no bloquea el par 2');
    assert.deepEqual(decidirExistente({ ...base, numerosEnVenta: ['80570009'] }), { numero: '80570009', ambiguo: true }, 'tipeado a mano sin saber de qué par');
    assert.equal(decidirExistente({ ...base, espejo: [{ numero: '80570009', pair: 1, anulado: true }], numerosEnVenta: ['80570009'] }), null, 'anulado no bloquea');
    assert.deepEqual(decidirExistente({ ...base, pair: 2, espejo: [{ numero: '80570005', pair: 2, anulado: false }] }), { numero: '80570005', ambiguo: false });
    assert.deepEqual(decidirExistente({ ...base, pares: 1, numerosEnVenta: ['80570007'] }), { numero: '80570007', ambiguo: false });
    assert.equal(decidirExistente({ ...base, cargadosPorPar: [{ pair: 1, numero: '80570001' }], excluir: '80570001' }), null, 'el propio nº no cuenta');
});
ok('el par de una fila del portal: la observación del 2º par nombra al 1º y tiene que ganar el 2', () => {
    assert.equal(parDeFila({ CodigoOptica: 'Nestor Bocco', Observacion: 'Promo 2x1 Smart Free - 2° par SIN CARGO - 1° par n° 80547989' }), 2);
    assert.equal(parDeFila({ CodigoOptica: 'Ana Zorrilla', Observacion: 'Promo smart free 2x1 vincular al 1°par pedido 80548395' }), 1);
    assert.equal(parDeFila({ CodigoOptica: 'Ana Zorrilla 2°par', Observacion: 'vincular al 1°par pedido 80548395' }), 2, 'el código interno manda');
    assert.equal(parDeFila({ CodigoOptica: 'Graciela 2do', Observacion: 'Promo 2x1 Smart Free - 2do par - 1er par n°80515332' }), 2);
    assert.equal(parDeFila({ CodigoOptica: 'x', Observacion: 'Promo 2x1 Smart Free - 1° par' }), 1);
});
ok('lo guardado se compara con lo aprobado', () => {
    const aprobado = { rightEyeArticle: 28463, leftEyeArticle: 28463, materialId: 20, lensTypeId: '5', rightEyeFarSpherical: '+0.75', leftEyeFarSpherical: '+0.75', tintedId: null };
    assert.deepEqual(diferenciasConLoAprobado({ right_eye_article_id: 28463, left_eye_article_id: 28463, IdMaterial: '20', IdTipoLente: '5', OjoDerEsfericoLejos: '.750', OjoIzqEsfericoLejos: '.750', tinted_id: null }, aprobado), []);
    assert.equal(diferenciasConLoAprobado({ right_eye_article_id: 10325, left_eye_article_id: 28463, IdMaterial: '20', IdTipoLente: '5', OjoDerEsfericoLejos: '.750', OjoIzqEsfericoLejos: '.750', tinted_id: null }, aprobado).length, 1);
});

ok('solo producción con la base afuera crea pedidos reales (un npm start local, no)', () => {
    assert.equal(puedeCrearPedidosReales({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://u:p@db.railway.internal:5432/x' }), false);
    assert.equal(puedeCrearPedidosReales({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://postgres:x@localhost:5432/atelier' }), false);
    assert.equal(puedeCrearPedidosReales({ NODE_ENV: 'production' }), false, 'sin base legible, no');
    assert.equal(puedeCrearPedidosReales({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@postgres.railway.internal:5432/railway' }), true);
    assert.equal(puedeCrearPedidosReales({ NODE_ENV: 'development', SMARTLAB_PERMITIR_CARGA: '1' }), true);
});

console.log('\nLo que encontró la auditoría adversarial del 3/10/2026');
ok('C1: cambiar el producto de la venta cambia la huella (no se carga el de antes)', () => {
    const a = planDeCarga(venta2x1(), 1, { tipoArmazon: 'PLASTICO' });
    const otra = venta2x1(); otra.items = otra.items.map(i => i.product?.category === 'Cristal' ? { ...i, product: { ...i.product, name: 'Multifocal Smart PRO · Orgánico Blue Light 1.56 · Essential 2x1' } } : i);
    const b = planDeCarga(otra, 1, { tipoArmazon: 'PLASTICO' });
    assert.notEqual(huellaDelPlan(a.plan), huellaDelPlan(b.plan));
    const res = { materialId: 20, colorId: 1, brandId: 145, articuloOD: 28463, articuloOI: 28463, typeRimArticleId: 8896, tinted: null, clientId: '2462' };
    // con los ids viejos el ARTÍCULO y el material no cambian: por eso hace falta la huella
    const cambios = cambiosEntrePayloads(payloadCreateUpdate(a.plan, res), payloadCreateUpdate(b.plan, res));
    assert.ok(!cambios.some(c => /Article|materialId|brandId/.test(c)), cambios.join(','));
});
ok('C3: con dos pares, el código interno lleva el par aunque no sea 2x1', () => {
    const v = venta2x1(false); v.appliedPromoName = ''; v.items = v.items.map(i => i.product?.category === 'Cristal' ? { ...i, product: { ...i.product, name: 'Multifocal Smart FREE · Orgánico Blue Light 1.56 · Essential' } } : i);
    assert.equal(esVenta2x1(v), false);
    const r = planDeCarga(v, 2, { tipoArmazon: 'PLASTICO' });
    assert.ok(r.ok, r.faltantes?.join(' | '));
    assert.match(r.plan.codigoOptica, /2°par$/);
    assert.doesNotMatch(r.plan.observacion, /SIN CARGO/);
});
ok('I7: un teñido asignado a un armazón que no existe frena', () => {
    const v = venta2x1(true, 3);
    assert.equal(planDeCarga(v, 1, { tipoArmazon: 'PLASTICO' }).ok, false);
});
ok('I8: la 2x1 del lab también se reconoce por la promo aplicada aunque el cristal no diga "2x1"', () => {
    const v = venta2x1(); v.items = v.items.map(i => i.product?.category === 'Cristal' ? { ...i, product: { ...i.product, name: 'Multifocal Smart FREE · Orgánico Blue Light 1.56 · Essential' } } : i);
    assert.equal(esVenta2x1(v), true);
    assert.equal(esVenta2x1({ ...v, appliedPromoName: '' }), false);
});
ok('I8: una promo 2x1 que no es de dos cristales Grupo Óptico de la misma familia no es la 2x1 del laboratorio', () => {
    const v = venta2x1(); v.items = v.items.map(i => i.product?.category === 'Cristal' && i.framePosition === 2 ? { ...i, product: { ...i.product, name: 'Multifocal Smart ONE · Orgánico Blue Light 1.56 · Essential 2x1' } } : i);
    assert.equal(esVenta2x1(v), false);
});
ok('I10: el 2º par multifocal sin altura de SU armazón frena (no toma la de la ficha)', () => {
    const v = venta2x1(); v.frames = [v.frames[0], { ...v.frames[1], heightOD: null, heightOI: null }];
    const r = planDeCarga(v, 2, { tipoArmazon: 'PLASTICO', pedidoOrigen: '80549878' });
    assert.equal(r.ok, false);
    assert.ok(r.faltantes.some(f => /armazón 2/.test(f)));
});

console.log(fallas ? `\n❌ ${fallas} falla(s).` : '\n✅ Carga de Grupo Óptico: todo en orden.');
process.exit(fallas ? 1 : 0);

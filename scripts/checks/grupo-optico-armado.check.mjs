// ────────────────────────────────────────────────────────────────────────────
// EL ARMADO DEL PEDIDO PARA SMARTLAB (Grupo Óptico): src/lib/grupo-optico/armar-pedido.ts
//
// Lo que NO puede volver a pasar (cada punto ya pasó, 3/10/2026):
//  · dos copias del armado (Ventas y Pedidos) que difieren en 161 líneas;
//  · el nombre del cliente como código interno: el cruce con el portal era
//    difuso por nombre, cuando el código corto (#AB12) vincula con certeza;
//  · el par 2 de un 2x1 mandado con el cristal y las medidas del par 1;
//  · sin tipo de pedido, el favorito marcaba "Stock" en silencio;
//  · una receta a medias (cilindro sin eje, multifocal sin adición) que
//    llegaba al portal y se cargaba igual;
//  · el tono de un fotocromático mandado a fábrica como un teñido a hacer.
//
// Sin base ni red. Corre en CI.
// Correr:  npm run check:armado-go
// ────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { armarPedidoSmartLab, urlSmartLabConPedido, textoPasosSmartLab, textoFaltantesSmartLab, tipoDeLenteSmartLab } from '../../src/lib/grupo-optico/armar-pedido.ts';

let fallas = 0;
const ok = (desc, fn) => {
    try { fn(); console.log(`  ✅ ${desc}`); }
    catch (e) { fallas++; console.log(`  ❌ ${desc}\n     ${e.message}`); }
};

const cristal = (eye, extra = {}) => ({
    eye, quantity: 1, framePosition: 1,
    product: { name: 'Monofocal Orgánico Blue Light c/AR 1.56', category: 'Cristal', type: 'Cristal Monofocal', lensIndex: '1.56' },
    sphereVal: eye === 'OD' ? -1.25 : -0.75, cylinderVal: eye === 'OD' ? -0.5 : null, axisVal: eye === 'OD' ? 180 : null,
    additionVal: null, pdVal: null, heightVal: null, crystalColor: null, crystalColorType: null, crystalColorNote: null,
    ...extra,
});
const armazon = (extra = {}) => ({
    eye: null, quantity: 1, framePosition: 1,
    product: { name: 'Vulk Roma Acetato', category: 'Armazón de Receta', type: 'Armazón', brand: 'Vulk' },
    ...extra,
});
const ventaBase = () => ({
    id: 'cm00000000000000000ab12',
    client: { name: 'Ana María Pérez' },
    labType: 'STOCK',
    labPdOd: 32, labPdOi: 31,
    labNotes: 'sin apuro',
    labMaterial: '', labTreatment: '', labColor: '', labDiameter: '65',
    frames: [{ position: 1, shape: 'Redonda', a: '52', b: '40', dbl: '18', edc: '56', details: 'color rojo', imageUrl: null, heightOD: 24, heightOI: 24 }],
    prescription: { sphereOD: -1.25, cylinderOD: -0.5, axisOD: 180, sphereOI: -0.75, cylinderOI: null, axisOI: null, addition: null, additionOD: null, additionOI: null, distanceOD: 32, distanceOI: 31, heightOD: null, heightOI: null, notes: 'receta del Dr. López' },
    items: [cristal('OD'), cristal('OI'), armazon()],
});

console.log('\n— Venta monofocal completa —');
ok('arma el pedido con el código corto de la venta, no con el nombre', () => {
    const r = armarPedidoSmartLab(ventaBase(), 1);
    assert.deepEqual(r.faltantes, []);
    assert.equal(r.ok, true);
    const p = r.payload;
    assert.equal(p.codigoInterno, '#AB12');
    assert.equal(p.paciente_fullname, 'Ana María Pérez');
    assert.equal(p.paciente_nombre, 'Ana María');
    assert.equal(p.paciente_apellido, 'Pérez');
    assert.equal(p.labType, 'STOCK');
    assert.equal(p.tipo_lente, 'Monofocal');
});
ok('la receta sale con el formato del portal: signo, dos decimales, eje entero', () => {
    const p = armarPedidoSmartLab(ventaBase(), 1).payload;
    assert.deepEqual([p.od_esfera, p.od_cilindro, p.od_eje, p.od_adicion], ['-1.25', '-0.50', '180', '']);
    assert.deepEqual([p.oi_esfera, p.oi_cilindro, p.oi_eje], ['-0.75', '', '']);
    assert.deepEqual([p.od_dp, p.oi_dp, p.od_altura, p.oi_altura], ['32', '31', '24', '24']);
    assert.equal(p.diametro, '65');
    assert.equal(p.indice, '1.56');
});
ok('material, tratamiento y artículo se deducen del nombre del cristal', () => {
    const p = armarPedidoSmartLab(ventaBase(), 1).payload;
    assert.equal(p.material, 'Orgánico');
    assert.equal(p.tratamiento, 'Filtro Azul');
    assert.ok(p.fuzzy_article.includes('org') && p.fuzzy_article.includes('blue') && p.fuzzy_article.includes('1.56'), p.fuzzy_article.join(','));
});
ok('las medidas del armazón, su forma, sus detalles y el tipo de armazón van en el pedido', () => {
    const p = armarPedidoSmartLab(ventaBase(), 1).payload;
    assert.deepEqual([p.medidaA, p.medidaB, p.medidaED, p.medidaPte], ['52', '40', '56', '18']);
    assert.equal(p.forma_armazon, 'Redonda');
    assert.equal(p.armazon, 'Armazón Vulk Vulk Roma Acetato - color rojo');
    assert.equal(p.tipo_armazon, 'PLÁSTICO');
    assert.equal(p.tipo_aro, 'Calibrado Aro Entero');
});
ok('las observaciones juntan la nota de la receta y la del laboratorio', () => {
    const p = armarPedidoSmartLab(ventaBase(), 1).payload;
    assert.equal(p.observaciones, 'receta del Dr. López | sin apuro');
});
ok('sin armazón propio, el del cliente', () => {
    const v = ventaBase();
    v.items = v.items.filter(i => i.product.category !== 'Armazón de Receta');
    v.frameSource = 'USUARIO'; v.userFrameBrand = 'Ray-Ban'; v.userFrameModel = 'Wayfarer';
    assert.equal(armarPedidoSmartLab(v, 1).payload.armazon, 'Armazón del cliente Ray-Ban Wayfarer - color rojo');
});

console.log('\n— 2x1: cada par lleva SU cristal y SUS medidas —');
const venta2x1 = () => {
    const v = ventaBase();
    v.appliedPromoName = 'Promo 2x1';
    const multi = { name: 'Multifocal Smart Free Policarbonato 2x1', category: 'Cristal', type: 'Cristal Multifocal', lensIndex: '1.59' };
    v.items = [
        cristal('OD'), cristal('OI'), armazon(),
        cristal('OD', { framePosition: 2, product: multi, sphereVal: 1.0, cylinderVal: null, axisVal: null, additionVal: 2.0 }),
        cristal('OI', { framePosition: 2, product: multi, sphereVal: 1.25, cylinderVal: null, axisVal: null, additionVal: 2.0 }),
        armazon({ framePosition: 2, product: { name: 'Kazwini Milano Metal', category: 'Armazón de Receta', type: 'Armazón', brand: 'Kazwini' } }),
    ];
    v.frames.push({ position: 2, shape: 'Cuadrada', a: '50', b: '38', dbl: '17', edc: '54', details: 'dorado', imageUrl: null, heightOD: 22, heightOI: 21 });
    return v;
};
ok('el par 1 va con el monofocal y el armazón 1', () => {
    const r = armarPedidoSmartLab(venta2x1(), 1);
    assert.equal(r.ok, true, r.faltantes.join(' | '));
    assert.equal(r.payload.tipo_lente, 'Monofocal');
    assert.equal(r.payload.medidaA, '52');
    assert.equal(r.payload.od_esfera, '-1.25');
    assert.equal(r.payload.tipo_armazon, 'PLÁSTICO');
});
ok('el par 2 va con el multifocal, SU receta, SU altura y el armazón 2 (antes mandaba el cristal del par 1)', () => {
    const r = armarPedidoSmartLab(venta2x1(), 2);
    assert.equal(r.ok, true, r.faltantes.join(' | '));
    const p = r.payload;
    assert.equal(p.codigoInterno, '#AB12');
    assert.equal(p.tipo_lente, 'Multifocal');
    assert.equal(p.material, 'Policarbonato');
    assert.deepEqual([p.od_esfera, p.oi_esfera, p.od_adicion, p.oi_adicion], ['+1.00', '+1.25', '+2.00', '+2.00']);
    assert.deepEqual([p.medidaA, p.medidaB, p.medidaED, p.medidaPte], ['50', '38', '54', '17']);
    assert.deepEqual([p.od_altura, p.oi_altura], ['22', '21']);
    assert.equal(p.forma_armazon, 'Cuadrada');
    assert.ok(p.armazon.startsWith('Armazón Kazwini'), p.armazon);
    assert.equal(p.tipo_armazon, 'METALICO');
    assert.ok(p.fuzzy_article.includes('free') && p.fuzzy_article.includes('poli'));
});
ok('una venta de un solo par no tiene par 2: se dice, no se inventa', () => {
    const r = armarPedidoSmartLab(ventaBase(), 2);
    assert.equal(r.ok, false);
    assert.equal(r.payload, null);
    assert.ok(r.faltantes.some(f => /cristales propios del par 2/.test(f)), r.faltantes.join(' | '));
});
ok('una venta vieja sin framePosition reparte los pares por orden (el 2º OD/OI es el par 2)', () => {
    const v = venta2x1();
    v.items.forEach(i => { i.framePosition = null; });
    const r = armarPedidoSmartLab(v, 2);
    assert.equal(r.ok, true, r.faltantes.join(' | '));
    assert.equal(r.payload.tipo_lente, 'Multifocal');
    assert.equal(r.payload.medidaA, '50');
});
ok('las medidas caen a las columnas viejas (frameA2…) cuando no hay fila de armazón', () => {
    const v = venta2x1();
    v.frames = [];
    v.frameA = '53'; v.frameA2 = '49'; v.labHeightOD = 25; v.labHeightOD2 = 20; v.labFrameDetails2 = 'patillas finas';
    assert.equal(armarPedidoSmartLab(v, 1).payload.medidaA, '53');
    const p2 = armarPedidoSmartLab(v, 2).payload;
    assert.equal(p2.medidaA, '49');
    assert.equal(p2.od_altura, '20');
    assert.equal(p2.detalles_armazon, 'patillas finas');
});

console.log('\n— Lo que frena: se dice, no se manda —');
ok('sin tipo de pedido (Stock o Laboratorio) no se manda: antes el favorito marcaba Stock solo', () => {
    const v = ventaBase();
    v.labType = null;
    const r = armarPedidoSmartLab(v, 1);
    assert.equal(r.ok, false);
    assert.equal(r.payload, null);
    assert.ok(r.faltantes.some(f => /tipo de pedido \(Stock o Laboratorio\)/.test(f)), r.faltantes.join(' | '));
    v.labType = 'LABORATORY';
    assert.equal(armarPedidoSmartLab(v, 1).payload.labType, 'LABORATORY');
    v.labType = 'cualquier cosa';
    assert.equal(armarPedidoSmartLab(v, 1).ok, false);
});
ok('cilindro sin eje frena; cilindro en cero no pide eje', () => {
    const v = ventaBase();
    v.items[0].axisVal = null; v.prescription.axisOD = null;
    const r = armarPedidoSmartLab(v, 1);
    assert.equal(r.ok, false);
    assert.ok(r.faltantes.some(f => /eje OD/.test(f)), r.faltantes.join(' | '));
    v.items[0].cylinderVal = 0; v.prescription.cylinderOD = 0;
    assert.equal(armarPedidoSmartLab(v, 1).ok, true);
});
ok('multifocal / ocupacional / bifocal sin adición frena; monofocal no la pide', () => {
    const v = venta2x1();
    v.items[3].additionVal = null; v.items[4].additionVal = null;
    const r = armarPedidoSmartLab(v, 2);
    assert.equal(r.ok, false);
    assert.ok(r.faltantes.some(f => /adición OD del par 2/.test(f)) && r.faltantes.some(f => /adición OI del par 2/.test(f)), r.faltantes.join(' | '));
    v.prescription.addition = 2.25;
    const conFicha = armarPedidoSmartLab(v, 2);
    assert.equal(conFicha.ok, true, 'la adición de la ficha alcanza');
    assert.equal(conFicha.payload.od_adicion, '+2.25');
    assert.equal(tipoDeLenteSmartLab('Cristal Ocupacional', ''), 'Ocupacional');
    assert.equal(tipoDeLenteSmartLab('', 'Bifocal Kriptok orgánico'), 'Bifocal Kri');
    assert.equal(tipoDeLenteSmartLab('', 'Bifocal Flat Top'), 'Bifocal Ft');
    assert.equal(tipoDeLenteSmartLab('Cristal Monofocal', 'Varilux Comfort'), 'Monofocal');
});
ok('sin esférico de un ojo con cristal, frena', () => {
    const v = ventaBase();
    v.items[1].sphereVal = null; v.prescription.sphereOI = null;
    const r = armarPedidoSmartLab(v, 1);
    assert.equal(r.ok, false);
    assert.ok(r.faltantes.some(f => /esférico OI/.test(f)), r.faltantes.join(' | '));
});
ok('DNP y altura faltantes AVISAN pero no frenan (el portal las pide igual)', () => {
    const v = venta2x1();
    v.labPdOd = null; v.labPdOi = null; v.prescription.distanceOD = null; v.prescription.distanceOI = null;
    v.frames[1].heightOD = null; v.frames[1].heightOI = null;
    const r = armarPedidoSmartLab(v, 2);
    assert.equal(r.ok, true, r.faltantes.join(' | '));
    assert.ok(r.avisos.some(a => /DNP OD/.test(a)) && r.avisos.some(a => /altura pupilar OI del par 2/.test(a)), r.avisos.join(' | '));
    assert.equal(r.payload.od_dp, '');
    assert.ok(textoPasosSmartLab(r.avisos).includes('REVISÁ EN EL PORTAL'));
    assert.ok(!textoPasosSmartLab([]).includes('REVISÁ'));
});
ok('el alert de faltantes lista cada cosa en su renglón', () => {
    assert.equal(textoFaltantesSmartLab(['esférico OD', 'tipo de pedido (Stock o Laboratorio)']), 'No se puede mandar a SmartLab todavía:\n• esférico OD\n• tipo de pedido (Stock o Laboratorio)');
});

console.log('\n— Teñido: solo de las líneas de teñido —');
ok('el color de la línea de teñido va como teñido, con su grado y su estilo', () => {
    const v = ventaBase();
    v.items.push({ eye: null, quantity: 1, framePosition: 1, product: { name: 'Teñido Compacto', category: 'Cristal', type: 'Tratamientos' }, crystalColor: 'Sepia', crystalColorType: 'COMPACTO', crystalColorNote: '3' });
    const p = armarPedidoSmartLab(v, 1).payload;
    assert.equal(p.color_tenido, 'Sepia');
    assert.equal(p.tipo_tenido, 'Pleno');
    assert.equal(p.intensidad_tenido, '3');
    assert.ok(p.observaciones.includes('Teñido Compacto · Sepia · grado 3'), p.observaciones);
    // El estilo lo dice el PRODUCTO ("Teñido Degradé" es degradé): un
    // crystalColorType viejo que lo contradiga no lo pisa.
    v.items[3].product.name = 'Teñido Degradé'; v.items[3].crystalColorType = 'DEGRADE';
    assert.equal(armarPedidoSmartLab(v, 1).payload.tipo_tenido, 'Degradé');
    v.items[3].product.name = 'Teñido según muestra'; v.items[3].crystalColorType = 'MUESTRA';
    assert.equal(armarPedidoSmartLab(v, 1).payload.tipo_tenido, 'Pleno');
});
ok('el tono de un fotocromático NO es un teñido: no viaja como color a hacer', () => {
    const v = ventaBase();
    const foto = { name: 'Monofocal Transitions Gen S Orgánico', category: 'Cristal', type: 'Cristal Monofocal' };
    v.items[0].product = foto; v.items[1].product = foto;
    v.items[0].crystalColor = 'Zafiro'; v.items[1].crystalColor = 'Zafiro';
    const p = armarPedidoSmartLab(v, 1).payload;
    assert.equal(p.color_tenido, '');
    assert.equal(p.tipo_tenido, '');
    assert.equal(p.intensidad_tenido, '');
    assert.equal(p.tratamiento, 'Fotocromático');
});
ok('en un 2x1 el teñido del par 1 no se le pega al par 2', () => {
    const v = venta2x1();
    v.items.push({ eye: null, quantity: 1, framePosition: 1, product: { name: 'Teñido Degradé', category: 'Cristal', type: 'Tratamientos' }, crystalColor: 'Gris', crystalColorType: 'DEGRADE', crystalColorNote: '2' });
    assert.equal(armarPedidoSmartLab(v, 1).payload.color_tenido, 'Gris');
    assert.equal(armarPedidoSmartLab(v, 2).payload.color_tenido, '');
});

console.log('\n— Postventa con receta distinta —');
ok('la receta de la postventa (DIFFERENT) pisa a la de la venta, par por par', () => {
    const v = venta2x1();
    v.postSaleOrderOption = 'DIFFERENT';
    v.postSaleRxData = JSON.stringify({ rx1: { sphereOD: '-2.00', axisOD: '90' }, rx2: { sphereOD: '', additionOD: '2.50', material: 'Alto Índice' } });
    const p1 = armarPedidoSmartLab(v, 1).payload;
    assert.deepEqual([p1.od_esfera, p1.od_eje, p1.oi_esfera], ['-2.00', '90', '-0.75']);
    const r2 = armarPedidoSmartLab(v, 2);
    assert.equal(r2.ok, false, 'la postventa dejó el esférico OD vacío: falta');
    assert.ok(r2.faltantes.some(f => /esférico OD del par 2/.test(f)), r2.faltantes.join(' | '));
    v.postSaleRxData = JSON.stringify({ rx2: { sphereOD: '-3.25', additionOD: '2.50', material: 'Alto Índice' } });
    const p2 = armarPedidoSmartLab(v, 2).payload;
    assert.deepEqual([p2.od_esfera, p2.od_adicion, p2.oi_adicion, p2.material], ['-3.25', '+2.50', '+2.00', 'Alto Índice']);
});
ok('un postSaleRxData roto no tira: se usa la receta de la venta', () => {
    const v = ventaBase();
    v.postSaleOrderOption = 'DIFFERENT'; v.postSaleRxData = '{no es json';
    assert.equal(armarPedidoSmartLab(v, 1).payload.od_esfera, '-1.25');
});

console.log('\n— La URL del portal —');
ok('el pedido viaja en el hash #ATELIER_DATA= y vuelve intacto', () => {
    const p = armarPedidoSmartLab(ventaBase(), 1).payload;
    const url = urlSmartLabConPedido(p);
    assert.ok(url.startsWith('https://grupooptico.dyndns.info/smartlab/laboratory/new#ATELIER_DATA='));
    const vuelta = JSON.parse(decodeURIComponent(url.slice(url.indexOf('ATELIER_DATA=') + 13)));
    assert.deepEqual(vuelta, p);
});
ok('el favorito publicado no elige "la primera opción" ni marca Stock sin dato', () => {
    const src = readFileSync(new URL('../../src/app/admin/smartlab-bookmarklet/page.tsx', import.meta.url), 'utf8');
    const m = src.match(/const bookmarkletCode = `(.*?)`;/s);
    assert.ok(m, 'no se encontró el string del favorito');
    const code = m[1].replace(/\\\\n/g, '\\n').slice('javascript:'.length);
    new Function(code);
    assert.ok(!/opts\[0\]\.click/.test(code), 'volvió el fallback a la primera opción');
    assert.ok(!/D\.labType\|\|'STOCK'/.test(code), 'volvió el "Stock" por defecto');
    assert.ok(/pend\.push/.test(code) && /REVISÁ/.test(code), 'el alert final no lista los pendientes');
});

console.log(fallas === 0 ? '\n✅ Armado del pedido para SmartLab: todo en orden.\n' : `\n❌ ${fallas} falla(s).\n`);
process.exit(fallas === 0 ? 0 : 1);

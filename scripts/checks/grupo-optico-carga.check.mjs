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
import { planDeCarga, payloadCreateUpdate, observacionDelPedido, esVenta2x1, rolesDel2x1 } from '../../src/services/lab-modules/grupo-optico/carga.ts';
import { rolesPorValor, valorDeCristales, avisoDeRoles, rolesDeDosPares } from '../../src/lib/laboratorios/roles-2x1.ts';
import { elegirNumeroDelParConCargo } from '../../src/services/lab-modules/grupo-optico/origen.ts';
import { textoDeExtraNoCobrado, lineaDeFicha } from '../../src/services/lab-modules/carga/extras-no-cobrados.ts';
import { pedidoYaCreado, diferenciasConLoAprobado, puedeCrearPedidosReales } from '../../src/services/lab-modules/grupo-optico/robot.ts';
import { parDeFila } from '../../src/services/lab-modules/grupo-optico/pedidos.ts';
import { decidirExistente } from '../../src/services/lab-modules/grupo-optico/existentes.ts';
import { pedidoComoLoGuardaElPortal, diferenciasDeVista } from '../../src/services/lab-modules/grupo-optico/vista.ts';
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

console.log('\nAlgo que se carga sin estar cobrado (Ishtar, 8/10/2026)');
ok('Essential pedido como extra: el catálogo lo resuelve con Essential aunque el producto no lo diga', () => {
    const sin = especificacionDe('Multifocal Smart FREE · Orgánico Blue Light 1.56');
    assert.equal(sin.especificacion.essential, false);
    const con = especificacionDe('Multifocal Smart FREE · Orgánico Blue Light 1.56', { conEssential: true });
    assert.equal(con.especificacion.essential, true);
});
ok('el mensaje a la dueña lleva el motivo completo y la venta entera; la ficha, una línea firmada', () => {
    const d = { baseUrl: 'https://crm.atelier', codigoVenta: '#L4AU', orderId: 'cmu6zfb0e00g6oe07n4rbl4au', cliente: 'Laura Santucho', vendedor: 'Agostina', fechaVenta: '01/10/2026', nombreLab: 'Grupo Óptico', pair: 1, pares: 2,
        renglones: ['Smart FREE · Blue 1.56 (OD) · par 1: $ 185.000', 'Smart FREE · Blue 1.56 (OI) · par 1: $ 185.000'], total: '$ 490.000', promo: 'Promo 2x1',
        loQueSeCarga: 'Smart FREE · Blue 1.56 + Essential (antirreflejo)', extra: { clave: 'essential', nombre: 'Essential (antirreflejo)', motivo: 'se lo prometimos' }, quien: 'Matías' };
    const t = textoDeExtraNoCobrado(d);
    for (const esperado of ['Matías agregó Essential', 'NO está cobrado', '"se lo prometimos"', 'Laura Santucho', '$ 185.000', 'Total: $ 490.000', 'promo: Promo 2x1', '(par 1)', 'https://crm.atelier/admin/ventas?id=cmu6zfb0e00g6oe07n4rbl4au']) assert.ok(t.includes(esperado), esperado);
    assert.match(lineaDeFicha(d), /^⚠️ Matías agregó Essential .* SIN estar cobrado\. Motivo: se lo prometimos$/);
});
console.log('\nEl orden del 2x1 lo decide el valor (Ishtar, 8/10/2026)');
ok('el par de mayor valor va con cargo y el de menor valor sin cargo; mismo valor = queda el orden de la venta', () => {
    assert.deepEqual(rolesPorValor([{ pair: 1, valor: 100 }, { pair: 2, valor: 100 }]), { conCargo: 1, sinCargo: 2, porValor: false, valores: { 1: 100, 2: 100 } });
    assert.equal(rolesPorValor([{ pair: 1, valor: 150 }, { pair: 2, valor: 100 }]).conCargo, 1);
    assert.equal(rolesPorValor([{ pair: 1, valor: 100 }, { pair: 2, valor: 150 }]).conCargo, 2);
    assert.equal(rolesPorValor([{ pair: 1, valor: 100 }, { pair: 2, valor: 150 }]).sinCargo, 1);
    assert.equal(rolesPorValor([{ pair: 1, valor: 100 }]), null);
    assert.equal(valorDeCristales([{ price: 100, quantity: 2 }, { price: 7 }, { price: null }]), 207);
    assert.equal(avisoDeRoles(rolesPorValor([{ pair: 1, valor: 100 }, { pair: 2, valor: 100 }]), String), null);
    assert.match(avisoDeRoles(rolesPorValor([{ pair: 1, valor: 100 }, { pair: 2, valor: 150 }]), String), /par 2 es el de mayor valor \(150\) y va CON CARGO; el par 1 \(100\) va sin cargo/);
});

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
ok('el valor es el PRECIO DE LISTA del producto, no la línea: en el 2x1 el CRM deja el 2º par en $0', () => {
    assert.equal(valorDeCristales([{ price: 0, product: { price: 120000 } }, { price: 0, product: { price: 120000 } }]), 240000);
    // mismo producto en los dos pares, líneas X/2, X/2, 0, 0 y las del par 2 ANTES en el array: empate → par 1 con cargo
    const p = (fp, price) => ({ framePosition: fp, price, quantity: 1, product: { name: 'Smart FREE · Blue 1.56 · Essential 2x1', price: 240000 } });
    const r = rolesDeDosPares([{ pair: 2, items: [p(2, 0), p(2, 0)] }, { pair: 1, items: [p(1, 120000), p(1, 120000)] }]);
    assert.deepEqual([r.conCargo, r.sinCargo, r.porValor], [1, 2, false]);
    // productos distintos: por lista aunque la línea del caro esté en $0
    const q = (fp, price, nombre, lista) => ({ framePosition: fp, price, quantity: 1, product: { name: nombre, price: lista } });
    const d = rolesDeDosPares([{ pair: 1, items: [q(1, 100000, 'Básico', 100000), q(1, 100000, 'Básico', 100000)] }, { pair: 2, items: [q(2, 0, 'Premium', 150000), q(2, 0, 'Premium', 150000)] }]);
    assert.deepEqual([d.conCargo, d.sinCargo, d.porValor], [2, 1, true]);
});
ok('2x1 con cristales sin armazón asignado (como la venta real #L4AU): no se adivina, falta asignarlos', () => {
    const v = venta2x1(); v.items = v.items.map(i => (i.eye ? { ...i, framePosition: null } : i));
    const r = planDeCarga(v, 1, { tipoArmazon: 'PLASTICO' });
    assert.equal(r.ok, false); assert.ok(r.faltantes.some(f => /cristales sin armazón asignado/.test(f)), r.faltantes.join(' | '));
    // con un solo par no hace falta
    const uno = venta2x1(); uno.frames = [uno.frames[0]]; uno.items = uno.items.filter(i => i.framePosition !== 2 || i.product.category === 'Tratamiento').map(i => (i.eye ? { ...i, framePosition: null } : i)).filter(i => i.product.category !== 'Tratamiento');
    assert.equal((planDeCarga(uno, 1, { tipoArmazon: 'PLASTICO' }).faltantes || []).some(f => /sin armazón asignado/.test(f)), false);
});
ok('si el rol gira entre preparar y aprobar, el payload cambia (observación) o deja de armar: nada sale con el rol viejo', () => {
    const lista = (fp) => (fp === 2 ? 150000 : 100000);
    const v = venta2x1(); v.items = v.items.map(i => (i.eye ? { ...i, product: { ...i.product, name: i.framePosition === 2 ? 'Multifocal Smart FREE · Orgánico Blue Light 1.56 · Premium 2x1' : i.product.name, price: lista(i.framePosition) } } : i));
    const RES = { materialId: 20, colorId: 1, brandId: 145, articuloOD: 28463, articuloOI: 28463, typeRimArticleId: 8896, tinted: null, clientId: '2462' };
    const aprobado = planDeCarga(v, 1, { tipoArmazon: 'PLASTICO', pedidoOrigen: '80549878' }); // par 1 = barato = SIN CARGO
    assert.equal(aprobado.plan.rol2x1, 'SIN_CARGO');
    const antes = payloadCreateUpdate(aprobado.plan, RES);
    // se edita la venta: el par 1 pasa a ser el caro → ahora es CON CARGO, con las mismas opciones
    const w = JSON.parse(JSON.stringify(v)); w.items.forEach(i => { if (i.eye) i.product.price = i.framePosition === 1 ? 200000 : 150000; });
    const hoy = planDeCarga(w, 1, { tipoArmazon: 'PLASTICO', pedidoOrigen: '80549878' });
    assert.equal(hoy.plan.rol2x1, 'CON_CARGO');
    assert.ok(cambiosEntrePayloads(antes, payloadCreateUpdate(hoy.plan, RES)).some(c => /opticsComment/.test(c)));
    // y al revés: CON CARGO aprobado que hoy sería SIN CARGO sin nº → no arma
    const conCargo = planDeCarga(w, 1, { tipoArmazon: 'PLASTICO' });
    assert.equal(conCargo.ok, true);
    assert.equal(planDeCarga(v, 1, { tipoArmazon: 'PLASTICO' }).ok, false);
});
ok('el nº del par con cargo: nunca un pedido ANULADO ni un reproceso, y el tipeado solo si no es de otro par', () => {
    const base = { pair: 2, cargado: null, espejo: [], numerosEnVenta: [], reprocesos: [] };
    assert.equal(elegirNumeroDelParConCargo({ ...base, cargado: '80000001' }), '80000001');
    assert.equal(elegirNumeroDelParConCargo({ ...base, cargado: '80000001', espejo: [{ numero: '80000001', pair: 2, anulado: true }] }), null);
    assert.equal(elegirNumeroDelParConCargo({ ...base, espejo: [{ numero: '80000002', pair: 2, anulado: false }] }), '80000002');
    assert.equal(elegirNumeroDelParConCargo({ ...base, espejo: [{ numero: '80000002', pair: 2, anulado: false }, { numero: '80000003', pair: 2, anulado: false }] }), null);
    assert.equal(elegirNumeroDelParConCargo({ ...base, numerosEnVenta: ['80000004'] }), '80000004');
    assert.equal(elegirNumeroDelParConCargo({ ...base, numerosEnVenta: ['80000004'], espejo: [{ numero: '80000004', pair: 2, anulado: true }] }), null);
    assert.equal(elegirNumeroDelParConCargo({ ...base, numerosEnVenta: ['80000004'], reprocesos: ['80000004'] }), null);
    assert.equal(elegirNumeroDelParConCargo({ ...base, numerosEnVenta: ['80000004'], espejo: [{ numero: '80000004', pair: 1, anulado: false }] }), null);
    assert.equal(elegirNumeroDelParConCargo({ ...base, numerosEnVenta: ['80000004', '80000005'] }), null);
    assert.equal(elegirNumeroDelParConCargo({ ...base, numerosEnVenta: ['619486'] }), null); // de otro lab
});
ok('una fila del robot del par 1 sin cargo (código "…1°par", observación "2° par SIN CARGO…") es del par 1', () => {
    assert.equal(parDeFila({ CodigoOptica: '#L4AU Laura Santucho 1°par', Observacion: 'Promo 2x1 Smart Free - 2° par SIN CARGO - 1° par n° 80549878' }), 1);
});
ok('el plan con Essential no cobrado: carga Essential, lo anota con el motivo y avisa; sin motivo no agrega nada', () => {
    const v = venta2x1(); v.items = v.items.map(i => (i.eye ? { ...i, product: { ...i.product, name: 'Multifocal Smart FREE · Orgánico Blue Light 1.56 2x1' } } : i));
    const r = planDeCarga(v, 1, { tipoArmazon: 'PLASTICO', extras: { essential: 'el cliente lo tenía en el par anterior y se lo prometimos' } });
    assert.ok(r.ok, r.faltantes?.join(' | '));
    assert.equal(r.plan.especificacion.essential, true);
    assert.deepEqual(r.plan.extrasNoCobrados, [{ clave: 'essential', nombre: 'Essential (antirreflejo)', motivo: 'el cliente lo tenía en el par anterior y se lo prometimos' }]);
    assert.ok(r.avisos.some(a => /Essential agregado SIN COBRAR/.test(a)));
    const sin = planDeCarga(v, 1, { tipoArmazon: 'PLASTICO', extras: { essential: '' } });
    assert.equal(sin.plan.especificacion.essential, false); assert.deepEqual(sin.plan.extrasNoCobrados, []);
    // si el producto ya es Essential, no es un extra
    const ya = planDeCarga(venta2x1(), 1, { tipoArmazon: 'PLASTICO', extras: { essential: 'motivo cualquiera' } });
    assert.deepEqual(ya.plan.extrasNoCobrados, []); assert.equal(ya.plan.especificacion.essential, true);
    // motivo de compromiso: frena del lado del servidor, no solo en el navegador
    const corto = planDeCarga(v, 1, { tipoArmazon: 'PLASTICO', extras: { essential: '.' } });
    assert.equal(corto.ok, false); assert.ok(corto.faltantes.some(f => /al menos 10 letras/.test(f)), corto.faltantes.join(' | '));
    // un material que ya trae antirreflejo (Anti Age): no hay Essential que agregar
    const aa = venta2x1(); aa.items = aa.items.map(i => (i.eye ? { ...i, product: { ...i.product, name: 'Multifocal Smart FREE · Orgánico Blue Anti Age 1.60 2x1' } } : i));
    const ar = planDeCarga(aa, 1, { tipoArmazon: 'PLASTICO', extras: { essential: 'motivo con más de diez letras' } });
    assert.ok(ar.faltantes?.some(f => /ya trae antirreflejo/.test(f)), (ar.faltantes || []).join(' | '));
    // un par teñido no lleva Essential: frena
    const sol = planDeCarga(v, 2, { tipoArmazon: 'PLASTICO', pedidoOrigen: '80549878', extras: { essential: 'motivo cualquiera' } });
    assert.equal(sol.ok, false); assert.ok(sol.faltantes.some(f => /par teñido/.test(f)), sol.faltantes.join(' | '));
});
ok('un par CON CARGO vendido en un material que no se tiñe, con teñido: frena (no se degrada a Blanco 1.49 en silencio)', () => {
    const v = venta2x1(); v.frames = [v.frames[0]]; v.items = v.items.filter(i => i.framePosition !== 2 || i.product.category === 'Tratamiento').map(i => (i.product.category === 'Tratamiento' ? { ...i, framePosition: 1 } : i));
    const r = planDeCarga(v, 1, { tipoArmazon: 'PLASTICO' });
    assert.equal(r.ok, false); assert.ok(r.faltantes.some(f => /no se tiñe en el laboratorio/.test(f)), r.faltantes.join(' | '));
    const s = planDeCarga(venta2x1(), 2, { tipoArmazon: 'PLASTICO', pedidoOrigen: '80549878' });
    assert.ok(s.ok, s.faltantes?.join(' | ')); assert.ok(s.avisos.some(a => /Orgánico Blanco 1.49/.test(a)));
});
ok('Ocupacional Ultra Relax: el portal lo carga como monofocal, no pide adición', () => {
    const v = venta2x1(); v.frames = [v.frames[0]];
    v.items = v.items.filter(i => i.framePosition === 1 && i.eye).map(i => ({ ...i, additionVal: null, product: { ...i.product, name: 'Ocupacional Ultra Relax · Orgánico Blue Light 1.56 · Essential', type: 'Cristal Ocupacional' } }));
    const r = planDeCarga(v, 1, { tipoArmazon: 'PLASTICO' });
    assert.ok(r.ok, (r.faltantes || []).join(' | '));
    assert.ok(r.plan.od && r.plan.od.esferico && r.plan.oi, 'el plan tiene que traer la graduación');
    assert.equal(r.plan.od.adicion, 0);
});
ok('un pedido del portal con el código de la venta pero OTRO nombre al lado es AMBIGUO: ni se adopta ni se crea otro', () => {
    const filas = [{ CodigoOptica: '#L4AU sol', Observacion: '', Anulado: '0', IdPedido: '80111111' }];
    const r = pedidoYaCreado(filas, '#L4AU', null, new Set(), 'Laura Santucho');
    assert.ok(r && r.ambiguo, JSON.stringify(r));
    // el propio pedido del robot, con acentos y mayúsculas distintas, se reconoce
    const propio = pedidoYaCreado([{ CodigoOptica: '#L4AU LAURA SANTUCHÓ 1°par', Observacion: '', Anulado: '0', IdPedido: '80111112' }], '#L4AU', 1, new Set(), 'Laura Santucho');
    assert.ok(propio && !propio.ambiguo, JSON.stringify(propio));
    // sin nombre al lado, también
    assert.ok(!pedidoYaCreado([{ CodigoOptica: '#L4AU', Observacion: '', Anulado: '0', IdPedido: '80111113' }], '#L4AU', null, new Set(), 'Laura Santucho').ambiguo);
});
ok('el estilo del teñido lo dice el producto (Degradé) aunque el ítem traiga otro type; y sin product, el snapshot', () => {
    const v = venta2x1(); v.items = v.items.map(i => (i.product.category === 'Tratamiento' ? { ...i, crystalColorType: 'COMPACTO', product: { ...i.product, name: 'Teñido Degradé' } } : i));
    const r = planDeCarga(v, 2, { tipoArmazon: 'PLASTICO', pedidoOrigen: '80549878' });
    assert.ok(r.ok, r.faltantes?.join(' | ')); assert.equal(r.plan.tenido.tipo, 'DEGRADE');
    const w = venta2x1(); w.items = w.items.map(i => (i.product.category === 'Tratamiento' ? { ...i, product: null, productNameSnapshot: 'Teñido Compacto', productCategorySnapshot: 'Tratamiento' } : i));
    const r2 = planDeCarga(w, 2, { tipoArmazon: 'PLASTICO', pedidoOrigen: '80549878' });
    assert.ok(r2.ok, r2.faltantes?.join(' | ')); assert.equal(r2.plan.tenido.tipo, 'COMPACTO');
});
ok('un cristal asignado a un armazón que la venta no tiene: frena y lo dice', () => {
    const v = venta2x1(); v.items = v.items.map(i => (i.eye && i.framePosition === 2 ? { ...i, framePosition: 3 } : i));
    const r = planDeCarga(v, 1, { tipoArmazon: 'PLASTICO' });
    assert.ok((r.faltantes || []).some(f => /asignado al armazón 3/.test(f)), (r.faltantes || []).join(' | '));
});
ok('un nº de SmartLab es de 8 dígitos que empiezan con 8 (mañana 81xxxxxx también)', () => {
    assert.ok(planDeCarga(venta2x1(), 2, { tipoArmazon: 'PLASTICO', pedidoOrigen: '81000001' }).ok);
    assert.equal(planDeCarga(venta2x1(), 2, { tipoArmazon: 'PLASTICO', pedidoOrigen: '619486' }).ok, false);
});
ok('la forma del armazón: 0 del formulario del portal equivale a "sin forma"', () => {
    assert.deepEqual(diferenciasDeVista({ frameShape: null }, { frameShape: 0 }), []);
    assert.equal(diferenciasDeVista({ frameShape: null }, { frameShape: 3 }).length, 1);
});
ok('2x1 con el mismo cristal en los dos pares: el par 1 va con cargo y el 2 sin cargo (como siempre)', () => {
    const v = venta2x1(); v.items = v.items.map(i => (i.eye ? { ...i, price: 80000 } : i));
    assert.deepEqual([rolesDel2x1(v).conCargo, rolesDel2x1(v).sinCargo], [1, 2]);
    assert.equal(planDeCarga(v, 1, { tipoArmazon: 'PLASTICO' }).plan.rol2x1, 'CON_CARGO');
    const r2 = planDeCarga(v, 2, { tipoArmazon: 'PLASTICO', pedidoOrigen: '80549878' });
    assert.equal(r2.plan.rol2x1, 'SIN_CARGO'); assert.equal(r2.plan.pedidoOrigen, '80549878');
    assert.match(r2.plan.observacion, /2° par SIN CARGO - 1° par n° 80549878/);
    assert.ok(!r2.avisos.some(a => /mayor valor/.test(a)));
});
ok('2x1 con dos cristales distintos: el de mayor valor de lista (par 2) va CON CARGO y el par 1 sin cargo, con el nº del par 2', () => {
    // sin teñido: el par con cargo no puede ir teñido en Blue Light (eso frena, caso aparte)
    const v = venta2x1(false); v.items = v.items.map(i => (i.eye ? { ...i, price: 0, product: { ...i.product, name: i.framePosition === 2 ? 'Multifocal Smart FREE · Orgánico Blue Light 1.56 · Premium 2x1' : i.product.name, price: i.framePosition === 2 ? 120000 : 80000 } } : i));
    assert.deepEqual([rolesDel2x1(v).conCargo, rolesDel2x1(v).sinCargo], [2, 1]);
    const r2 = planDeCarga(v, 2, { tipoArmazon: 'PLASTICO' });
    assert.ok(r2.ok, r2.faltantes?.join(' | '));
    assert.equal(r2.plan.rol2x1, 'CON_CARGO'); assert.match(r2.plan.observacion, /^Promo 2x1 Smart Free - 1° par( \||$)/);
    assert.ok(r2.avisos.some(a => /par 2 es el de mayor valor/.test(a)), r2.avisos.join(' | '));
    const sin = planDeCarga(v, 1, { tipoArmazon: 'PLASTICO' });
    assert.equal(sin.ok, false); assert.ok(sin.faltantes.some(f => /par con cargo \(par 2\) ya cargado/.test(f)), sin.faltantes.join(' | '));
    const r1 = planDeCarga(v, 1, { tipoArmazon: 'PLASTICO', pedidoOrigen: '80549878' });
    assert.ok(r1.ok, r1.faltantes?.join(' | '));
    assert.equal(r1.plan.rol2x1, 'SIN_CARGO'); assert.match(r1.plan.observacion, /2° par SIN CARGO - 1° par n° 80549878/);
    // el código interno sigue diciendo qué ARMAZÓN de la venta es (es la identidad del par en el CRM)
    assert.match(r1.plan.codigoOptica, /1°par$/);
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
    assert.ok(r.faltantes.some(f => /par con cargo \(par 1\) ya cargado/.test(f)), r.faltantes.join(' | '));
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
    assert.equal(observacionDelPedido({ es2x1: true, sinCargo: false, producto: 'Multifocal Smart FREE · X' }), 'Promo 2x1 Smart Free - 1° par');
    assert.equal(observacionDelPedido({ es2x1: false, sinCargo: false, producto: 'Stock · X', notas: 'urgente' }), 'urgente');
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

console.log('\nLa pantalla real del portal antes de crear (5/10/2026)');
const RES = { materialId: 20, colorId: 1, brandId: 145, articuloOD: 28463, articuloOI: 28463, typeRimArticleId: 8896, tinted: null, clientId: '2462' };
const ETQ = { tipoLente: 'Multifocal', material: 'ORG BLUE LIGHT 1.56', color: 'Blanco', marca: 'Smart Lens Digital', articuloOD: 'X', articuloOI: 'X', aro: 'Calibrado Aro Entero', tenido: null };
ok('el pedido se le da al formulario del portal con SU forma (la DNP derecha es DistInterpupilar, la izquierda DistMecanica)', () => {
    const r = planDeCarga(venta2x1(), 1, { tipoArmazon: 'PLASTICO', forma: 1 });
    const g = pedidoComoLoGuardaElPortal(payloadCreateUpdate(r.plan, RES), ETQ);
    assert.equal(g.IdTipoLente, '5'); assert.equal(g.OjoDerEsfericoLejos, '0.750'); assert.equal(g.OjoDerCilindricoLejos, '-1.000');
    assert.equal(g.OjoDerEjeLejos, '140'); assert.equal(g.adicionder, '1.500'); assert.equal(g.OjoDerEsfericoCerca, '2.250');
    assert.equal(g.DistInterpupilar, '33.000'); assert.equal(g.DistMecanica, '33.000'); assert.equal(g.AltPupila, '25.000');
    assert.equal(g.right_eye_article_id, 28463); assert.equal(g.IdMaterial, '20'); assert.equal(g.Armazon, 'ZILO');
    assert.equal(g.A, '54.000'); assert.equal(g.frame_shape, 1); assert.equal(g.tinted_id, null);
    assert.match(String(g.CodigoOptica), /^#L4AU .+ 1°par$/);
});
ok('lo que se muestra tiene que ser lo que se manda: cualquier diferencia con lo que armaría el portal frena', () => {
    const r = planDeCarga(venta2x1(), 1, { tipoArmazon: 'PLASTICO', forma: 1 });
    const nuestro = payloadCreateUpdate(r.plan, RES);
    // el portal devuelve los mismos datos con otro formato numérico: no es diferencia
    const portal = { ...nuestro, rightEyePupillaryHeight: '25.000', rightEyeFarSpherical: '+0.75', leftEyeFarAxis: '40', action: 'update', orderId: 99000001, isEdit: true };
    assert.deepEqual(diferenciasDeVista(nuestro, portal), []);
    assert.equal(diferenciasDeVista(nuestro, { ...portal, rightEyeArticle: 10325 }).length, 1);
    assert.equal(diferenciasDeVista(nuestro, { ...portal, bridgeA: null }).length, 1);
    assert.equal(diferenciasDeVista(nuestro, { ...portal, opticsComment: 'otra cosa' }).length, 1);
    // TODAS las claves se comparan, la base del bloque incluida (el robot la adopta del portal antes de comparar)
    assert.equal(nuestro.blockBase, null);
    assert.equal(diferenciasDeVista(nuestro, { ...portal, blockBase: '4' }).length, 1);
    assert.deepEqual(diferenciasDeVista({ ...nuestro, blockBase: '4' }, { ...portal, blockBase: 4 }), []);
    // un 0 solo vale como vacío en ejes y adiciones (eje sin cilindro, adición de monofocal), no en un esférico
    assert.deepEqual(diferenciasDeVista({ ...nuestro, leftEyeFarAxis: 0 }, { ...portal, leftEyeFarAxis: null }), []);
    assert.equal(diferenciasDeVista({ ...nuestro, leftEyeFarSpherical: 0 }, { ...portal, leftEyeFarSpherical: null }).length, 1);
    // una clave que solo trae el portal también cuenta
    assert.equal(diferenciasDeVista(nuestro, { ...portal, algoNuevo: 'x' }).length, 1);
});
ok('las medidas del armazón con decimales se redondean para el portal y se dice', () => {
    const v = venta2x1(); v.frames = [{ ...v.frames[0], a: 54.5 }, v.frames[1]];
    const r = planDeCarga(v, 1, { tipoArmazon: 'PLASTICO', forma: 1 });
    assert.equal(r.ok, true);
    assert.ok(r.avisos.some(a => /redondeadas.*A 54\.5 → 55/.test(a)), r.avisos.join(' | '));
});
ok('la DNP va de a 0,5 y la altura en enteros, como las ofrece el portal: otro valor frena (no se redondea solo)', () => {
    const v = venta2x1(); v.labPdOd = 25.4;
    const r = planDeCarga(v, 1, { tipoArmazon: 'PLASTICO' });
    assert.equal(r.ok, false); assert.ok(r.faltantes.some(f => /DNP OD 25\.4/.test(f)));
    const w = venta2x1(); w.frames = [{ ...w.frames[0], heightOD: 25.5 }, w.frames[1]];
    assert.ok(planDeCarga(w, 1, { tipoArmazon: 'PLASTICO' }).faltantes.some(f => /altura pupilar OD 25\.5/.test(f)));
    const x = venta2x1(); x.labPdOd = 32.5;
    assert.equal(planDeCarga(x, 1, { tipoArmazon: 'PLASTICO' }).ok, true);
});
ok('stock: sin medidas ni forma del armazón y con base 4, como lo arma el formulario del portal', () => {
    const v = { id: 'cmxxxxxxxxxxxxxxxxxxxs3ep', labType: 'STOCK', labPdOd: 31, labPdOi: 32, client: { name: 'Ana' },
        frames: [{ position: 1, a: '54', b: '42', dbl: '18', edc: '55', heightOD: 30, heightOI: 30 }],
        items: [{ eye: 'OD', framePosition: 1, sphereVal: -1.75, cylinderVal: -0.5, axisVal: 15, product: { name: 'Stock · Orgánico Blue c/AR 1.56', category: 'Cristal', type: 'Cristal Monofocal' } },
                { eye: 'OI', framePosition: 1, sphereVal: -2.25, cylinderVal: -1.5, axisVal: 165, product: { name: 'Stock · Orgánico Blue c/AR 1.56', category: 'Cristal', type: 'Cristal Monofocal' } }] };
    const r = planDeCarga(v, 1, { tipoArmazon: 'PLASTICO', forma: 3 });
    assert.ok(r.ok, r.faltantes?.join(' | '));
    const p = payloadCreateUpdate(r.plan, { materialId: 8, colorId: 1, brandId: 135, articuloOD: 9339, articuloOI: 9397, typeRimArticleId: 8889, tinted: null, clientId: '2462' });
    assert.equal(p.bridgeA, null); assert.equal(p.bridge, null); assert.equal(p.frameShape, null); assert.equal(p.blockBase, 4);
    assert.equal(p.rightEyeStockArticle, '1'); assert.equal(p.rightEyeAddition, 0); assert.equal(p.rightEyeNearSpherical, null);
    // y la ficha lo dice, en vez de descartar medidas y forma callada
    assert.ok(r.avisos.some(a => /stock: el formulario del portal no lleva medidas ni forma/.test(a)), r.avisos.join(' | '));
});

console.log(fallas ? `\n❌ ${fallas} falla(s).` : '\n✅ Carga de Grupo Óptico: todo en orden.');
process.exit(fallas ? 1 : 0);

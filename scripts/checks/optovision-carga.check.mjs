// ────────────────────────────────────────────────────────────────────────────
// CARGA DE OPTOVISIÓN: lo puro del módulo (src/services/lab-modules/optovision).
//
//  · promo.ts — el procedimiento oficial de Optovisión (23/9/2026): cupón en la
//    web de la promo + mail a promociones@ y cordoba@ + observación en cada
//    par. Si falta un paso cobran los dos pares: ningún texto sale incompleto.
//  · catalogo.ts — la equivalencia producto del CRM → producto de OVES, por
//    código de variante, contra el catálogo real de 685 filas: nunca "el
//    primero", y lo que OVES no tiene se declara "a mano".
//  · carga.ts — el pedido armado desde la venta: graduación de ESE par,
//    servicios, armazón, referencia con el código de la venta y observación.
//
// Sin base ni red. Corre en CI.   npm run check:carga-optovision
// ────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { marcaDePromo, WEB_DE_PROMO, DESTINATARIOS_PROMO, cuponLimpio, observacionPrimerPar, observacionSegundoPar, asuntoDelMail, pasosPendientes } from '../../src/services/lab-modules/optovision/promo.ts';
import { especificacionDe, colorOvesDe, materialDe, elegirProductoOves, eleccionQuePide, familiaDelNombre, tratamientoDe, varianteDe } from '../../src/services/lab-modules/optovision/catalogo.ts';
import { PRODUCTOS_OVES, OVES_CATALOGO, valueDeOves } from '../../src/lib/laboratorios/oves-catalogo.ts';
import { planDeCarga, referenciaDelPedido, observacionDelPedido, esPromoDobleDeOptovision, rolesDeLaPromo, huellaDelPlan, diferenciasDePlan, cristalesPorPar, promoQueNoCierra, nombraPromoDoble } from '../../src/services/lab-modules/optovision/carga.ts';
import { elegirServicio, diferenciasDeFormulario, numeroDeLaRespuesta, referenciaCoincide, pedidoConsultadoEsNuestro, fechaDelPortal } from '../../src/services/lab-modules/optovision/llenar.ts';
import { textoDeFallaDeConfirmacion } from '../../src/services/lab-modules/carga/robot-comun.ts';
import { decidirConAprobado } from '../../src/services/lab-modules/carga/decision.ts';
import { mensajeExistente } from '../../src/services/lab-modules/optovision/existentes.ts';

let n = 0;
const t = (nombre, fn) => { try { fn(); n++; } catch (e) { console.error(`✗ ${nombre}`); throw e; } };

// ── promo.ts ──────────────────────────────────────────────────────────────
t('marca de la promo por texto', () => {
    assert.equal(marcaDePromo('Mi primer Varilux'), 'VARILUX');
    assert.equal(marcaDePromo('Kodak Precise'), 'KODAK');
    assert.equal(marcaDePromo('Hoya LifeStyle'), null);
    assert.equal(marcaDePromo(null), null);
});
t('webs y destinatarios', () => {
    assert.match(WEB_DE_PROMO.VARILUX, /variluxdobledisfrute/);
    assert.match(WEB_DE_PROMO.KODAK, /lenteskodak/);
    assert.deepEqual([...DESTINATARIOS_PROMO], ['promociones@optovisionsa.com.ar', 'cordoba@optovisionsa.com.ar']);
});
t('observación del 1º par exige cupón', () => {
    assert.equal(observacionPrimerPar('ABC123'), 'Primer par de Promo num cupón ABC123');
    assert.equal(observacionPrimerPar(' AB C123 '), 'Primer par de Promo num cupón ABC123');
    assert.equal(observacionPrimerPar(''), null);
    assert.equal(cuponLimpio(null), '');
});
t('observación del 2º par exige el nº del 1º', () => {
    assert.equal(observacionSegundoPar('623012'), 'Segundo par promo compañero/asociado al num 623012');
    assert.equal(observacionSegundoPar('SML-abc'), null);
});
t('asunto del mail', () => {
    assert.equal(asuntoDelMail('VERO02', '613534', '613524'), 'VERO02 613534-613524');
    assert.equal(asuntoDelMail('', '613534', '613524'), null);
});
t('pasos pendientes, en orden, y vacío solo con todo hecho', () => {
    assert.deepEqual(pasosPendientes({}), ['CUPON', 'OBSERVACION_PRIMER_PAR', 'OBSERVACION_SEGUNDO_PAR', 'MAIL']);
    assert.deepEqual(pasosPendientes({ cupon: 'X1', numeroPrimerPar: '623012' }), ['OBSERVACION_SEGUNDO_PAR', 'MAIL']);
    assert.deepEqual(pasosPendientes({ cupon: 'X1', numeroPrimerPar: '623012', numeroSegundoPar: '623013', mailEnviado: true }), []);
    // Mi Primer es de un solo par: con cupón y 1er par cargado no falta nada (el mail no se le exige hasta que Optovisión lo confirme).
    assert.deepEqual(pasosPendientes({ tipo: 'MI_PRIMER', cupon: 'X1', numeroPrimerPar: '623012' }), []);
    assert.deepEqual(pasosPendientes({ tipo: 'MI_PRIMER' }), ['CUPON', 'OBSERVACION_PRIMER_PAR']);
});

// ── llenar.ts (lo puro del robot) ─────────────────────────────────────────
t('un servicio se elige solo si el portal lo ofrece exactamente una vez', () => {
    const ofrecidos = [{ key: '|WR|EYST|TRAT|2', descripcion: 'Crizal Forte UV' }, { key: '|WR|EYST|TRAT|3', descripcion: 'Crizal Prevencia' }];
    assert.deepEqual(elegirServicio(ofrecidos, 'crizal forte uv '), { ok: true, key: '|WR|EYST|TRAT|2' });
    const falta = elegirServicio(ofrecidos, 'Crizal Sapphire');
    assert.equal(falta.ok, false); assert.match(falta.motivo, /ofrece: Crizal Forte UV \/ Crizal Prevencia/);
    const doble = elegirServicio([...ofrecidos, { key: 'x', descripcion: 'Crizal Forte UV' }], 'Crizal Forte UV');
    assert.equal(doble.ok, false); assert.match(doble.motivo, /no se elige "el primero"/);
});
t('el nº de la respuesta de Grabar nunca es "el primer 6 dígitos": se excluyen los conocidos y con varios no se afirma nada', () => {
    assert.equal(numeroDeLaRespuesta('<b>Pedido grabado. Nro de pedido: 628519</b>'), '628519');
    // La respuesta repite la observación del 2º par con el nº del 1º: ese no puede ser el nuevo.
    assert.equal(numeroDeLaRespuesta('Pedido 628519 grabado. Obs: Segundo par promo asociado al num 628377', ['628377']), '628519');
    assert.equal(numeroDeLaRespuesta('Segundo par promo asociado al num 628377', ['628377']), null);
    // Dos candidatos y ninguno presentado como "pedido": null (envío incierto, lo resuelve la búsqueda por referencia).
    assert.equal(numeroDeLaRespuesta('628519 y 628520'), null);
    assert.equal(numeroDeLaRespuesta('Nro de pedido: 628519. Vinculado a 628520'), '628519');
    assert.equal(numeroDeLaRespuesta(''), null);
});
t('las diferencias del formulario ignoran lo de transporte y normalizan espacios y mayúsculas', () => {
    assert.deepEqual(diferenciasDeFormulario({ esf_d: '-0.50', claseDePedido: 'RXTD', hLineaRX: 'x', paciente: 'Juan  Perez' }, { esf_d: '-0.50', claseDePedido: 'RXTT', hLineaRX: 'y', paciente: 'juan perez' }), []);
    assert.deepEqual(diferenciasDeFormulario({ esf_d: '-0.50' }, { esf_d: '-0.75' }), ['esf_d: se aprobó "-0.50" y hoy el formulario tiene "-0.75"']);
});
t('el texto de una falla al confirmar nunca invita a cargar a mano si el pedido puede existir', () => {
    assert.match(textoDeFallaDeConfirmacion({ motivo: 'se cortó', numeroCreado: '628519', envioIncierto: false, adopcionNoVerificada: false, nombrePortal: 'OVES' }), /YA está creado.*628519.*No lo cargues a mano/);
    assert.match(textoDeFallaDeConfirmacion({ motivo: 'timeout', envioIncierto: true, adopcionNoVerificada: false, nombrePortal: 'OVES' }), /sin respuesta.*No lo cargues a mano/);
    assert.match(textoDeFallaDeConfirmacion({ motivo: 'red', envioIncierto: false, adopcionNoVerificada: false, nombrePortal: 'OVES' }), /^No se pudo cargar en OVES: red\. Reintentar/);
    assert.equal(textoDeFallaDeConfirmacion({ motivo: 'el nº no aparece', envioIncierto: false, adopcionNoVerificada: true, nombrePortal: 'OVES' }), 'el nº no aparece.');
    assert.equal(decidirConAprobado({ pair: 1, numeroCreado: '628519', existente: null, envioIniciadoEl: null, esperaMs: 1 }).accion, 'ANOTAR');
    assert.match(mensajeExistente({ numero: '626134', ambiguo: true }, 1), /dejá en la venta solo el nº del par que ya está cargado/);
    assert.doesNotMatch(mensajeExistente({ numero: '626134', ambiguo: true }, 1), /Actualizar pedido|seguimiento/);
});

// ── oves-catalogo.ts (generado) ───────────────────────────────────────────
t('el catálogo generado tiene las 685 filas y el value se rearma', () => {
    assert.equal(OVES_CATALOGO.length, 685);
    const porClase = {}; for (const f of OVES_CATALOGO) porClase[f[0]] = (porClase[f[0]] || 0) + 1;
    assert.deepEqual(porClase, { RXTD: 622, RXTT: 42, RXSA: 21 });
    const eyezen = PRODUCTOS_OVES.find(p => p.label === 'Eyezen Start Orma Blue UV');
    assert.equal(eyezen.value, '|WR|EYST|Eyezen Start|Orma|MONOFOCAL|EYST|');
    assert.equal(valueDeOves({ cod: 'WS', linea: 'VXCO', marca: 'Varilux Comfort', material: 'Airwear 1.59', diseno: 'MULTIFOCAL' }), '|WS|VXCO|Varilux Comfort|Airwear 1.59|MULTIFOCAL|VXCO|');
    // Los espacios dobles del portal se respetan (la búsqueda exacta es literal).
    assert.ok(PRODUCTOS_OVES.some(p => p.label === 'Multilutz  Short Orma'));
});

// ── catalogo.ts ───────────────────────────────────────────────────────────
t('material, variante, tratamiento y color', () => {
    assert.equal(materialDe('Airwear 1.59'), 'AIRWEAR'); assert.equal(materialDe('Aiwear 1.59'), 'AIRWEAR'); assert.equal(materialDe('orma 1.5'), 'ORMA');
    assert.equal(materialDe('Stylis 1.67'), 'STYLIS'); assert.equal(materialDe('Policarbontao'), 'POLICARBONATO'); assert.equal(materialDe('Organico'), 'ORGANICO');
    assert.equal(varianteDe('varilux comfort - orma transitions gen s (colores)'), 'TRANSITIONS');
    assert.equal(varianteDe('varilux comfort - orma transitions xtractive'), 'XTRACTIVE');
    assert.equal(varianteDe('kodak sv digital - airwear 1.59 blue uv'), 'BLUE_UV');
    assert.equal(tratamientoDe('sygnus driver - orma + ar numax'), 'NUMAX');
    assert.equal(tratamientoDe('pro-line digital tdi · orma 1.50 — sin antirreflejo'), 'SIN');
    assert.equal(tratamientoDe('varilux comfort - orma + crizal 2x1'), 'CRIZAL');
    assert.equal(colorOvesDe('Café / Marrón'), 'Café'); assert.equal(colorOvesDe('Verde / Esmeralda'), 'Esmerald'); assert.equal(colorOvesDe('Verde grafito'), 'Gris-verde');
    assert.equal(colorOvesDe('Rubí (Rojo/Rosado)'), 'Ruby'); assert.equal(colorOvesDe('Zafiro (Azul)'), 'Zafiro'); assert.equal(colorOvesDe('Gris'), 'Gris'); assert.equal(colorOvesDe(null), null);
});
const label = (nombre, opts) => { const r = especificacionDe(nombre, opts); assert.ok(r.ok, `${nombre}: ${r.ok ? '' : r.motivo}`); return r.especificacion.producto.label; };
t('diseños de tallado digital: nombres reales de producción → producto de OVES', () => {
    assert.equal(label('VARILUX COMFORT - ORMA BLUE UV + CRIZAL 2x1'), 'Varilux Comfort Orma blue uv');
    assert.equal(label('VARILUX COMFORT MAX - AIRWEAR 1.59 BLUE UV + CRIZAL'), 'Varilux Comfort Max 3.0 Airwear 1.59 Blue UV');
    assert.equal(label('EYEZEN START - ORMA BLUE UV + CRIZAL 2x1'), 'Eyezen Start Orma Blue UV');
    assert.equal(label('EYEZEN START - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL 2x1', { color: 'Gris' }), 'Eyezen Start Airwear 1.59 Transitions GenS Gris');
    assert.equal(label('EYEZEN START - ORMA TRANSITIONS GEN S (colores) + CRIZAL 2x1', { color: 'Zafiro (Azul)' }), 'Eyezen Start Orma Transitions GenS Zafiro');
    assert.equal(label('KODAK SV DIGITAL - AIRWEAR 1.59 + CRIZAL'), 'Kodak SV Digital Airwear 1.59');
    assert.equal(label('KODAK SV DIGITAL - AIRWEAR 1.59 XPERIO + CRIZAL', { color: 'Gris' }), 'Kodak SV Digital  Airwear 1.59 Xperio Gris');
    // El CRM vende Kodak SV Digital Orma Xperio y OVES no lo lista: va a mano, diciendo qué ofrece.
    const sinXperio = especificacionDe('KODAK SV DIGITAL - ORMA XPERIO + CRIZAL', { color: 'Gris' });
    assert.equal(sinXperio.ok, false); assert.equal(sinXperio.aMano, true); assert.match(sinXperio.motivo, /no tiene RXTD KOSI ORMA con variante DS \(ofrece:/);
    assert.equal(label('KODAK UNIQUE DRO - ORMA ACCLIMATES + CRIZAL 2x1'), 'Kodak Unique Dro Acclimates');
    assert.equal(label('KODAK SOFTWEAR - STYLIS 1.67 + CRIZAL'), 'Kodak Softwear Stylis 1.67');
    assert.equal(label('MI PRIMER VARILUX PHYSIO 3.0 - ORMA BLUE UV + CRIZAL'), 'Varilux Physio 3.0 Orma Blue UV');
    assert.equal(label('VARILUX PHYSIO - ORMA TRANSITIONS XTRACTIVE + CRIZAL 2x1'), 'Varilux Physio Orma Transitions Xtractive Gris');
    assert.equal(label('VARILUX LIBERTY 3.0 - ORMA XPERIO + CRIZAL', { color: 'Verde grafito' }), 'Varilux Liberty 3.0 Orma Xperio Gris-Verde');
    assert.equal(label('VARILUX XR DESIGN - STYLIS 1.67 + CRIZAL 2x1'), 'Varilux XR Design Stylis 1.67 Blanco');
    assert.equal(label('VARILUX XR DESIGN - ORMA TRANSITIONS GEN S + CRIZAL 2x1', { color: 'Gris' }), 'Varilux XR Design Orma Transitions GenS Gris');
    assert.equal(label('ESSILOR NEW EDITIONS - Orma BLUE UV + AR NUMAX 2x1'), 'Sygnus New Edition Orma  Blue UV');
    assert.equal(label('SYGNUS MONOFOCAL ONE - Airwear 1.59 + AR NUMAX'), 'Sygnus ONE Airwear 1.59');
    assert.equal(label('ESSILOR NEW EDITIONS - Orgánico Fotosensible BLC + AR NUMAX 2x1'), 'Sygnus New Edition Orgánico Fotosensible BLC');
    assert.equal(label('ESSILOR NEW EDITIONS - Policarbonato Polarizado Espejado Azul/Plata + AR NUMAX 2x1'), 'Sygnus New Edition Policarbonato Polarizado Espejado Azul / Plata');
    assert.equal(label('SYGNUS DRIVER - Orma Xperio Gris + AR NUMAX'), 'Sygnus Driver Orma Xperio Gris');
    assert.equal(label('SYGNUS BIFOCAL - Stylis BLUE UV + AR NUMAX'), 'Sygnus Bifocal Stylis 1.67 Blue UV');
    assert.equal(label('PRO-LINE DIGITAL TDI · Orma Blue UV 1.50 — SIN ANTIRREFLEJO'), 'Pro-Line TDI Orma  Blue UV');
    assert.equal(label('ESPACE PLUS DIGITAL - ORMA ACCLIMATES + CRIZAL'), 'Espace Plus Digital Acclimates');
    assert.equal(label('MYOPILUX KIDS PLUS - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL', { color: 'Gris' }), 'Myopilux Plus Stylis 1.67 Transitions GenS Gris');
});
t('un diseño liso que OVES solo vende Blue UV se carga como Blue UV, el único que ofrece, y se avisa', () => {
    const r = especificacionDe('VARILUX COMFORT - ORMA + CRIZAL 2x1');
    assert.ok(r.ok); assert.equal(r.especificacion.producto.label, 'Varilux Comfort Orma blue uv'); assert.equal(r.especificacion.variante, 'BLUE_UV');
    assert.match(r.especificacion.avisos[0], /no tiene Varilux Comfort Orma liso: se carga "Varilux Comfort Orma blue uv"/);
    assert.equal(label('MI PRIMER VARILUX PHYSIO 3.0 - ORMA + CRIZAL'), 'Varilux Physio 3.0 Orma Blue UV');
    assert.equal(label('VARILUX COMFORT MAX - AIRWEAR 1.59 + CRIZAL 2x1'), 'Varilux Comfort Max 3.0 Airwear 1.59 Blue UV');
    // Un liso que SÍ existe no se toca: Kodak SV Digital Orma (cod 21).
    assert.equal(especificacionDe('KODAK SV DIGITAL - ORMA + CRIZAL').especificacion.avisos.length, 0);
    // Y sin Blue UV tampoco (Sygnus Driver viene liso): nada que avisar.
    assert.equal(especificacionDe('SYGNUS DRIVER - Orma + AR NUMAX').especificacion.producto.label, 'Sygnus Driver Orma');
    const k = especificacionDe('KODAK PRECISE - ORMA + CRIZAL 2x1', { eleccion: { corredorPrecise: 'LARGE' } });
    assert.ok(k.ok); assert.equal(k.especificacion.producto.label, 'Kodak Precise Next Large Orma');
});
t('las familias que exigen una elección la piden (potencia del Boost, corredor del Precise)', () => {
    const r = especificacionDe('EYEZEN BOOST - ORMA BLUE UV + CRIZAL 2x1');
    assert.equal(r.ok, false); assert.equal(r.eleccion?.clave, 'potenciaBoost');
    assert.equal(label('EYEZEN BOOST - ORMA BLUE UV + CRIZAL 2x1', { eleccion: { potenciaBoost: '0.6' } }), 'Eyezen Boost 0.6 Orma Blue UV');
    assert.equal(eleccionQuePide('KODAK PRECISE - STYLIS 1.67 + CRIZAL 2x1')?.clave, 'corredorPrecise');
    assert.equal(eleccionQuePide('KODAK UNIQUE DRO - ORMA + CRIZAL 2x1'), null);
});
t('un Transitions o Xperio sin color en la venta no se carga', () => {
    const r = especificacionDe('VARILUX COMFORT - ORMA TRANSITIONS GEN S + CRIZAL 2x1');
    assert.equal(r.ok, false); assert.match(r.motivo, /falta el color/); assert.equal(r.aMano, false);
});
t('laboratorio tradicional, stock y marca Optovisión → línea S/T por código', () => {
    assert.equal(label('BLUE UV FILTER SYSTEM - ORMA + CRIZAL 2x1'), 'Orma BLUE UV');
    assert.equal(label('BLUE UV FILTER SYSTEM - STYLIS 1.67 + CRIZAL 2x1'), 'Stylis 1.67 BLUE UV');
    assert.equal(label('MONOFOCAL DE LABORATORIO - STYLIS 1.67 + CRIZAL'), 'Stylis 1.67');
    assert.equal(label('TRANSITIONS GEN S - ORMA (tallado) + CRIZAL', { color: 'Café / Marrón' }), 'Orma Transitions Café');
    assert.equal(label('TRANSITIONS GEN S - ORMA (colores) — SIN ANTIRREFLEJO', { color: 'Amatista (Morado)' }), 'Orma Transitions Amatista');
    assert.equal(label('TRANSITIONS GEN S - ORMA (stock) — SIN ANTIRREFLEJO'), 'Monofocal Stock Transitions GenS Gris');
    assert.equal(label('XPERIO - ORMA + CRIZAL', { color: 'Gris' }), 'Orma Xperio Gris');
    assert.equal(label('INTERVIEW - AIRWEAR 1.59 + CRIZAL'), 'Interview Airwear 1.59');
    assert.equal(label('Monofocal de laboratorio · Cr 39 Blanco 1.50 · Diám. 52 a 70 — SIN ANTIRREFLEJO'), 'CR 39 Blanco');
    assert.equal(label('Monofocal de laboratorio · Alto Índice 1.74 + IRON — SIN ANTIRREFLEJO'), 'Alto Indice 1.74 + IRON');
    assert.equal(label('Monofocal de laboratorio · POLICAST Fotocromático 1.59 — SIN ANTIRREFLEJO'), 'POLICAST Foto');
    assert.equal(label('Bifocal Flat Top · Policarbonato LIFE RX Fotocromático 1.59 — SIN ANTIRREFLEJO'), 'FLAT TOP Policarbonato Life RX Fotocromático Película 28 mm');
    assert.equal(label('Bifocal Kriptock · Blanco 1.50 — SIN ANTIRREFLEJO'), 'KRIPTOCK Blanco Película 28 mm');
    assert.equal(label('PRO-LINE · Cr 39 Blanco BLC 1.60 · calibrado estándar — SIN ANTIRREFLEJO'), 'Pro-Line Cr 39 Blanco BLC');
    assert.equal(label('PRO-LINE · Cr 39 Blanco 1.50 · calibrado ranurado o perforado — SIN ANTIRREFLEJO'), 'Pro-Line Cr 39 Blanco');
    assert.equal(label('Stock Optovisión · BLC HMC 1.56 · Rango Extendido'), 'BLC HMC 1.56 Rango Extendido');
    assert.equal(label('Stock Optovisión · MULTICOT MAX 1.50'), 'MULTICOT MAX');
    assert.equal(label('Stock Optovisión · Policarbonato Blue Cut con NUMAX 1.59'), 'Policarbonato Blue Cut');
    assert.equal(label('MONOFOCAL DE STOCK - ORMA — SIN ANTIRREFLEJO'), 'Monofocal de Stock Orma');
    assert.equal(label('LENTE DE STOCK - ORMA BLUE UV CRIZAL SAPPHIRE HR (Crizal incluido) 2x1'), 'Orma bLUE uv Crizal Sapphire HR');
    const esp = especificacionDe('LENTE DE STOCK - ORMA BLUE UV CRIZAL SAPPHIRE HR (Crizal incluido) 2x1');
    assert.equal(esp.especificacion.tratamiento, 'INCLUIDO'); assert.equal(esp.especificacion.esPromo2x1, true);
});
t('lo que OVES no tiene se declara "a mano", con el motivo', () => {
    for (const nombre of ['Stellest - Control Miopia Airwear', 'Stock Optovisión · Antiage HD 1.60', 'Monofocal de laboratorio · Cr 39 Blue Light Cut 1.56 — SIN ANTIRREFLEJO', 'MONOFOCAL DE LABORATORIO - ORMA + CRIZAL', 'Stock Optovisión · NUMAX 1.50 · Rango Extendido', 'HD MR7 Asférico SHMC UV420 Blue Policarbonato', 'Un cristal que no existe - ORMA']) {
        const r = especificacionDe(nombre);
        assert.equal(r.ok, false, nombre); assert.equal(r.aMano, true, nombre); assert.ok(r.motivo.length > 10);
    }
});
t('elegir un producto nunca da "el primero": cero o varios candidatos se dicen', () => {
    const r = elegirProductoOves({ clase: 'RXTD', linea: 'VXCO', cod: 'ZZ', material: 'ORMA' });
    assert.equal(r.ok, false); assert.match(r.motivo, /ofrece:/);
    const ok = elegirProductoOves({ clase: 'RXTT', linea: 'S/T', cod: '16' });
    assert.ok(ok.ok); assert.equal(ok.producto.label, 'CR 39 Blanco');
    assert.equal(familiaDelNombre('MI PRIMER KODAK UNIQUE DRO - ORMA + CRIZAL'), 'Kodak Unique Dro');
    assert.equal(familiaDelNombre('VARILUX XR DESIGN - ORMA + CRIZAL 2x1'), 'Varilux XR Design');
});

// ── carga.ts ──────────────────────────────────────────────────────────────
const cristal = (nombre, eye, extra = {}) => ({ eye, framePosition: null, price: 100000, productNameSnapshot: nombre, productTypeSnapshot: 'Cristal Monofocal', productCategorySnapshot: 'Cristal', laboratorySnapshot: 'OPTOVISION', product: { name: nombre, category: 'Cristal', type: 'Cristal Monofocal', price: 100000, laboratory: 'OPTOVISION' }, sphereVal: null, cylinderVal: null, axisVal: null, additionVal: null, pdVal: null, heightVal: null, crystalColor: null, ...extra });
const ventaBase = () => ({
    id: 'ckx0000000000000000ab12', labStatus: 'SENT', labNotes: 'Solicito envien con paño', labCrizal: null, labFrameType: null, labDiameter: null, labEdgeInStore: false, labPrismOD: null, labPrismOI: null, appliedPromoName: null,
    userFrameBrand: 'Ray Ban', userFrameModel: '3548N', labFrameDetails: null,
    labPdOd: 34, labPdOi: 33, labHeightOD: 30, labHeightOI: 30,
    frames: [{ position: 1, shape: null, a: '57', b: '50', dbl: '21', edc: '57', details: null, heightOD: 30, heightOI: 30 }],
    client: { name: 'Juan San Martin' },
    prescription: { sphereOD: -0.5, cylinderOD: -1.5, axisOD: 90, sphereOI: -1, cylinderOI: -2, axisOI: 92, addition: null, additionOD: null, additionOI: null, pd: null, distanceOD: 34, distanceOI: 33, heightOD: 30, heightOI: 30 },
    items: [cristal('EYEZEN START - ORMA BLUE UV + CRIZAL 2x1', 'OD'), cristal('EYEZEN START - ORMA BLUE UV + CRIZAL 2x1', 'OI')],
});
t('un par simple se arma campo por campo como el pedido real 628517', () => {
    const r = planDeCarga(ventaBase(), 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11 });
    assert.ok(r.ok, r.ok ? '' : r.faltantes.join(' · '));
    const p = r.plan;
    assert.equal(p.clase, 'RXTD'); assert.equal(p.producto.label, 'Eyezen Start Orma Blue UV'); assert.equal(p.producto.value, '|WR|EYST|Eyezen Start|Orma|MONOFOCAL|EYST|');
    assert.equal(p.lentes, 'AO');
    assert.deepEqual(p.od, { esf: '-0.50', cil: '-1.50', eje: '90', adic: null, dnp: '34.0', altura: '30.0' });
    assert.deepEqual(p.oi, { esf: '-1.00', cil: '-2.00', eje: '92', adic: null, dnp: '33.0', altura: '30.0' });
    assert.deepEqual(p.servicios, { tratamiento: 'Crizal Forte UV', calibrado: 'Calibrado Comun', coloracion: 'sin color', otros: 'sin otros servicios' });
    assert.deepEqual(p.armazon, { forma: 11, tipo: '2', tipoEtiqueta: 'Metal', a: '57.0', b: '50.0', ed: '57.0', puente: '21.0', envia: 'Si', marca: 'Ray Ban 3548N' });
    assert.equal(p.pedinterno, '#AB12 Juan San Martin'); assert.equal(p.paciente, 'Juan San Martin');
    assert.equal(p.observacion, 'Solicito envien con paño');
    assert.equal(p.promo, null); assert.equal(p.rolPromo, null);
});
t('sin Crizal elegido, sin calibrado ni tipo de armazón, el plan dice qué falta (la venta no lo trae)', () => {
    const r = planDeCarga(ventaBase(), 1, {});
    assert.equal(r.ok, false);
    assert.ok(r.faltantes.some(f => /lleva Crizal: elegí cuál/.test(f)));
    assert.ok(r.faltantes.some(f => /^calibrado/.test(f)));
    assert.ok(r.faltantes.some(f => /^tipo de armazón/.test(f)));
    // Con labCrizal cargado en la venta, el Crizal ya no falta.
    const v = ventaBase(); v.labCrizal = 'CRIZAL_PREVENCIA';
    const r2 = planDeCarga(v, 1, { calibrado: 'COMUN', tipoArmazon: '1' });
    assert.ok(r2.ok); assert.equal(r2.plan.servicios.tratamiento, 'Crizal Prevencia');
});
t('un cristal que va a mano frena con aMano, y los prismas también frenan', () => {
    const v = ventaBase(); v.items = [cristal('Stellest - Control Miopia Airwear', 'OD'), cristal('Stellest - Control Miopia Airwear', 'OI')];
    const r = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2' });
    assert.equal(r.ok, false); assert.match(r.aMano, /Stellest/);
    const p = ventaBase(); p.labPrismOD = '1.00';
    const r2 = planDeCarga(p, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2' });
    assert.equal(r2.ok, false); assert.ok(r2.faltantes.some(f => /prismas/.test(f)));
});
t('un multifocal exige adición y la escribe como el select del portal', () => {
    const v = ventaBase();
    v.items = [cristal('VARILUX COMFORT - ORMA BLUE UV + CRIZAL 2x1', 'OD', { productTypeSnapshot: 'Cristal Multifocal' }), cristal('VARILUX COMFORT - ORMA BLUE UV + CRIZAL 2x1', 'OI', { productTypeSnapshot: 'Cristal Multifocal' })];
    const sinAdd = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2' });
    assert.equal(sinAdd.ok, false); assert.ok(sinAdd.faltantes.some(f => /adición/.test(f)));
    v.prescription.addition = 2;
    const r = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2' });
    assert.ok(r.ok, r.ok ? '' : r.faltantes.join(' · ')); assert.equal(r.plan.od.adic, '2.00'); assert.equal(r.plan.tipo, 'MULTIFOCAL');
});
const ventaDoble = () => {
    const v = ventaBase();
    v.frames.push({ position: 2, shape: null, a: '54', b: '44', dbl: '18', edc: '58', details: 'de sol', heightOD: 28, heightOI: 28 });
    const caro = 'VARILUX COMFORT - ORMA BLUE UV + CRIZAL 2x1', barato = 'VARILUX COMFORT - ORMA XPERIO + CRIZAL 2x1';
    v.items = [
        cristal(caro, 'OD', { framePosition: 1, productTypeSnapshot: 'Cristal Multifocal', price: 1404103, product: { name: caro, category: 'Cristal', type: 'Cristal Multifocal', price: 1404103, laboratory: 'OPTOVISION' } }),
        cristal(caro, 'OI', { framePosition: 1, productTypeSnapshot: 'Cristal Multifocal', price: 1404103, product: { name: caro, category: 'Cristal', type: 'Cristal Multifocal', price: 1404103, laboratory: 'OPTOVISION' } }),
        cristal(barato, 'OD', { framePosition: 2, productTypeSnapshot: 'Cristal Multifocal', price: 0, crystalColor: 'Gris', product: { name: barato, category: 'Cristal', type: 'Cristal Multifocal', price: 1924415, laboratory: 'OPTOVISION' } }),
        cristal(barato, 'OI', { framePosition: 2, productTypeSnapshot: 'Cristal Multifocal', price: 0, crystalColor: 'Gris', product: { name: barato, category: 'Cristal', type: 'Cristal Multifocal', price: 1924415, laboratory: 'OPTOVISION' } }),
    ];
    v.prescription.addition = 2.25;
    return v;
};
t('con dos pares y cristales sin armazón asignado no se frena: se reparten por orden y se avisa', () => {
    const v = ventaDoble();
    for (const i of v.items) i.framePosition = null;
    const r = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', pedidoOrigen: '628377' });
    assert.ok(r.ok, r.ok ? '' : r.faltantes.join(' · '));
    assert.ok(r.avisos.some(a => /armazón asignado.*dos primeros/.test(a)), JSON.stringify(r.avisos));
    assert.equal(r.plan.producto.label, 'Varilux Comfort Orma blue uv');
});
t('la referencia del listado coincide aunque el portal la recorte, y la consulta de un pedido se reconoce como nuestra', () => {
    assert.equal(referenciaCoincide('#AB12 Juan San Martin 2° par', '#AB12 Juan San Martin 2° par'), true);
    assert.equal(referenciaCoincide('#AB12 Juan San Mart', '#AB12 Juan San Martin 2° par'), true);
    assert.equal(referenciaCoincide('#AB12 Juan San Martin 1° par', '#AB12 Juan San Martin 2° par'), false);
    assert.equal(referenciaCoincide('', '#AB12'), false);
    // Una referencia corta del portal ("#AB12 Juan", carga a mano) no vale para un par en particular.
    assert.equal(referenciaCoincide('#AB12 Juan', '#AB12 Juan San Martin 2° par'), false);
    assert.equal(referenciaCoincide('#AB12 Juan', '#AB12 Juan San Martin'), true);
    const consulta = { pel_cod_estado: 'PR', pel_est_solanul: 'N', pel_fec_pedido: '17/10/2026 16:26:31', cliente: 'ATEL01 - PISSANO ISHTAR', producto: 'Eyezen Start Orma Blue UV', paciente: 'San Martin Juan', pedinterno: '#AB12 Juan San Martin 2° par' };
    assert.equal(pedidoConsultadoEsNuestro(consulta, { paciente: 'Juan San Martin', pedinterno: '#AB12 Juan San Martin 2° par' }).ok, true);
    // El nombre en otro orden también es el mismo paciente.
    assert.equal(pedidoConsultadoEsNuestro({ ...consulta, pedinterno: 'x' }, { paciente: 'Juan San Martin', pedinterno: '' }).ok, true);
    assert.equal(pedidoConsultadoEsNuestro({ ...consulta, pel_cod_estado: 'AN' }, { paciente: 'Juan San Martin', pedinterno: '' }).motivo, 'está ANULADO en el portal');
    assert.equal(pedidoConsultadoEsNuestro({ ...consulta, pel_est_solanul: 'S' }, { paciente: 'Juan San Martin', pedinterno: '' }).ok, false);
    const ajeno = pedidoConsultadoEsNuestro(consulta, { paciente: 'Otra Persona', pedinterno: '#ZZ99 Otra' });
    assert.equal(ajeno.ok, false); assert.equal(ajeno.vivo, true); assert.match(ajeno.motivo, /vivo/);
    // Un pedido anterior a la venta es otro pedido del mismo cliente.
    assert.match(pedidoConsultadoEsNuestro(consulta, { paciente: 'Juan San Martin', pedinterno: '', desde: new Date(2026, 9, 30) }).motivo, /anterior a esta venta/);
    assert.equal(pedidoConsultadoEsNuestro(consulta, { paciente: 'Juan San Martin', pedinterno: '', desde: new Date(2026, 9, 17, 10) }).ok, true);
    assert.equal(pedidoConsultadoEsNuestro(null, { paciente: 'x', pedinterno: 'y' }).ok, false);
    assert.equal(fechaDelPortal('17/10/2026 16:26:31').getDate(), 17); assert.equal(fechaDelPortal('nada'), null);
});
t('una promo que no cierra frena en vez de salir como pedido común sin cupón', () => {
    assert.equal(nombraPromoDoble('Doble Disfrute Varilux'), true); assert.equal(nombraPromoDoble('VARILUX COMFORT - ORMA + CRIZAL 2x1'), true); assert.equal(nombraPromoDoble('Kodak Unique'), false);
    const v = ventaDoble();
    const otra = 'KODAK UNIQUE DRO - ORMA + CRIZAL 2x1';
    v.items[2].product.name = otra; v.items[2].productNameSnapshot = otra; v.items[3].product.name = otra; v.items[3].productNameSnapshot = otra;
    assert.equal(esPromoDobleDeOptovision(v), false);
    assert.match(promoQueNoCierra(v), /familias distintas \(Varilux Comfort y Kodak Unique Dro\)/);
    const r = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2' });
    assert.equal(r.ok, false); assert.ok(r.faltantes.some(f => /familias distintas/.test(f)));
    // Sin "2x1" en los nombres pero con la promo aplicada "Doble Disfrute", sigue siendo promo.
    const d = ventaDoble(); for (const i of d.items) { i.product.name = i.product.name.replace(' 2x1', ''); i.productNameSnapshot = i.product.name; } d.appliedPromoName = 'Doble Disfrute Varilux';
    assert.equal(esPromoDobleDeOptovision(d), true); assert.equal(promoQueNoCierra(d), null);
});
t('promo doble: el par de mayor valor de lista va 1º (con el cupón), el otro 2º (con el nº del 1º)', () => {
    const v = ventaDoble();
    assert.equal(esPromoDobleDeOptovision(v), true);
    const roles = rolesDeLaPromo(v);
    // El Xperio (lista $1.924.415) vale más que el Blue UV ($1.404.103): aunque la venta lo deje en $0, es el 1º.
    assert.deepEqual([roles.conCargo, roles.sinCargo], [2, 1]);
    const sinCupon = planDeCarga(v, 2, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2' });
    assert.equal(sinCupon.ok, false); assert.ok(sinCupon.faltantes.some(f => /cupón/.test(f)));
    const primero = planDeCarga(v, 2, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', cupon: 'VA7AGQWN' });
    assert.ok(primero.ok, primero.ok ? '' : primero.faltantes.join(' · '));
    assert.equal(primero.plan.rolPromo, 'PRIMER_PAR'); assert.equal(primero.plan.producto.label, 'Varilux Comfort Orma Xperio Gris');
    assert.equal(primero.plan.pedinterno, '#AB12 Juan San Martin 2° par');
    assert.equal(primero.plan.observacion, 'Promo Doble Disfrute Varilux - Primer par de Promo num cupón VA7AGQWN. Solicito envien con paño');
    assert.deepEqual(primero.plan.od, { esf: '-0.50', cil: '-1.50', eje: '90', adic: '2.25', dnp: '34.0', altura: '28.0' });
    const segundoSinOrigen = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2' });
    assert.equal(segundoSinOrigen.ok, false); assert.ok(segundoSinOrigen.faltantes.some(f => /2º par de la promo/.test(f)));
    const segundo = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', pedidoOrigen: '628377' });
    assert.ok(segundo.ok, segundo.ok ? '' : segundo.faltantes.join(' · '));
    assert.equal(segundo.plan.rolPromo, 'SEGUNDO_PAR'); assert.equal(segundo.plan.pedidoOrigen, '628377');
    assert.match(segundo.plan.observacion, /^Promo Doble Disfrute Varilux - Segundo par promo compañero\/asociado al num 628377/);
    assert.equal(segundo.plan.pedinterno, '#AB12 Juan San Martin 1° par');
});
t('"Mi Primer" es promo con cupón de un solo par', () => {
    const v = ventaBase();
    v.items = [cristal('MI PRIMER KODAK PRECISE - ORMA + CRIZAL', 'OD', { productTypeSnapshot: 'Cristal Multifocal' }), cristal('MI PRIMER KODAK PRECISE - ORMA + CRIZAL', 'OI', { productTypeSnapshot: 'Cristal Multifocal' })];
    v.prescription.addition = 1.5;
    const r = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', corredorPrecise: 'LARGE', cupon: 'KOEUXPQC' });
    assert.ok(r.ok, r.ok ? '' : r.faltantes.join(' · '));
    assert.deepEqual(r.plan.promo, { tipo: 'MI_PRIMER', marca: 'KODAK' }); assert.equal(r.plan.rolPromo, 'PRIMER_PAR');
    assert.match(r.plan.observacion, /^Promo Mi Primer Kodak - Primer par de Promo num cupón KOEUXPQC/);
    assert.equal(r.plan.producto.label, 'Kodak Precise Next Large Orma');
});
t('el teñido va como coloración del formulario y el tono y grado en la observación', () => {
    const v = ventaBase();
    v.items.push({ eye: null, framePosition: null, price: 20000, productNameSnapshot: 'Teñido Compacto', productTypeSnapshot: 'Tratamiento Colores de Cristal', productCategorySnapshot: 'Tratamiento', laboratorySnapshot: 'OPTOVISION', product: { name: 'Teñido Compacto', category: 'Tratamiento', type: 'Tratamiento Colores de Cristal', price: 20000, laboratory: 'OPTOVISION' }, sphereVal: null, cylinderVal: null, axisVal: null, additionVal: null, pdVal: null, heightVal: null, crystalColor: 'Sepia', crystalColorType: 'COMPACTO', crystalColorNote: '3' });
    const r = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2' });
    assert.ok(r.ok, r.ok ? '' : r.faltantes.join(' · '));
    assert.equal(r.plan.servicios.coloracion, 'color pleno');
    assert.equal(r.plan.observacion, 'Coloracion Sepia 3. Solicito envien con paño');
});
t('referencia, huella y diferencias', () => {
    assert.equal(referenciaDelPedido('ckx0000000000000000ab12', 'Juan San Martin', 1, 1), '#AB12 Juan San Martin');
    assert.equal(referenciaDelPedido('ckx0000000000000000ab12', 'María de los Ángeles Fernández Gutiérrez', 2, 2).length <= 30, true);
    assert.match(referenciaDelPedido('ckx0000000000000000ab12', 'María de los Ángeles Fernández Gutiérrez', 2, 2), /^#AB12 .* 2° par$/);
    const a = planDeCarga(ventaBase(), 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2' }).plan;
    const v = ventaBase(); v.prescription.sphereOD = -0.75;
    const b = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2' }).plan;
    assert.notEqual(huellaDelPlan(a), huellaDelPlan(b)); assert.deepEqual(diferenciasDePlan(a, b), ['OD']);
    assert.deepEqual(diferenciasDePlan(a, a), []);
    assert.equal(cristalesPorPar(ventaDoble()).size, 2);
    assert.equal(observacionDelPedido({ promo: null, rolPromo: null, cupon: null, pedidoOrigen: null, familia: 'x', tenido: null, notas: null }), '');
});

console.log(`check:carga-optovision OK (${n} grupos)`);

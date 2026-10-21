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
import { marcaDePromo, WEB_DE_PROMO, DESTINATARIOS_PROMO, MAIL_PROMO_PARA, MAIL_PROMO_COPIA, providerDePromo, nombreDePromo, PATRON_CUPON, MARCA_CUPON_PENDIENTE, observacionPrimerParPendiente, conCuponReal, cuponLimpio, observacionPrimerPar, observacionSegundoPar, asuntoDelMail, pasosPendientes } from '../../src/services/lab-modules/optovision/promo.ts';
import { rasgosDeProductoWeb, rasgosDelCristalCRM, elegirLineaWeb, elegirProductoWeb, segundoAdmitido, recetaWebDe, repartirNombre, clienteWebDe, pedidoDeCupon, pedidoDeLaPagina, filasDelCliente, esCuponDelCliente, cuponReutilizable, esProviderMiPrimer, DIAS_CUPON_VIGENTE, planConCupon, formularioConCupon, fechaDelHistorial, ordenDeBusqueda, MAX_DETALLES_HISTORIAL, avisoDeCuponDistinto, telefonoParaLaWeb } from '../../src/services/lab-modules/optovision/cupon-web.ts';
import { credencialesPromo, CredencialPromoFaltanteError } from '../../src/services/lab-modules/optovision/cupon-robot.ts';
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
t('webs y destinatarios: PARA promociones@, COPIA a cordoba@ y al local (instructivo + Ishtar, 20/10/2026)', () => {
    assert.match(WEB_DE_PROMO.VARILUX, /variluxdobledisfrute/);
    assert.match(WEB_DE_PROMO.KODAK, /lenteskodak/);
    assert.equal(MAIL_PROMO_PARA, 'promociones@optovisionsa.com.ar');
    assert.deepEqual([...MAIL_PROMO_COPIA], ['cordoba@optovisionsa.com.ar', 'atelier.optica.cerro@gmail.com']);
    assert.deepEqual([...DESTINATARIOS_PROMO], [MAIL_PROMO_PARA, ...MAIL_PROMO_COPIA]);
    assert.equal(providerDePromo('VARILUX', 'DOBLE'), 'varilux'); assert.equal(providerDePromo('VARILUX', 'MI_PRIMER'), 'mi-primer-varilux');
    assert.equal(providerDePromo('KODAK', 'DOBLE'), 'kodak'); assert.equal(providerDePromo('KODAK', 'MI_PRIMER'), 'kodak-progresivos'); assert.equal(providerDePromo(null, 'DOBLE'), null);
    assert.equal(nombreDePromo('KODAK', 'MI_PRIMER'), 'Mi Primer Kodak'); assert.equal(nombreDePromo('VARILUX', 'DOBLE'), 'Doble Disfrute Varilux'); assert.equal(nombreDePromo('KODAK', 'DOBLE'), '2x1 Kodak');
});
t('la marca del cupón pendiente no parece un cupón y se reemplaza entera por el real', () => {
    assert.equal(PATRON_CUPON.test(MARCA_CUPON_PENDIENTE), false);
    assert.equal(observacionPrimerParPendiente(), `Primer par de Promo num cupón ${MARCA_CUPON_PENDIENTE}`);
    assert.equal(conCuponReal(`Promo X - ${observacionPrimerParPendiente()}. Nota`, 'VA7AGQWN'), 'Promo X - Primer par de Promo num cupón VA7AGQWN. Nota');
    assert.equal(conCuponReal('sin marca', 'VA7AGQWN'), 'sin marca');
    assert.equal(conCuponReal(observacionPrimerParPendiente(), ''), observacionPrimerParPendiente());
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
    // Mi Primer es de un solo par pero lleva la misma modalidad (Optovisión, 20/10/2026): cupón, observación del par y mail.
    assert.deepEqual(pasosPendientes({ tipo: 'MI_PRIMER', cupon: 'X1', numeroPrimerPar: '623012' }), ['MAIL']);
    assert.deepEqual(pasosPendientes({ tipo: 'MI_PRIMER', cupon: 'X1', numeroPrimerPar: '623012', mailEnviado: true }), []);
    assert.deepEqual(pasosPendientes({ tipo: 'MI_PRIMER' }), ['CUPON', 'OBSERVACION_PRIMER_PAR', 'MAIL']);
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
    const r2 = planDeCarga(v, 1, { calibrado: 'COMUN', tipoArmazon: '1', forma: 11 });
    assert.ok(r2.ok); assert.equal(r2.plan.servicios.tratamiento, 'Crizal Prevencia');
});
t('un cristal que va a mano frena con aMano, y los prismas también frenan', () => {
    const v = ventaBase(); v.items = [cristal('Stellest - Control Miopia Airwear', 'OD'), cristal('Stellest - Control Miopia Airwear', 'OI')];
    const r = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11 });
    assert.equal(r.ok, false); assert.match(r.aMano, /Stellest/);
    const p = ventaBase(); p.labPrismOD = '1.00';
    const r2 = planDeCarga(p, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11 });
    assert.equal(r2.ok, false); assert.ok(r2.faltantes.some(f => /prismas/.test(f)));
});
t('un multifocal exige adición y la escribe como el select del portal', () => {
    const v = ventaBase();
    v.items = [cristal('VARILUX COMFORT - ORMA BLUE UV + CRIZAL 2x1', 'OD', { productTypeSnapshot: 'Cristal Multifocal' }), cristal('VARILUX COMFORT - ORMA BLUE UV + CRIZAL 2x1', 'OI', { productTypeSnapshot: 'Cristal Multifocal' })];
    const sinAdd = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11 });
    assert.equal(sinAdd.ok, false); assert.ok(sinAdd.faltantes.some(f => /adición/.test(f)));
    v.prescription.addition = 2;
    const r = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11 });
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
    const r = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11, pedidoOrigen: '628377' });
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
    assert.equal(referenciaCoincide('#AB12 Juan San Martin 1er par', '#AB12 Juan San Martin 2° par'), false);
    assert.equal(referenciaCoincide('#AB12 Juan San Martin 2do par', '#AB12 Juan San Martin 2° par'), true);
    const consulta = { pel_cod_estado: 'EM', pel_est_solanul: 'N', pel_fec_pedido: '17/10/2026 16:26:31', cliente: 'ATEL01 - PISSANO ISHTAR', producto: 'Eyezen Start Orma Blue UV', pel_des_usuarionombre: 'San Martin Juan', pel_des_pedinterno: '#AB12 Juan San Martin 2° par' };
    assert.equal(pedidoConsultadoEsNuestro(consulta, { paciente: 'Juan San Martin', pedinterno: '#AB12 Juan San Martin 2° par' }).ok, true);
    // El nombre en otro orden también es el mismo paciente.
    assert.equal(pedidoConsultadoEsNuestro({ ...consulta, pel_des_pedinterno: 'x' }, { paciente: 'Juan San Martin', pedinterno: '' }).ok, true);
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
    const r = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11 });
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
    const sinCupon = planDeCarga(v, 2, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11 });
    assert.equal(sinCupon.ok, false); assert.ok(sinCupon.faltantes.some(f => /cupón/.test(f)));
    const primero = planDeCarga(v, 2, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11, cupon: 'VA7AGQWN' });
    assert.ok(primero.ok, primero.ok ? '' : primero.faltantes.join(' · '));
    assert.equal(primero.plan.rolPromo, 'PRIMER_PAR'); assert.equal(primero.plan.producto.label, 'Varilux Comfort Orma Xperio Gris');
    assert.equal(primero.plan.pedinterno, '#AB12 Juan San Martin 2° par');
    assert.equal(primero.plan.observacion, 'Promo Doble Disfrute Varilux - Primer par de Promo num cupón VA7AGQWN. Solicito envien con paño');
    assert.deepEqual(primero.plan.od, { esf: '-0.50', cil: '-1.50', eje: '90', adic: '2.25', dnp: '34.0', altura: '28.0' });
    const segundoSinOrigen = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11 });
    assert.equal(segundoSinOrigen.ok, false); assert.ok(segundoSinOrigen.faltantes.some(f => /2º par de la promo/.test(f)));
    const segundo = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11, pedidoOrigen: '628377' });
    assert.ok(segundo.ok, segundo.ok ? '' : segundo.faltantes.join(' · '));
    assert.equal(segundo.plan.rolPromo, 'SEGUNDO_PAR'); assert.equal(segundo.plan.pedidoOrigen, '628377');
    assert.match(segundo.plan.observacion, /^Promo Doble Disfrute Varilux - Segundo par promo compañero\/asociado al num 628377/);
    assert.equal(segundo.plan.pedinterno, '#AB12 Juan San Martin 1° par');
});
t('"Mi Primer" es promo con cupón de un solo par', () => {
    const v = ventaBase();
    v.items = [cristal('MI PRIMER KODAK PRECISE - ORMA + CRIZAL', 'OD', { productTypeSnapshot: 'Cristal Multifocal' }), cristal('MI PRIMER KODAK PRECISE - ORMA + CRIZAL', 'OI', { productTypeSnapshot: 'Cristal Multifocal' })];
    v.prescription.addition = 1.5;
    const r = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11, corredorPrecise: 'LARGE', cupon: 'KOEUXPQC' });
    assert.ok(r.ok, r.ok ? '' : r.faltantes.join(' · '));
    assert.deepEqual(r.plan.promo, { tipo: 'MI_PRIMER', marca: 'KODAK' }); assert.equal(r.plan.rolPromo, 'PRIMER_PAR');
    assert.match(r.plan.observacion, /^Promo Mi Primer Kodak - Primer par de Promo num cupón KOEUXPQC/);
    assert.equal(r.plan.producto.label, 'Kodak Precise Next Large Orma');
});
t('el teñido va como coloración del formulario y el tono y grado en la observación', () => {
    const v = ventaBase();
    v.items.push({ eye: null, framePosition: null, price: 20000, productNameSnapshot: 'Teñido Compacto', productTypeSnapshot: 'Tratamiento Colores de Cristal', productCategorySnapshot: 'Tratamiento', laboratorySnapshot: 'OPTOVISION', product: { name: 'Teñido Compacto', category: 'Tratamiento', type: 'Tratamiento Colores de Cristal', price: 20000, laboratory: 'OPTOVISION' }, sphereVal: null, cylinderVal: null, axisVal: null, additionVal: null, pdVal: null, heightVal: null, crystalColor: 'Sepia', crystalColorType: 'COMPACTO', crystalColorNote: '3' });
    const r = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11 });
    assert.ok(r.ok, r.ok ? '' : r.faltantes.join(' · '));
    assert.equal(r.plan.servicios.coloracion, 'color pleno');
    assert.equal(r.plan.observacion, 'Coloracion Sepia 3. Solicito envien con paño');
});
t('referencia, huella y diferencias', () => {
    assert.equal(referenciaDelPedido('ckx0000000000000000ab12', 'Juan San Martin', 1, 1), '#AB12 Juan San Martin');
    assert.equal(referenciaDelPedido('ckx0000000000000000ab12', 'María de los Ángeles Fernández Gutiérrez', 2, 2).length <= 30, true);
    assert.match(referenciaDelPedido('ckx0000000000000000ab12', 'María de los Ángeles Fernández Gutiérrez', 2, 2), /^#AB12 .* 2° par$/);
    const a = planDeCarga(ventaBase(), 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11 }).plan;
    const v = ventaBase(); v.prescription.sphereOD = -0.75;
    const b = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11 }).plan;
    assert.notEqual(huellaDelPlan(a), huellaDelPlan(b)); assert.deepEqual(diferenciasDePlan(a, b), ['OD']);
    assert.deepEqual(diferenciasDePlan(a, a), []);
    assert.equal(cristalesPorPar(ventaDoble()).size, 2);
    assert.equal(observacionDelPedido({ promo: null, rolPromo: null, cupon: null, pedidoOrigen: null, familia: 'x', tenido: null, notas: null }), '');
});

// ── cupon-web.ts: el cupón que genera el robot en la web de la promo ──────
// Nombres REALES del catálogo del sitio (20/10/2026, docs/promos-optovision-web.md), dobles espacios incluidos.
const LINEAS_VDD = [[3, 'Varilux Xr Pro'], [4, 'Varilux Xr Design'], [5, 'Varilux Physio 3.0'], [6, 'Varilux Physio'], [11, 'Varilux Comfort Max'], [8, 'Varilux Comfort'], [9, 'Varilux Liberty 3.0'], [10, 'Varilux Liberty']].map(([id, name]) => ({ id, name, enabled: 1 }));
const LINEAS_MPV = [[12, 'Varilux Xr Pro'], [14, 'Varilux Physio 3.0'], [15, 'Varilux Physio']].map(([id, name]) => ({ id, name, enabled: 1 }));
const LINEAS_KODAK = [[1, 'Kodak Unique Dro'], [2, 'Kodak Precise Next']].map(([id, name]) => ({ id, name, enabled: 1 }));
const COMFORT = [
    [1376, 15976, 'Varilux Comfort Orma Transitions Gens Gris / Café / Gris Verde /zafiro / Amatista / Esmeralda / Ambar / Rubi Con Crizal Prevencia'],
    [1377, 15976, 'Varilux Comfort Orma Transitions Xtractive Gris Con Crizal Prevencia'],
    [1378, 15976, 'Varilux Comfort Orma Xperio Gris / Café / Gris-verde Con Crizal Prevencia'],
    [1384, 15774, 'Varilux Comfort Orma Xperio Gris / Café / Gris-verde Con Crizal Forte Uv'],
    [1385, 13229, 'Varilux Comfort Stylis 1.67 Blueuv Con Crizal Prevencia'],
    [1391, 11339, 'Varilux Comfort Orma Blue Uv Con Crizal Prevencia'],
    [1392, 11238, 'Varilux Comfort Orma Blue Uv Con Crizal Sapphire'],
    [1393, 11137, 'Varilux Comfort Orma Blue Uv Con Crizal Forte Uv'],
].map(([id, order, name]) => ({ id, order, name, enabled: 1 }));
t('los rasgos de un producto del sitio salen del nombre, con dobles espacios, "Blueuv" y "Gen S"', () => {
    assert.deepEqual(rasgosDeProductoWeb(COMFORT[0].name), { material: 'ORMA', tecnologia: 'TRANSITIONS', tratamiento: 'PREVENCIA' });
    assert.deepEqual(rasgosDeProductoWeb('Varilux Comfort Stylis 1.67 Blueuv Con Crizal Prevencia'), { material: 'STYLIS', tecnologia: 'BLUE_UV', tratamiento: 'PREVENCIA' });
    assert.deepEqual(rasgosDeProductoWeb('Kodak Unique Dro Airwear 1.59  Crizal Sapphire'), { material: 'AIRWEAR', tecnologia: 'LISO', tratamiento: 'SAPPHIRE' });
    assert.deepEqual(rasgosDeProductoWeb('Kodak Precise Next Orma Xperio Trio Easy Clean Uv'), { material: 'ORMA', tecnologia: 'XPERIO', tratamiento: 'TRIO' });
    assert.deepEqual(rasgosDeProductoWeb('Orma Transitions Gens Crizal Prevencia'), { material: 'ORMA', tecnologia: 'TRANSITIONS', tratamiento: 'PREVENCIA' });
    assert.deepEqual(rasgosDeProductoWeb('Varilux Liberty Orma Transitions Gen S Gris / Café Con Crizal Forte Uv'), { material: 'ORMA', tecnologia: 'TRANSITIONS', tratamiento: 'FORTE_UV' });
    assert.deepEqual(rasgosDeProductoWeb('Varilux Xr Pro Airwear Xperio Gris / Marrón Con Crizal Prevencia'), { material: 'AIRWEAR', tecnologia: 'XPERIO', tratamiento: 'PREVENCIA' });
});
t('los rasgos del cristal vendido: liso de Varilux → Blue UV con aviso; Kodak liso existe; Acclimates y sin Crizal frenan', () => {
    const liso = rasgosDelCristalCRM('VARILUX COMFORT - ORMA + CRIZAL 2x1', 'CRIZAL_FORTE_UV', 'VARILUX');
    assert.ok(liso.ok); assert.deepEqual(liso.rasgos, { material: 'ORMA', tecnologia: 'BLUE_UV', tratamiento: 'FORTE_UV' }); assert.match(liso.avisos[0], /Blue UV/);
    const kodak = rasgosDelCristalCRM('KODAK UNIQUE DRO - ORMA + CRIZAL 2x1', 'CRIZAL_PREVENCIA', 'KODAK');
    assert.ok(kodak.ok); assert.equal(kodak.rasgos.tecnologia, 'LISO'); assert.deepEqual(kodak.avisos, []);
    assert.deepEqual(rasgosDelCristalCRM('VARILUX COMFORT - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL 2x1', 'CRIZAL_SAPPHIRE', 'VARILUX').rasgos, { material: 'STYLIS', tecnologia: 'TRANSITIONS', tratamiento: 'SAPPHIRE' });
    assert.match(rasgosDelCristalCRM('KODAK UNIQUE DRO - ORMA ACCLIMATES + CRIZAL 2x1', 'CRIZAL_PREVENCIA', 'KODAK').motivo, /Acclimates/);
    assert.match(rasgosDelCristalCRM('VARILUX COMFORT - ORMA + CRIZAL 2x1', null, 'VARILUX').motivo, /exige un Crizal/);
    assert.match(rasgosDelCristalCRM('VARILUX COMFORT - ORMA + CRIZAL 2x1', 'NUMAX', 'VARILUX').motivo, /exige un Crizal/);
});
t('la línea del sitio se elige por nombre, exacta antes que por prefijo, y nunca entre varias', () => {
    assert.equal(elegirLineaWeb(LINEAS_VDD, 'VARILUX COMFORT MAX - ORMA TRANSITIONS GEN S + CRIZAL 2x1').linea.id, 11);
    assert.equal(elegirLineaWeb(LINEAS_VDD, 'VARILUX COMFORT - ORMA + CRIZAL 2x1').linea.id, 8);
    assert.equal(elegirLineaWeb(LINEAS_VDD, 'VARILUX PHYSIO - ORMA + CRIZAL 2x1').linea.id, 6);
    assert.equal(elegirLineaWeb(LINEAS_VDD, 'VARILUX PHYSIO 3.0 - ORMA + CRIZAL 2x1').linea.id, 5);
    assert.equal(elegirLineaWeb(LINEAS_MPV, 'MI PRIMER VARILUX PHYSIO 3.0 - ORMA + CRIZAL').linea.id, 14);
    assert.equal(elegirLineaWeb(LINEAS_KODAK, 'KODAK PRECISE - ORMA + CRIZAL 2x1').linea.id, 2);
    assert.equal(elegirLineaWeb(LINEAS_KODAK, 'MI PRIMER KODAK UNIQUE DRO - STYLIS 1.67 + CRIZAL').linea.id, 1);
    assert.match(elegirLineaWeb(LINEAS_VDD, 'VARILUX DIGITIME - ORMA + CRIZAL').motivo, /no tiene la línea/);
    assert.match(elegirLineaWeb([...LINEAS_KODAK, { id: 9, name: 'Kodak Precise Short', enabled: 1 }], 'KODAK PRECISE - ORMA + CRIZAL 2x1').motivo, /2 líneas/);
    assert.match(elegirLineaWeb(LINEAS_KODAK.map(l => ({ ...l, enabled: 0 })), 'KODAK PRECISE - ORMA + CRIZAL 2x1').motivo, /no tiene la línea/);
});
t('el producto del sitio se elige por rasgos exactos: uno solo', () => {
    assert.equal(elegirProductoWeb(COMFORT, { material: 'ORMA', tecnologia: 'BLUE_UV', tratamiento: 'PREVENCIA' }).producto.id, 1391);
    assert.equal(elegirProductoWeb(COMFORT, { material: 'ORMA', tecnologia: 'TRANSITIONS', tratamiento: 'PREVENCIA' }).producto.id, 1376);
    assert.equal(elegirProductoWeb(COMFORT, { material: 'ORMA', tecnologia: 'XTRACTIVE', tratamiento: 'PREVENCIA' }).producto.id, 1377);
    assert.equal(elegirProductoWeb(COMFORT, { material: 'STYLIS', tecnologia: 'BLUE_UV', tratamiento: 'PREVENCIA' }).producto.id, 1385);
    assert.match(elegirProductoWeb(COMFORT, { material: 'AIRWEAR', tecnologia: 'BLUE_UV', tratamiento: 'PREVENCIA' }).motivo, /no tiene un producto AIRWEAR BLUE UV PREVENCIA/);
    assert.match(elegirProductoWeb([...COMFORT, { ...COMFORT[5], id: 9999 }], { material: 'ORMA', tecnologia: 'BLUE_UV', tratamiento: 'PREVENCIA' }).motivo, /2 productos/);
    // El 2º par tiene que valer igual o menos que el 1º según el orden del sitio.
    assert.equal(segundoAdmitido(COMFORT[5], COMFORT[7]), true); assert.equal(segundoAdmitido(COMFORT[5], COMFORT[5]), true); assert.equal(segundoAdmitido(COMFORT[7], COMFORT[5]), false);
});
t('la receta del sitio: sin "+", cilindro 0.00 si no hay, eje vacío sin cilindro, DNP entera de 2 dígitos, adición obligatoria', () => {
    assert.deepEqual(recetaWebDe({ esf: '+2.00', cil: '-0.75', eje: '90', adic: '2.25', dnp: '34.0', altura: '30.0' }, 'OD').receta, { esferico: '2.00', cilindrico: '-0.75', eje: '90', adicion: '2.25', dnp: '34' });
    assert.deepEqual(recetaWebDe({ esf: '-1.00', cil: null, eje: null, adic: '1.00', dnp: '32.5', altura: null }, 'OI').receta, { esferico: '-1.00', cilindrico: '0.00', eje: '', adicion: '1.00', dnp: '33' });
    assert.match(recetaWebDe({ esf: '-1.00', cil: null, eje: null, adic: null, dnp: '32.0', altura: null }, 'OI').faltantes[0], /adición OI/);
    assert.match(recetaWebDe({ esf: '-1.00', cil: null, eje: null, adic: '2.00', dnp: '45.0', altura: null }, 'OD').faltantes[0], /DNP OD .*fuera/);
    assert.match(recetaWebDe({ esf: '-1.00', cil: null, eje: null, adic: '4.00', dnp: '32.0', altura: null }, 'OD').faltantes[0], /adición OD .*fuera/);
    assert.match(recetaWebDe(null, 'OI').faltantes[0], /receta del OI/);
});
t('el cliente del sitio sale de la ficha; el género lo pone quien prepara', () => {
    assert.deepEqual(repartirNombre('Juan San Martin'), { nombre: 'Juan', apellido: 'San Martin' });
    assert.deepEqual(repartirNombre('ana perez'), { nombre: 'Ana', apellido: 'Perez' });
    assert.deepEqual(repartirNombre('Ana'), { nombre: 'Ana', apellido: 'Ana' });
    const c = clienteWebDe({ name: 'Patricia Devereux', dni: '12.345.678', birthDate: '1963-05-11T00:00:00.000Z', phone: '351 762-2560', email: 'p@x.com' }, 'f');
    assert.ok(c.ok, c.ok ? '' : c.faltantes.join(' · '));
    assert.equal(c.cliente.dni, '12345678'); assert.equal(c.cliente.genero, 'F'); assert.equal(c.cliente.telefono, '3517622560'); assert.equal(c.cliente.email, 'p@x.com');
    assert.deepEqual(c.cliente.nacimiento, { iso: '1963-05-11', dia: 11, mes0: 4, anio: 1963 });
    const sin = clienteWebDe({ name: 'Patricia Devereux', dni: null, birthDate: null, phone: null, email: 'no-es-mail' }, null);
    assert.equal(sin.ok, false);
    assert.ok(sin.faltantes.some(f => /DNI/.test(f)) && sin.faltantes.some(f => /género/.test(f)) && sin.faltantes.some(f => /nacimiento/.test(f)), sin.faltantes.join(' · '));
    const largo = clienteWebDe({ name: 'Elizabeth Del Valle Marquez', dni: '1234567', birthDate: new Date('1970-01-02T00:00:00.000Z'), phone: null, email: null }, 'F');
    assert.ok(largo.ok); assert.equal(largo.cliente.apellido, 'Del Valle Marquez'); assert.match(largo.avisos[0], /se repartió/); assert.equal(largo.cliente.email, null);
});
t('sin cupón tipeado el plan sale con la marca y el robot lo genera; con el real da EXACTAMENTE el plan tipeado', () => {
    const v = ventaDoble();
    v.client = { name: 'Juan San Martin', dni: '30111222', birthDate: '1980-03-15T00:00:00.000Z', phone: '3511234567', email: 'juan@x.com' };
    const auto = planDeCarga(v, 2, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11, cuponAutomatico: true, genero: 'M' });
    assert.ok(auto.ok, auto.ok ? '' : auto.faltantes.join(' · '));
    assert.equal(auto.plan.cupon, null); assert.equal(auto.plan.cuponAutomatico, true);
    assert.equal(auto.plan.observacion, `Promo Doble Disfrute Varilux - Primer par de Promo num cupón ${MARCA_CUPON_PENDIENTE}. Solicito envien con paño`);
    const real = planDeCarga(v, 2, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11, cuponAutomatico: true, genero: 'M', cupon: 'VA7AGQWN' });
    assert.ok(real.ok); assert.equal(real.plan.cuponAutomatico, false); assert.equal(real.plan.cupon, 'VA7AGQWN');
    const esperado = planConCupon(auto.plan, 'VA7AGQWN');
    assert.deepEqual(diferenciasDePlan(esperado, real.plan), []); assert.equal(huellaDelPlan(esperado), huellaDelPlan(real.plan));
    assert.deepEqual(diferenciasDePlan(auto.plan, real.plan), ['observación', 'promo']);
    assert.equal(planConCupon(real.plan, 'OTRO').cupon, 'VA7AGQWN');
    assert.deepEqual(formularioConCupon({ observacion: auto.plan.observacion, paciente: 'Juan' }, 'VA7AGQWN'), { observacion: real.plan.observacion, paciente: 'Juan' });
    // El 2º par no pide cupón aunque se lo marque automático.
    const segundo = planDeCarga(v, 1, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11, cuponAutomatico: true, pedidoOrigen: '628377' });
    assert.ok(segundo.ok); assert.equal(segundo.plan.cuponAutomatico, false);
    // Lo que se le pide al sitio: provider, cliente, receta del 1er par y los dos cristales.
    const p = pedidoDeCupon({ venta: v, plan: auto.plan, productoCRMSegundo: 'VARILUX COMFORT - ORMA BLUE UV + CRIZAL 2x1', genero: 'M' });
    assert.ok(p.ok, p.ok ? '' : p.faltantes.join(' · '));
    assert.equal(p.pedido.provider, 'varilux'); assert.equal(p.pedido.cliente.dni, '30111222');
    assert.deepEqual(p.pedido.receta.od, { esferico: '-0.50', cilindrico: '-1.50', eje: '90', adicion: '2.25', dnp: '34' });
    assert.deepEqual(p.pedido.primero.rasgos, { material: 'ORMA', tecnologia: 'XPERIO', tratamiento: 'FORTE_UV' });
    assert.deepEqual(p.pedido.segundo.rasgos, { material: 'ORMA', tecnologia: 'BLUE_UV', tratamiento: 'FORTE_UV' });
    assert.ok(p.avisos.some(a => /mismo Crizal/.test(a)));
    assert.match(pedidoDeCupon({ venta: v, plan: auto.plan, productoCRMSegundo: 'VARILUX PHYSIO - ORMA + CRIZAL 2x1', genero: 'M' }).faltantes.join(' '), /mismo diseño/);
    assert.match(pedidoDeCupon({ venta: v, plan: auto.plan, productoCRMSegundo: null, genero: 'M' }).faltantes.join(' '), /2º par/);
    assert.match(pedidoDeCupon({ venta: v, plan: auto.plan, productoCRMSegundo: 'VARILUX COMFORT - ORMA BLUE UV + CRIZAL 2x1', genero: null }).faltantes.join(' '), /género/);
    // Mi Primer: un solo cristal, provider propio.
    const mp = ventaBase(); mp.client = v.client; mp.prescription.addition = 1.5;
    mp.items = [cristal('MI PRIMER KODAK PRECISE - ORMA + CRIZAL', 'OD', { productTypeSnapshot: 'Cristal Multifocal' }), cristal('MI PRIMER KODAK PRECISE - ORMA + CRIZAL', 'OI', { productTypeSnapshot: 'Cristal Multifocal' })];
    const planMp = planDeCarga(mp, 1, { tratamiento: 'CRIZAL_PREVENCIA', calibrado: 'COMUN', tipoArmazon: '2', forma: 11, corredorPrecise: 'LARGE', cuponAutomatico: true }).plan;
    const pm = pedidoDeCupon({ venta: mp, plan: planMp, productoCRMSegundo: null, genero: 'F' });
    assert.ok(pm.ok, pm.ok ? '' : pm.faltantes.join(' · ')); assert.equal(pm.pedido.provider, 'kodak-progresivos'); assert.equal(pm.pedido.segundo, null);
});
t('el cupón se lee de la página de detalle del sitio y se reconoce por DNI y promo', () => {
    const html = '<order-form :order="{&quot;id&quot;:253056,&quot;provider&quot;:&quot;varilux&quot;,&quot;code&quot;:&quot;VA7AGQWN&quot;,&quot;code_used_at&quot;:null,&quot;first_name&quot;:&quot;Patricia&quot;,&quot;document_number&quot;:&quot;12345678&quot;,&quot;created_at&quot;:&quot;2026-10-16T21:20:46.000000Z&quot;}" v-cloak>';
    const p = pedidoDeLaPagina(html);
    assert.equal(p.id, 253056); assert.equal(p.code, 'VA7AGQWN'); assert.equal(p.provider, 'varilux'); assert.equal(p.document_number, '12345678');
    assert.equal(esCuponDelCliente(p, { provider: 'varilux', dni: '12.345.678' }), true);
    assert.equal(esCuponDelCliente(p, { provider: 'mi-primer-varilux', dni: '12345678' }), false);
    assert.equal(esCuponDelCliente(p, { provider: 'varilux', dni: '99999999' }), false);
    assert.equal(pedidoDeLaPagina('<html>sin pedido</html>'), null);
    assert.equal(pedidoDeLaPagina('<x :order="{&quot;id&quot;:1,&quot;code&quot;:&quot;no es cupon&quot;}">'), null);
    const filas = [{ fecha: '16/10/2026', promocion: 'VDD', codigo: 'VA7AGQWN', cliente: 'Patricia Devereux', detalleUrl: 'u1', pdfUrl: null }, { fecha: '08/10/2026', promocion: 'VDD', codigo: 'VAUV2XMV', cliente: 'Samuel Alberto Vadora', detalleUrl: 'u2', pdfUrl: null }];
    assert.deepEqual(filasDelCliente(filas, 'Devereux Patricia').map(f => f.codigo), ['VA7AGQWN']);
    assert.deepEqual(filasDelCliente(filas, 'Samuel Vadora').map(f => f.codigo), ['VAUV2XMV']);
    assert.deepEqual(filasDelCliente(filas, 'Otra Persona'), []);
});
t('las credenciales de la web de promo salen del entorno; Kodak cae a Varilux (y el error nombra las que se usaron); sin nada se avisa', () => {
    assert.deepEqual(credencialesPromo('KODAK', { PROMO_VARILUX_USER: 'u', PROMO_VARILUX_PASSWORD: 'p' }), { usuario: 'u', clave: 'p', variables: 'PROMO_VARILUX_USER/PROMO_VARILUX_PASSWORD' });
    assert.deepEqual(credencialesPromo('KODAK', { PROMO_VARILUX_USER: 'u', PROMO_VARILUX_PASSWORD: 'p', PROMO_KODAK_USER: 'k', PROMO_KODAK_PASSWORD: 'kp' }), { usuario: 'k', clave: 'kp', variables: 'PROMO_KODAK_USER/PROMO_KODAK_PASSWORD' });
    assert.throws(() => credencialesPromo('VARILUX', {}), CredencialPromoFaltanteError);
    assert.throws(() => credencialesPromo('VARILUX', { PROMO_VARILUX_USER: 'u' }), /PROMO_VARILUX_USER\/PROMO_VARILUX_PASSWORD/);
});
t('un cupón del historial solo se reutiliza sin usar y reciente; Mi Primer se reconoce por provider', () => {
    const ahora = new Date('2026-10-20T12:00:00Z');
    const base = { id: 1, provider: 'varilux', code: 'VA7AGQWN', code_used_at: null, document_number: '1', first_name: null, last_name: null, created_at: '2026-10-16T21:20:46.000000Z', promotions_product_line_id: null, first_product_id: null, second_product_id: null };
    assert.equal(cuponReutilizable(base, ahora), true);
    assert.equal(cuponReutilizable({ ...base, code_used_at: '2026-10-17T10:00:00.000000Z' }, ahora), false);
    assert.equal(cuponReutilizable({ ...base, created_at: '2026-06-01T00:00:00.000000Z' }, ahora), false);
    assert.equal(cuponReutilizable({ ...base, created_at: null }, ahora), false);
    assert.equal(cuponReutilizable({ ...base, created_at: `2026-${String(10).padStart(2, '0')}-20T00:00:00.000000Z` }, ahora), true);
    assert.equal(esProviderMiPrimer('mi-primer-varilux'), true); assert.equal(esProviderMiPrimer('kodak-progresivos'), true);
    assert.equal(esProviderMiPrimer('varilux'), false); assert.equal(esProviderMiPrimer('kodak'), false);
    assert.equal(DIAS_CUPON_VIGENTE, 60);
});
t('el cupón automático solo aplica a promos con web (Varilux / Kodak); un 2x1 de otra familia sigue pidiendo el cupón tipeado', () => {
    const v = ventaDoble();
    const sygnus = 'SYGNUS CLASSIC - ORMA + CRIZAL 2x1';
    for (const i of v.items) { i.product.name = sygnus; i.productNameSnapshot = sygnus; i.crystalColor = null; }
    v.items[0].price = 200000; v.items[1].price = 200000; v.items[2].product.price = 100000; v.items[3].product.price = 100000;
    assert.equal(esPromoDobleDeOptovision(v), true);
    const roles = rolesDeLaPromo(v);
    const r = planDeCarga(v, roles.conCargo, { tratamiento: 'CRIZAL_FORTE_UV', calibrado: 'COMUN', tipoArmazon: '2', forma: 11, cuponAutomatico: true, genero: 'M' });
    if (r.ok) assert.fail('tendría que pedir el cupón tipeado');
    assert.ok(r.faltantes.some(f => /cupón/.test(f)) || r.aMano, r.faltantes.join(' · '));
    // El nombre repartido conserva acentos y mayúsculas de la ficha (va al voucher).
    assert.deepEqual(repartirNombre('María José Pérez'), { nombre: 'María', apellido: 'José Pérez' });
    // Una DNP con medio punto avisa que va redondeada.
    const med = recetaWebDe({ esf: '-1.00', cil: null, eje: null, adic: '1.00', dnp: '32.5', altura: null }, 'OI');
    assert.ok(med.ok); assert.match(med.avisos[0], /32\.5 va como 33/);
    // Fecha de nacimiento como string sin zona: se lee por su día.
    assert.equal(clienteWebDe({ name: 'Ana Perez', dni: '1234567', birthDate: '1970-01-02', phone: null, email: null }, 'F').cliente.nacimiento.iso, '1970-01-02');
});
t('el teléfono va solo si entra en la máscara del sitio (10–11 dígitos, sin el 54/549 de WhatsApp); si no, vacío con aviso', () => {
    assert.equal(telefonoParaLaWeb('3517622560'), '3517622560');
    assert.equal(telefonoParaLaWeb('5493517622560'), '3517622560');
    assert.equal(telefonoParaLaWeb('+54 9 351 762-2560'), '3517622560');
    assert.equal(telefonoParaLaWeb('543517622560'), '3517622560');
    assert.equal(telefonoParaLaWeb('12345'), null); assert.equal(telefonoParaLaWeb(null), null);
    const c = clienteWebDe({ name: 'Ana Perez', dni: '1234567', birthDate: '1970-01-02', phone: '12345', email: null }, 'F');
    assert.ok(c.ok); assert.equal(c.cliente.telefono, null); assert.match(c.avisos[0], /sin teléfono/);
});
t('el historial se recorre de la fila más nueva a la más vieja, las parecidas primero, y en la promo doble solo los últimos 60 días', () => {
    assert.equal(fechaDelHistorial('16/10/2026').toISOString().slice(0, 10), '2026-10-16'); assert.equal(fechaDelHistorial('nada'), null);
    const fila = (fecha, cliente) => ({ fecha, promocion: 'VDD', codigo: cliente.slice(0, 2), cliente, detalleUrl: 'u', pdfUrl: null });
    const filas = [fila('01/01/2026', 'Vieja Persona'), fila('08/10/2026', 'Samuel Vadora'), fila('16/10/2026', 'Patricia Devereux'), fila('20/10/2026', 'Otra Persona'), fila('??', 'Sin Fecha')];
    const ahora = new Date('2026-10-20T12:00:00Z');
    assert.deepEqual(ordenDeBusqueda(filas, 'Samuel Vadora', DIAS_CUPON_VIGENTE, ahora).map(f => f.cliente), ['Samuel Vadora', 'Otra Persona', 'Patricia Devereux', 'Sin Fecha']);
    assert.deepEqual(ordenDeBusqueda(filas, 'Nadie', null, ahora).map(f => f.cliente), ['Otra Persona', 'Patricia Devereux', 'Samuel Vadora', 'Vieja Persona', 'Sin Fecha']);
    const muchas = Array.from({ length: 200 }, (_, i) => fila(`01/10/2026`, `Cliente ${i}`));
    // El tope solo corta en la promo doble; Mi Primer (una vez en la vida) mira todas.
    assert.equal(ordenDeBusqueda(muchas, 'Nadie', DIAS_CUPON_VIGENTE, ahora).length, MAX_DETALLES_HISTORIAL);
    assert.equal(ordenDeBusqueda(muchas, 'Nadie', null, ahora).length, 200);
});
t('un cupón reutilizado hecho con otro producto avisa fuerte', () => {
    const hoy = { linea: { id: 8, name: 'Varilux Comfort' }, primero: { id: 1391, name: 'Comfort Orma Blue Uv Prevencia' }, segundo: { id: 1393, name: 'Comfort Orma Blue Uv Forte' } };
    assert.equal(avisoDeCuponDistinto('VA1', { linea: 8, primero: 1391, segundo: 1393 }, hoy), null);
    assert.match(avisoDeCuponDistinto('VA1', { linea: 8, primero: 1376, segundo: 1393 }, hoy), /1er par \(hoy Comfort Orma Blue Uv Prevencia\)/);
    assert.match(avisoDeCuponDistinto('VA1', { linea: 11, primero: 1391, segundo: null }, hoy), /línea/);
    assert.equal(avisoDeCuponDistinto('VA1', null, hoy), null);
    assert.equal(avisoDeCuponDistinto('VA1', { linea: 8, primero: 1391, segundo: 9 }, { ...hoy, segundo: null }), null);
});

console.log(`check:carga-optovision OK (${n} grupos)`);

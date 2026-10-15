#!/usr/bin/env node
/**
 * Pagos de Mercado Pago que no se concretan: cuándo se cancela una venta web,
 * fijado.
 *
 * POR QUÉ EXISTE
 * Revisión del 10/10/2026. El cron que vence los pagos (mercadopago-expirados)
 * no estaba programado, y al programarlo aparecieron tres formas de perder plata:
 *   · solo le preguntaba a Mercado Pago si el intento tenía el id del pago, y
 *     un intento pendiente nunca lo tiene → cancelaba ventas cobradas cuyo aviso
 *     se había perdido;
 *   · cancelaba ventas que ya no esperaban el pago (confirmadas por un
 *     vendedor, o borradas desde el CRM, que ya habían devuelto el stock);
 *   · devolvía el stock fuera de la transacción: con dos instancias corriendo
 *     el cron, dos veces.
 *
 * Corre sin base y sin red (la decisión es pura; el resto, lectura del código).
 * Uso: npm run check:mp-vencimientos
 */
import { readFileSync } from 'node:fs';
import { decidirVencimiento } from '../../src/lib/checkout/vencimiento-mp.ts';

const casos = [];
const esperar = (nombre, cond, detalle) => casos.push({ nombre, ok: !!cond, detalle });
const pago = (id, status) => ({ id, status, statusDetail: null, externalReference: 'orden', amount: 100, paymentMethodId: null, paymentTypeId: null, installments: 1, payerEmail: null, metadata: {} });

esperar('sin pagos en Mercado Pago → cancelar', decidirVencimiento([]).accion === 'cancelar');
esperar('solo rechazados → cancelar', decidirVencimiento([pago('1', 'rejected'), pago('2', 'cancelled')]).accion === 'cancelar');
esperar('un rechazo y después un aprobado → acreditar ese', (() => { const d = decidirVencimiento([pago('1', 'rejected'), pago('2', 'approved')]); return d.accion === 'acreditar' && d.pago.id === '2'; })());
esperar('efectivo pendiente → esperar (no cancelar)', decidirVencimiento([pago('1', 'pending')]).accion === 'esperar');
esperar('en revisión → esperar', decidirVencimiento([pago('1', 'rejected'), pago('2', 'in_process')]).accion === 'esperar');
esperar('aprobado gana aunque haya uno pendiente', decidirVencimiento([pago('1', 'pending'), pago('2', 'approved')]).accion === 'acreditar');

// Sin comentarios: una llamada comentada no puede contar como presente.
const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const cron = leer('src/app/api/cron/mercadopago-expirados/route.ts');
const consulta = cron.indexOf('buscarPagosDeOrden(');
const cancela = cron.indexOf('failWebPayment(');
esperar('el cron le pregunta a Mercado Pago ANTES de cancelar', consulta > -1 && cancela > consulta);
esperar('el cron no depende del id de pago guardado para preguntar', !/if \(intento\.paymentId/.test(cron));
esperar('sin poder preguntar (sin credencial) no cancela', /if \(!puedeConsultarMercadoPago\(\)\) \{[\s\S]{0,60}continue;/.test(cron));
// Con el cobro apagado en la tienda el stock reservado se tiene que liberar
// igual: el cron mira la credencial, no el interruptor de ventas.
esperar('el cron no depende del interruptor de ventas de Mercado Pago', !/isMercadoPagoEnabled\(/.test(cron));
esperar('un pago sobre una venta ya confirmada a mano se cuenta aparte (a conciliar)', /r\.ok && r\.aConciliar/.test(cron));

const fin = leer('src/lib/checkout/finalize-web-payment.ts');
const failW = fin.slice(fin.indexOf('export async function failWebPayment'));
esperar('la cancelación bloquea la fila de la orden', /FOR UPDATE/.test(failW));
esperar('la cancelación reclama el intento solo si sigue PENDING', /webPaymentIntent\.updateMany\(\{\s*where: \{ id: intentId, status: 'PENDING' \}/.test(failW));
esperar('la cancelación reclama la orden solo si sigue WEB_PENDING y sin borrar', /order\.updateMany\(\{\s*where: \{ id: order\.id, status: 'WEB_PENDING', isDeleted: false[ ,}]/.test(failW));
const txFail = failW.slice(failW.indexOf('prisma.$transaction'), failW.indexOf("return 'cancelada'"));
esperar('el stock se devuelve DENTRO de la transacción', /stock: \{ increment/.test(txFail));
const finW = fin.slice(fin.indexOf('export async function finalizeWebPayment'), fin.indexOf('export async function failWebPayment'));
esperar('el pago aprobado bloquea la fila de la orden', /FOR UPDATE/.test(finW));
const ramaBorrada = finW.slice(finW.indexOf('if (cancelada && fresca.deletedReason)'), finW.indexOf("tipo: 'borrada-por-una-persona'"));
esperar('un pago aprobado sobre una venta borrada por una persona no la revive', ramaBorrada.length > 0 && ramaBorrada.length < 600);
// Si el intento quedara PENDING, el chequeo cada 10 min lo volvería a encontrar
// y mandaría el mismo aviso urgente para siempre (revisión del 10/10/2026).
esperar('…y cierra el intento en la misma transacción (el aviso sale una vez)', /cerrarIntentoSinAcreditar\(/.test(ramaBorrada));
// El cierre tiene que ser de verdad: con tx (misma transacción) y a APPROVED.
const cierre = finW.slice(finW.indexOf('const cerrarIntentoSinAcreditar'), finW.indexOf('const avisarParaConciliar'));
esperar('el cierre del intento usa la transacción y lo deja APPROVED (sale de la cola del cron)',
  /tx\.webPaymentIntent\.update\(/.test(cierre) && /status: 'APPROVED'/.test(cierre) && !/prisma\./.test(cierre));
const ramaConfirmada = finW.slice(finW.indexOf("if (!cancelada && (fresca.status !== 'WEB_PENDING' || cobrosCargados > 0))"), finW.lastIndexOf("tipo: 'a-conciliar'"));
esperar('una venta con un cobro cargado a mano también va a conciliar (aunque siga WEB_PENDING)', /cobrosCargados = await tx\.payment\.count/.test(finW) && ramaConfirmada.length > 0);
esperar('un pago sobre una venta que ya no espera el pago (confirmada a mano) no la acredita de nuevo', ramaConfirmada.length > 0 && ramaConfirmada.length < 1500);
esperar('…cierra el intento y deja un aviso para conciliar, sin Payment, factura ni cambio de estado',
  /cerrarIntentoSinAcreditar\(/.test(ramaConfirmada) && /avisarParaConciliar\(/.test(ramaConfirmada)
  && !/payment\.create|INVOICE_REQUEST|order\.update/.test(ramaConfirmada));
// Lo que sí acredita (Payment, factura) tiene que venir DESPUÉS de las dos ramas.
esperar('el cobro y la factura se crean solo después de descartar esos casos',
  finW.lastIndexOf("tipo: 'a-conciliar'") > -1 && finW.indexOf('tx.payment.create(') > finW.lastIndexOf("tipo: 'a-conciliar'") && finW.indexOf("type: 'INVOICE_REQUEST'") > finW.lastIndexOf("tipo: 'a-conciliar'"));
esperar('un segundo pago sobre una venta ya pagada no se carga (aviso a conciliar)', /if \(fresca\.status === 'WEB_PAID' \|\| fresca\.status === 'PAID'\) \{[\s\S]{0,400}avisarParaConciliar\(/.test(finW));
esperar('el intento se relee después del bloqueo (dos avisos juntos no duplican nada)', finW.indexOf('FOR UPDATE') > -1 && finW.indexOf('intentoFresco') > finW.indexOf('FOR UPDATE'));
esperar('la cancelación no toca una venta con cobros cargados a mano', /status: 'WEB_PENDING', isDeleted: false, payments: \{ none: \{\} \}/.test(failW));
esperar('una venta que canceló el sistema se reactiva y vuelve a reservar el stock', /isDeleted: false/.test(finW) && /stock: \{ decrement/.test(finW));

const inst = leer('src/instrumentation.ts');
esperar('el cron está programado en el scheduler interno', /api\/cron\/mercadopago-expirados/.test(inst) && /maybeRunMpExpirados\(\)\.catch/.test(inst));

const fallas = casos.filter((c) => !c.ok);
for (const c of casos) console.log(`${c.ok ? '✅' : '❌'} ${c.nombre}${c.ok || !c.detalle ? '' : `\n     ${c.detalle}`}`);
console.log(`\n${casos.length - fallas.length}/${casos.length} casos OK`);
if (fallas.length) process.exit(1);

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

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');
const cron = leer('src/app/api/cron/mercadopago-expirados/route.ts');
const consulta = cron.indexOf('buscarPagosDeOrden(');
const cancela = cron.indexOf('failWebPayment(');
esperar('el cron le pregunta a Mercado Pago ANTES de cancelar', consulta > -1 && cancela > consulta);
esperar('el cron no depende del id de pago guardado para preguntar', !/if \(intento\.paymentId/.test(cron));
esperar('sin poder preguntar (MP apagado) no cancela', /if \(!isMercadoPagoEnabled\(\)\) \{[\s\S]{0,60}continue;/.test(cron));

const fin = leer('src/lib/checkout/finalize-web-payment.ts');
const failW = fin.slice(fin.indexOf('export async function failWebPayment'));
esperar('la cancelación bloquea la fila de la orden', /FOR UPDATE/.test(failW));
esperar('la cancelación reclama el intento solo si sigue PENDING', /webPaymentIntent\.updateMany\(\{\s*where: \{ id: intentId, status: 'PENDING' \}/.test(failW));
esperar('la cancelación reclama la orden solo si sigue WEB_PENDING y sin borrar', /order\.updateMany\(\{\s*where: \{ id: order\.id, status: 'WEB_PENDING', isDeleted: false \}/.test(failW));
const txFail = failW.slice(failW.indexOf('prisma.$transaction'), failW.indexOf("return 'cancelada'"));
esperar('el stock se devuelve DENTRO de la transacción', /stock: \{ increment/.test(txFail));
const finW = fin.slice(fin.indexOf('export async function finalizeWebPayment'), fin.indexOf('export async function failWebPayment'));
esperar('el pago aprobado bloquea la fila de la orden', /FOR UPDATE/.test(finW));
esperar('un pago aprobado sobre una venta borrada por una persona no la revive', /deletedReason\) return \{ tipo: 'borrada-por-una-persona'/.test(finW));
esperar('una venta que canceló el sistema se reactiva y vuelve a reservar el stock', /isDeleted: false/.test(finW) && /stock: \{ decrement/.test(finW));

const inst = leer('src/instrumentation.ts');
esperar('el cron está programado en el scheduler interno', /api\/cron\/mercadopago-expirados/.test(inst) && /maybeRunMpExpirados\(\)\.catch/.test(inst));

const fallas = casos.filter((c) => !c.ok);
for (const c of casos) console.log(`${c.ok ? '✅' : '❌'} ${c.nombre}${c.ok || !c.detalle ? '' : `\n     ${c.detalle}`}`);
console.log(`\n${casos.length - fallas.length}/${casos.length} casos OK`);
if (fallas.length) process.exit(1);

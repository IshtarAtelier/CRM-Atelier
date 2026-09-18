#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────────────────
// LOS ENVÍOS DE PLATA REINTENTAN, y solo ante fallos transitorios.
//
// POR QUÉ EXISTE (17/9/2026): el recibo de pago de Luis Greca no salió. Meta
// contestó "Graph 500: (#131000) Something went wrong" —su error genérico
// pasajero— y el flujo hacía UN intento: marcó la ficha en rojo, mandó el mail
// de alarma y listo. Fue el tercer recibo perdido así en diez días (7/9, 8/9,
// 17/9). Un tropiezo de dos segundos de Meta no puede costar un recibo.
//
// QUÉ VERIFICA, leyendo el código (sin base, sin red):
//   1. Los envíos que son plata o compromiso con el cliente —recibo de pago
//      (texto y PDF), aviso interno de cobro, confirmación de compra— usan
//      `sendWhatsAppConReintento`, no `sendWhatsApp` a secas.
//   2. El reintento NUNCA insiste sobre un resultado AMBIGUO (la request se
//      cortó sin respuesta): ahí el mensaje pudo haber salido, y reintentar se
//      lo manda dos veces al cliente y cobra dos conversaciones.
//   3. Tampoco insiste sobre fallos definitivos (ventana cerrada, número
//      inválido, plantilla rechazada): insistir no los cambia.
//   4. El aviso interno de cobro deja rastro en el AuditLog (`aviso_pago_interno`):
//      antes fallaba en un console.error y no había dónde mirar.
// ────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';

const leer = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const send = leer('../../src/lib/whatsapp/send.ts');
const contact = leer('../../src/services/contact.service.ts');
const conf = leer('../../src/lib/sale-confirmation.ts');

let ok = 0; const fallas = [];
const check = (nombre, cond) => { if (cond) { ok++; console.log(`  ✓ ${nombre}`); } else { fallas.push(nombre); console.log(`  ✗ ${nombre}`); } };

console.log('\nLos envíos de plata reintentan (y solo lo que corresponde)\n');

check('existe sendWhatsAppConReintento en el único helper de envío', /export async function sendWhatsAppConReintento/.test(send));
check('el reintento nunca insiste sobre un resultado AMBIGUO', /if \(r\.code === AMBIGUO\) return false;/.test(send));
check('ni sobre ventana cerrada, número inválido o plantilla rechazada',
    /definitivos = new Set\(\[[^\]]*'WINDOW_CLOSED'[^\]]*'INVALID_NUMBER'[^\]]*'TEMPLATE_ERROR'/.test(send));
check('sí reintenta el "(#131000) Something went wrong" de Meta', /#131000/.test(send));

// Cada envío se busca por su variable, que es lo que lo identifica en el flujo.
const usaReintento = (src, variable) => new RegExp(`const ${variable} = await sendWhatsAppConReintento\\(`).test(src);
check('el recibo al cliente (texto / plantilla) reintenta', usaReintento(contact, 'resClient'));
check('el PDF del recibo reintenta', usaReintento(contact, 'resPdf'));
check('el aviso interno de cobro a la dueña reintenta',
    /const r = await sendWhatsAppConReintento\(\{\s*chatId: ADMIN_WHATSAPP_PHONE/.test(contact));
check('la confirmación de compra reintenta', usaReintento(conf, 'res'));
check('el aviso interno deja rastro en el AuditLog', /tipo: 'aviso_pago_interno'/.test(contact));

console.log(`\n${ok} ok, ${fallas.length} fallas`);
if (fallas.length) { console.log('FALLAS:', fallas.join(' · ')); process.exit(1); }

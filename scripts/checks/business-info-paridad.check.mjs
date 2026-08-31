#!/usr/bin/env node
/**
 * Verifica que el espejo CommonJS de los datos comerciales
 * (`wa-service/shared/business-info.js`) diga EXACTAMENTE lo mismo que las
 * fuentes TypeScript de las que se copió.
 *
 * Por qué hay dos copias: el wa-service se despliega como imagen propia y su
 * Dockerfile solo copia `prisma/` y `wa-service/` — no puede importar nada de
 * `src/`, y menos TypeScript. Mismo motivo que `ad-tag-paridad.check.mjs`.
 *
 * Por qué importa MÁS que en otros lugares: estos valores salen tal cual hacia
 * un cliente, en el mensaje del auto-respondedor fuera de horario. Un horario o
 * un porcentaje viejo en el espejo es una promesa falsa mandada por WhatsApp,
 * no un bug interno. Ya pasó una vez con los descuentos (`/optica-cordoba`
 * anunciaba 20% mientras el checkout cobraba 15%).
 *
 * Además del espejo, se anclan las reglas de negocio del TEXTO que se manda:
 * que se identifique como automático, que prometa respuesta humana, y que las
 * 12 cuotas nunca aparezcan como "sin interés" sino con su costo financiero.
 *
 * Uso: node --experimental-strip-types scripts/checks/business-info-paridad.check.mjs
 */

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '../..');

const cjs = require(resolve(raiz, 'wa-service/shared/business-info.js'));
const { buildAutoReplyText } = require(resolve(raiz, 'wa-service/auto-responder.js'));
const { BUSINESS_INFO } = await import(pathToFileURL(resolve(raiz, 'src/lib/business-info.ts')).href);
const { RECARGO_MP_CUOTAS_LARGAS } = await import(pathToFileURL(resolve(raiz, 'src/lib/constants/descuentos.ts')).href);

let fallas = 0;
const fallar = (msg) => { fallas++; console.error(`❌ ${msg}`); };

// ── 1. Paridad valor por valor ───────────────────────────────────────────────
const ESPEJO = [
    ['ADDRESS', cjs.ADDRESS, BUSINESS_INFO.address, 'src/lib/business-info.ts → BUSINESS_INFO.address'],
    ['HOURS_WHATSAPP_BLOCK', cjs.HOURS_WHATSAPP_BLOCK, BUSINESS_INFO.hoursWhatsAppBlock, 'src/lib/business-info.ts → BUSINESS_INFO.hoursWhatsAppBlock'],
    ['DISCOUNT_CASH_PERCENT', cjs.DISCOUNT_CASH_PERCENT, BUSINESS_INFO.discountCashPercent, 'src/lib/business-info.ts → BUSINESS_INFO.discountCashPercent'],
    ['DISCOUNT_TRANSFER_PERCENT', cjs.DISCOUNT_TRANSFER_PERCENT, BUSINESS_INFO.discountTransferPercent, 'src/lib/business-info.ts → BUSINESS_INFO.discountTransferPercent'],
    ['RECARGO_MP_CUOTAS_LARGAS', cjs.RECARGO_MP_CUOTAS_LARGAS, RECARGO_MP_CUOTAS_LARGAS, 'src/lib/constants/descuentos.ts → RECARGO_MP_CUOTAS_LARGAS'],
];

for (const [nombre, copia, original, donde] of ESPEJO) {
    if (copia === undefined) { fallar(`${nombre} no está exportado en wa-service/shared/business-info.js`); continue; }
    if (copia !== original) {
        fallar(`${nombre} diverge de su original.`);
        console.error(`   wa-service/shared/business-info.js → ${JSON.stringify(copia)}`);
        console.error(`   ${donde} → ${JSON.stringify(original)}`);
    }
}

// ── 2. El horario del espejo tiene que decir lo mismo que `hours` ────────────
// `hours` y `hoursWhatsAppBlock` son dos formatos del MISMO dato: si alguien
// actualiza uno solo, el auto-respondedor manda el otro.
const horas = (t) => (String(t).match(/\d{1,2}:\d{2}/g) || []).join(' ');
if (horas(BUSINESS_INFO.hours) !== horas(BUSINESS_INFO.hoursWhatsAppBlock)) {
    fallar('BUSINESS_INFO.hours y BUSINESS_INFO.hoursWhatsAppBlock tienen horarios distintos.');
    console.error(`   hours              → ${horas(BUSINESS_INFO.hours)}`);
    console.error(`   hoursWhatsAppBlock → ${horas(BUSINESS_INFO.hoursWhatsAppBlock)}`);
}

// ── 3. El texto que le llega al cliente ─────────────────────────────────────
const texto = buildAutoReplyText();

const OBLIGATORIO = [
    // Lo que hace legítima la automatización ante Meta: se identifica y promete
    // que después contesta una persona. Sin esto no se manda nada.
    [/mensaje autom[aá]tico/i, 'el texto tiene que decir que es un MENSAJE AUTOMÁTICO'],
    [/persona del equipo|te responde una persona/i, 'el texto tiene que prometer que responde una PERSONA'],
    [new RegExp(BUSINESS_INFO.address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'el texto tiene que traer la dirección'],
    [/Lunes a viernes de 8:00 a 20:00/i, 'el texto tiene que traer el horario de semana'],
    [/S[aá]bados de 9:00 a 17:00/i, 'el texto tiene que traer el horario del sábado'],
    [/3 y 6 cuotas sin inter[eé]s/i, 'el texto tiene que aclarar que 3 y 6 cuotas son sin interés'],
    [new RegExp(`12 cuotas[^.]*${RECARGO_MP_CUOTAS_LARGAS}% de costo financiero`, 'i'), `las 12 cuotas tienen que aclarar el ${RECARGO_MP_CUOTAS_LARGAS}% de costo financiero`],
    [new RegExp(`${BUSINESS_INFO.discountCashPercent}% de descuento`), 'el texto tiene que traer el descuento por efectivo/transferencia'],
];
for (const [re, queria] of OBLIGATORIO) {
    if (!re.test(texto)) fallar(`Mensaje del auto-respondedor: ${queria}. (patrón ${re})`);
}

const PROHIBIDO = [
    // La regla de negocio más cara del repo: las cuotas largas NUNCA se
    // comunican como "sin interés".
    [/12\s*(cuotas\s*)?sin inter[eé]s/i, '"12 cuotas sin interés" — llevan 10% de costo financiero'],
    [/18 cuotas/i, 'los 18 cuotas se retiraron el 27/8/26'],
    // No puede parecerse a una respuesta automática de Meta: el filtro de
    // entrantes (shared/meta-auto-patterns.js) descartaría nuestro propio eco.
];
for (const [re, porque] of PROHIBIDO) {
    if (re.test(texto)) fallar(`Mensaje del auto-respondedor: no puede decir ${porque}. (patrón ${re})`);
}

// El propio texto no debe matchear el filtro de "respuesta automática de Meta":
// si lo hiciera, un eco del teléfono con ese texto se leería como ruido.
const { isMetaAutoReplyText } = require(resolve(raiz, 'wa-service/shared/meta-auto-patterns.js'));
if (isMetaAutoReplyText(texto)) {
    fallar('El mensaje del auto-respondedor matchea shared/meta-auto-patterns.js — reformularlo.');
}

// WhatsApp corta feo los mensajes larguísimos; este tiene que entrar cómodo.
if (texto.length > 1000) fallar(`El mensaje mide ${texto.length} caracteres: demasiado largo para WhatsApp.`);

if (fallas) {
    console.error(`\n❌ ${fallas} problema(s). El espejo de wa-service tiene que copiar los valores de src/, no corregirlos.`);
    process.exit(1);
}

console.log(`✅ Datos comerciales del wa-service en paridad con src/ (${ESPEJO.length} valores) y mensaje del auto-respondedor válido (${texto.length} caracteres).`);

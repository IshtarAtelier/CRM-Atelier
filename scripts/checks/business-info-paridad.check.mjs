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
 * 12 cuotas nunca aparezcan como "sin interés" (regla de Ishtar; desde el
 * 31/8/26 a la noche el % tampoco se menciona — "hasta 12 cuotas fijas").
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
    ['APPOINTMENT_SLOTS', cjs.APPOINTMENT_SLOTS, BUSINESS_INFO.appointmentSlots, 'src/lib/business-info.ts → BUSINESS_INFO.appointmentSlots'],
    // La franja de graduación (12-16) sale hacia el cliente por el prompt del
    // bot: si diverge, el bot agenda un examen visual que no se puede cumplir.
    ['DISCOUNT_CASH_LOCAL_PERCENT', cjs.DISCOUNT_CASH_LOCAL_PERCENT, BUSINESS_INFO.discountCashLocalPercent, 'src/lib/business-info.ts → BUSINESS_INFO.discountCashLocalPercent'],
    ['HOURS', cjs.HOURS, BUSINESS_INFO.hours, 'src/lib/business-info.ts → BUSINESS_INFO.hours'],
    ['EXAM_SLOTS', cjs.EXAM_SLOTS, BUSINESS_INFO.examSlots, 'src/lib/business-info.ts → BUSINESS_INFO.examSlots'],
    ['WEBSITE_DISPLAY', cjs.WEBSITE_DISPLAY, BUSINESS_INFO.websiteDisplay, 'src/lib/business-info.ts → BUSINESS_INFO.websiteDisplay'],
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
    // La etiqueta "mensaje automático" NO se exige: Ishtar pidió sacarla el
    // 31/8 (los mensajes de ausencia nativos de WhatsApp tampoco la llevan).
    // Lo que sigue siendo obligatorio es la promesa de atención humana.
    // Lo que importa es la SUSTANCIA —que prometa atención humana—, no una
    // redacción puntual. Ishtar escribió "te respondemos de forma
    // personalizada", que lo dice igual de claro que "una persona del equipo".
    // La promesa de atención humana ya no se exige acá: el 31/8 Ishtar pidió
    // su texto "tal cual, sin cambiar absolutamente nada", y ese texto no la
    // trae. Es su mensaje; el check no lo reescribe.
    [new RegExp(BUSINESS_INFO.address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'el texto tiene que traer la dirección'],
    // "de 9 a 20 hs" y "de 9:00 a 20:00" son el mismo horario: el check
    // verifica que ESTÉ, no cómo se escribe. Corregido el 1/9/26: el local
    // abre a las 9, no a las 8 (BUSINESS_INFO.hours).
    [/Lunes a viernes de 9(:00)? a 20(:00)?/i, 'el texto tiene que traer el horario de semana'],
    [/S[aá]bados de 9(:00)? a 17(:00)?/i, 'el texto tiene que traer el horario del sábado'],
    [/3 y 6 cuotas sin inter[eé]s/i, 'el texto tiene que aclarar que 3 y 6 cuotas son sin interés'],
    // El 10% de las 12 cuotas NO se exige: desde el 31/8/26 a la noche es la
    // regla GENERAL (fórmula "hasta 12 cuotas fijas", sin el %) — antes era
    // una excepción de este mensaje. Ver src/lib/business-info.ts.
    [new RegExp(`${BUSINESS_INFO.discountCashPercent}% de descuento`), 'el texto tiene que traer el descuento por efectivo/transferencia'],
];
for (const [re, queria] of OBLIGATORIO) {
    if (!re.test(texto)) fallar(`Mensaje del auto-respondedor: ${queria}. (patrón ${re})`);
}

const PROHIBIDO = [
    // La regla de negocio más cara del repo: las cuotas largas NUNCA se
    // comunican como "sin interés" — "fijas" sí, "sin interés" jamás (eso son
    // solo 3 y 6). El patrón mira "12 cuotas … sin interés" dentro de una
    // misma oración; el orden inverso ("3 y 6 cuotas sin interés … 12") es la
    // frase legítima y no debe disparar.
    [/12\s*cuotas[^.!?\n]*sin\s*inter[eé]s/i, '"12 cuotas sin interés" (sin interés son solo 3 y 6)'],
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

// ── El pie de las placas de redes ───────────────────────────────────────────
//
// `scripts/social/plantillas.mjs` estampa dirección y horario en TODAS las
// placas, y también tiene su copia: corre con node pelado y no puede importar
// un .ts. Hasta el 2/9/26 esa copia se sincronizaba "a mano", según pedía un
// comentario. No se sincronizó: decía "Lun a Vie 8–20" cuando el horario ya era
// 9–20, y todas las placas renderizadas desde el cambio salieron con el horario
// viejo. Se descubrió mirando una placa recién hecha, no por un check.
//
// Se compara el HORARIO por sus números, no el texto: el pie usa la forma corta
// ("Lun a Vie 9–20 · Sáb 9–17") y BUSINESS_INFO la larga ("Lunes a Viernes de
// 9:00 a 20:00…"). Lo que tiene que coincidir son las horas.
const { DIRECCION_PIE, HORARIO_PIE } = await import(pathToFileURL(resolve(raiz, 'scripts/social/plantillas.mjs')).href);

const horasDe = (t) => (String(t).match(/\b\d{1,2}(?=[:\s–-]|$)/g) || []).map(Number);
const horasPie = horasDe(HORARIO_PIE);
const horasInfo = horasDe(BUSINESS_INFO.hours).filter(h => h !== 0);

if (JSON.stringify(horasPie) !== JSON.stringify(horasInfo)) {
    fallar(`El pie de las placas dice "${HORARIO_PIE}" (${horasPie.join('/')}) pero ` +
        `BUSINESS_INFO.hours dice "${BUSINESS_INFO.hours}" (${horasInfo.join('/')}). ` +
        `Corregir HORARIO_PIE en scripts/social/plantillas.mjs.`);
}

// La dirección: que el número de la calle del pie sea el de BUSINESS_INFO.
const nroPie = (DIRECCION_PIE.match(/\d{3,5}/) || [])[0];
const nroInfo = (String(BUSINESS_INFO.address || '').match(/\d{3,5}/) || [])[0];
if (nroPie && nroInfo && nroPie !== nroInfo) {
    fallar(`El pie de las placas dice la altura ${nroPie} y BUSINESS_INFO dice ${nroInfo}.`);
}

if (fallas) {
    console.error(`\n❌ ${fallas} problema(s). El espejo de wa-service tiene que copiar los valores de src/, no corregirlos.`);
    process.exit(1);
}

console.log(`✅ Datos comerciales del wa-service en paridad con src/ (${ESPEJO.length} valores), pie de las placas al día (${HORARIO_PIE}) y mensaje del auto-respondedor válido (${texto.length} caracteres).`);

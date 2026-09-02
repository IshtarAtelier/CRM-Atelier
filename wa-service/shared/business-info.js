/**
 * Datos comerciales de Atelier para el mundo CommonJS (el wa-service).
 *
 * ESPEJO EXACTO de los campos que usa el auto-respondedor:
 *   - `src/lib/business-info.ts`      → BUSINESS_INFO.address, .hoursWhatsAppBlock,
 *                                       .discountCashPercent, .discountTransferPercent
 *   - `src/lib/constants/descuentos.ts` → RECARGO_MP_CUOTAS_LARGAS
 *
 * Existen dos copias por la misma razón que `shared/ad-tag.js`: el wa-service se
 * despliega como imagen propia y su Dockerfile solo copia `prisma/` y
 * `wa-service/`, así que no puede importar nada de `src/` (y menos TypeScript).
 * Para que la duplicación no divergía —un horario o un porcentaje viejo saliendo
 * hacia un cliente es exactamente el bug que ya pasó— hay un check que compara
 * las dos fuentes valor por valor: `scripts/checks/business-info-paridad.check.mjs`
 * (`npm run check:businessinfo`, también en CI).
 *
 * SI TOCÁS ESTE ARCHIVO, TOCÁ TAMBIÉN `src/lib/business-info.ts`
 * (y/o `src/lib/constants/descuentos.ts`). Los valores mandan de allá: acá se
 * copian, nunca se "corrigen".
 */

/** BUSINESS_INFO.address */
const ADDRESS = 'José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba';

/** BUSINESS_INFO.hoursWhatsAppBlock */
const HOURS_WHATSAPP_BLOCK = '*Horarios:*\n   • Lunes a viernes de 9:00 a 20:00\n   • Sábados de 9:00 a 17:00 hs';

/**
 * BUSINESS_INFO.appointmentSlots — visita general al local (probarse armazones,
 * retirar, consultar). Coincide con el horario de atención.
 */
/** BUSINESS_INFO.hours — el horario en una línea, para prosa. */
const HOURS = 'Lunes a Viernes de 9:00 a 20:00. Sábados de 9:00 a 17:00';

const APPOINTMENT_SLOTS = 'de 9:00 a 20:00 (Lunes a Viernes), o de 9:00 a 17:00 (Sábados)';

/**
 * BUSINESS_INFO.examSlots — TOMA DE GRADUACIÓN (agudeza visual): SOLO la siesta.
 *
 * NO es lo mismo que `APPOINTMENT_SLOTS`: el local atiende de 9 a 20, pero el
 * examen visual se hace únicamente en esta franja. El bot lo necesita porque
 * venía ofreciendo control visual "cuando quieras" (conv-047 del dataset de
 * bot-eval), o sea prometiendo un turno que después no se puede cumplir.
 */
const EXAM_SLOTS = 'de 12:00 a 16:00 (la siesta)';

/** BUSINESS_INFO.discountCashPercent */
/**
 * BUSINESS_INFO.websiteDisplay — el dominio público, para armar el link del
 * catálogo. Se verifica contra src/ en npm run check:businessinfo.
 */
const WEBSITE_DISPLAY = 'atelieroptica.com.ar';

/** BUSINESS_INFO.discountCashLocalPercent — efectivo EN MANO, en el local. */
const DISCOUNT_CASH_LOCAL_PERCENT = 20;

/** BUSINESS_INFO.discountCashPercent — el de la tienda web. */
const DISCOUNT_CASH_PERCENT = 15;

/** BUSINESS_INFO.discountTransferPercent */
const DISCOUNT_TRANSFER_PERCENT = 15;

/**
 * RECARGO_MP_CUOTAS_LARGAS (`src/lib/constants/descuentos.ts`): las cuotas
 * largas de Mercado Pago (12) llevan este % de costo financiero ADENTRO del
 * importe. Desde el 31/8/26 a la noche el % NO se menciona en la comunicación
 * ("hasta 12 cuotas fijas") — solo se explica si el cliente pregunta por qué
 * el total de 12 es más alto. Nunca "12 cuotas sin interés".
 */
const RECARGO_MP_CUOTAS_LARGAS = 10;

module.exports = {
    ADDRESS,
    HOURS_WHATSAPP_BLOCK,
    HOURS,
    APPOINTMENT_SLOTS,
    EXAM_SLOTS,
    WEBSITE_DISPLAY,
    DISCOUNT_CASH_LOCAL_PERCENT,
    DISCOUNT_CASH_PERCENT,
    DISCOUNT_TRANSFER_PERCENT,
    RECARGO_MP_CUOTAS_LARGAS,
};

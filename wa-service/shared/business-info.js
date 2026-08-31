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
const HOURS_WHATSAPP_BLOCK = '*Horarios:*\n   • Lunes a viernes de 8:00 a 20:00\n   • Sábados de 9:00 a 17:00 hs';

/** BUSINESS_INFO.discountCashPercent */
const DISCOUNT_CASH_PERCENT = 15;

/** BUSINESS_INFO.discountTransferPercent */
const DISCOUNT_TRANSFER_PERCENT = 15;

/**
 * RECARGO_MP_CUOTAS_LARGAS (`src/lib/constants/descuentos.ts`): las cuotas
 * largas de Mercado Pago (12) llevan este % de costo financiero, y TODO lugar
 * que las mencione tiene que aclararlo. Nunca "12 cuotas sin interés".
 */
const RECARGO_MP_CUOTAS_LARGAS = 10;

module.exports = {
    ADDRESS,
    HOURS_WHATSAPP_BLOCK,
    DISCOUNT_CASH_PERCENT,
    DISCOUNT_TRANSFER_PERCENT,
    RECARGO_MP_CUOTAS_LARGAS,
};

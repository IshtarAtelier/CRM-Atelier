/**
 * Datos comerciales de Atelier Óptica — fuente única para prompts de agentes,
 * mensajes automáticos y validaciones.
 *
 * Los porcentajes de descuento reflejan los defaults de PricingService
 * (discountCash 20, discountTransfer 15). Si se cambian allí, actualizar acá.
 */

export const BUSINESS_INFO = {
  name: "Atelier Óptica",
  address: "José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba",
  addressStreetNumber: 4380,
  phone: "+54 9 354 121 5971",
  hours: "Lunes a Viernes de 9:00 a 13:30 y de 16:00 a 19:30. Sábados de 10:00 a 14:00",
  appointmentSlots: "por la mañana (9:00 a 13:30) o por la tarde (16:00 a 19:30)",
  discountCashPercent: 20,
  discountTransferPercent: 15,
  installmentsPromo: "3 o 6 cuotas sin interés con tarjeta",
} as const;

/** Texto de promociones listo para inyectar en prompts. */
export const PROMOS_TEXT = `${BUSINESS_INFO.installmentsPromo}, ${BUSINESS_INFO.discountCashPercent}% de descuento en efectivo o ${BUSINESS_INFO.discountTransferPercent}% por transferencia`;

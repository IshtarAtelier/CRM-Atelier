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
  phone: "+54 9 351 868-5644",
  phoneE164: "+5493518685644",
  postalCode: "5009",
  // Aproximado del domicilio — verificar contra el pin de Google Business Profile
  geo: { latitude: -31.3688, longitude: -64.2401 },
  instagramUrl: "https://www.instagram.com/atelieroptica_",
  youtubeUrl: "https://www.youtube.com/@AtelierOptica",
  mapsUrl: "https://www.google.com/maps?cid=14830223812501661125",
  entityId: "https://atelieroptica.com.ar/#optica",
  hours: "Lunes a Viernes de 8:00 a 20:00. Sábados de 9:00 a 17:00",
  /** Mismos horarios que `hours`, en formato schema.org — mantener sincronizados. */
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "08:00",
      closes: "20:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Saturday"],
      opens: "09:00",
      closes: "17:00",
    },
  ],
  appointmentSlots: "de 8:00 a 20:00 (Lunes a Viernes) o de 9:00 a 17:00 (Sábados)",
  discountCashPercent: 20,
  discountTransferPercent: 15,
  installmentsPromo: "3 o 6 cuotas sin interés con tarjeta",
} as const;

/** Texto de promociones listo para inyectar en prompts. */
export const PROMOS_TEXT = `${BUSINESS_INFO.installmentsPromo}, ${BUSINESS_INFO.discountCashPercent}% de descuento en efectivo o ${BUSINESS_INFO.discountTransferPercent}% por transferencia`;

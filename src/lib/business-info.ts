/**
 * Datos comerciales de Atelier Óptica — fuente única para prompts de agentes,
 * mensajes automáticos y validaciones.
 *
 * Los porcentajes de descuento tienen que reflejar la promo REAL de la tienda
 * (`web_promo_cash_discount`, hoy 15% tanto en efectivo como en transferencia,
 * usado por el checkout y la tienda). NO son el fallback de `PricingService`
 * (order.discountCash ?? 20) — ese es un default histórico por-orden para
 * ventas viejas sin el campo cargado, no la promo vigente. Confundir los dos
 * es cómo `/optica-cordoba` terminó anunciando "20% de descuento en efectivo"
 * mientras el cartel de arriba de la misma página y el checkout decían 15%.
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
  /** Dominio de la tienda tal como se escribe en mensajes al cliente. */
  websiteDisplay: "atelieroptica.com.ar",
  instagramUrl: "https://www.instagram.com/atelieroptica_",
  youtubeUrl: "https://www.youtube.com/@AtelierOptica",
  mapsUrl: "https://www.google.com/maps?cid=14830223812501661125",
  entityId: "https://atelieroptica.com.ar/#optica",
  hours: "Lunes a Viernes de 8:00 a 20:00. Sábados de 9:00 a 17:00",
  /**
   * Mismos horarios que `hours`, con el formato de viñetas que usan los mensajes
   * de WhatsApp al cliente. Existe para que ese bloque no se vuelva a copiar a
   * mano: ya pasó que quedara desactualizado en un lugar y el bot mandara
   * horarios inventados.
   */
  hoursWhatsAppBlock: "*Horarios:*\n   • Lunes a viernes de 8:00 a 20:00\n   • Sábados de 9:00 a 17:00 hs",
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
  /**
   * Franja para AGENDAR UNA CONSULTA GENERAL en el local (probarse armazones,
   * retirar, consultar). Coincide con el horario de atención.
   */
  appointmentSlots: "de 8:00 a 20:00 (Lunes a Viernes), o de 9:00 a 17:00 (Sábados)",
  /**
   * TOMA DE GRADUACIÓN (agudeza visual): SOLO en la siesta, de 12 a 16.
   *
   * Regla que dio Ishtar el 31/8/2026. No es lo mismo que `appointmentSlots`:
   * el local atiende de 8 a 20, pero el examen visual se hace únicamente en
   * esa franja. Antes el sistema ofrecía turno para graduación en cualquier
   * horario de atención — o sea que se le podía dar a alguien un turno que
   * después no se le podía cumplir.
   */
  examSlots: "de 12:00 a 16:00 (la siesta)",
  /**
   * SON DOS DESCUENTOS DISTINTOS, no uno mal cargado (Ishtar, 31/8/2026):
   *
   *   - `discountCashLocalPercent` (20%): EFECTIVO EN MANO, EN EL LOCAL. Es el
   *     que usa el cotizador por defecto (`admin/cotizador`: useState(20)) y el
   *     que corresponde nombrar en cualquier pieza que invite a venir al local.
   *   - `discountCashPercent` (15%): el de la TIENDA WEB. Online no se paga en
   *     efectivo, así que en la web va a la par de transferencia.
   *
   * Hasta hoy había un solo número y las dos realidades se pisaban: la web y
   * los mensajes decían 15% mientras el cotizador cobraba 20%, y ninguna de
   * las dos estaba "mal" — faltaba distinguirlas. Antes de cambiar cualquiera
   * de los dos, mirá a qué canal pertenece la superficie que estás tocando.
   */
  discountCashLocalPercent: 20,
  discountCashPercent: 15,
  discountTransferPercent: 15,
  // 27/8/2026 (acuerdo de Ishtar con Mercado Pago): se suman los 12 cuotas.
  //
  // REGLA DE COMUNICACIÓN (Ishtar, 31/8/2026 — decisión explícita):
  // el 10% de costo financiero de las 12 cuotas se ACLARA SIEMPRE, en TODA
  // superficie: tienda, checkout, PDFs, mails, plantillas de WhatsApp, prompts
  // del bot, piezas de redes, anuncios y blog. Y nunca se dice "sin interés"
  // de las 12 (eso son solo 3 y 6).
  //
  // ÚNICA EXCEPCIÓN, decidida por Ishtar el 31/8 después de leer la regla:
  // el CARTEL superior de la tienda (`SystemSetting.web_announcement_text`)
  // va sin el porcentaje, con su texto:
  //   "Envío Gratis • Hasta 12 Cuotas • 6 Cuotas sin Interés • 15% OFF en Transferencia"
  // Se le señaló que ahí las 12 quedan pegadas a "6 Cuotas sin Interés" y
  // eligió ese texto igual. Es una decisión suya, no un descuido: NO
  // "corregirlo" desde una sesión futura sin preguntarle. El resto de las
  // superficies sí lleva la aclaración.
  //
  // Hasta el 31/8 acá decía lo contrario ("NUNCA el %"), y esa regla se había
  // propagado a los generadores de redes y a los scripts de ads, dejando toda
  // la capa de marketing sin la aclaración mientras CLAUDE.md, PricingService
  // y los PDFs pedían lo opuesto. Dos reglas peleándose es la razón por la que
  // la plantilla de campaña perdió el paréntesis del 10% sin que nadie lo
  // notara. Si aparece otra vez un comentario que diga "nunca el %", está
  // desactualizado: la vara es esta.
  installmentsPromo: "3 o 6 cuotas sin interés con tarjeta, o hasta 12 cuotas con Mercado Pago (10% de costo financiero)",
  /**
   * Único tipo de factura que se comunica. Un commit del 29/8 (`f35d1757`)
   * puso "Factura A" acá diciendo que el fix del 28/8 (`346d9e5b`, "Factura B
   * o C") había quedado desactualizado — Ishtar confirmó DIRECTAMENTE en el
   * chat el 30/8 que "Factura B o C" es la correcta y NO se emite Factura A.
   * No volver a cambiar esto sin que ella lo confirme explícitamente: ya se
   * revirtió una vez sin preguntarle primero.
   */
  invoiceType: "Factura B o C",
  /**
   * 29/8/2026 (Ishtar): en piezas sobre cristales, mencionar SIEMPRE que
   * trabajamos con Essilor por ser el laboratorio líder a nivel mundial —
   * hacer hincapié, no de paso.
   */
  labPartner: "Essilor, el laboratorio líder a nivel mundial",
  /**
   * 29/8/2026 (Ishtar): el cambio de cristal en multifocales es UNA SOLA VEZ
   * (garantía de adaptación), nunca "las veces que sean necesarias" — esa
   * frase quedó mal y ya se corrigió en el sitio; no repetirla en piezas nuevas.
   */
  multifocalChangePolicy: "un solo cambio de cristal incluido (garantía de adaptación)",
} as const;

/** Texto de promociones listo para inyectar en prompts. */
export const PROMOS_TEXT = `${BUSINESS_INFO.installmentsPromo}, ${BUSINESS_INFO.discountCashPercent}% de descuento en efectivo o ${BUSINESS_INFO.discountTransferPercent}% por transferencia`;

/**
 * OPORTUNIDADES DE CIERRE — cuánto tiempo se persigue a cada uno.
 *
 * Calibrado el 10/9/2026 con producción a la vista (`scripts/checks/cierres-
 * volumen.check.mjs`, solo lee). Ishtar pidió dos cosas que tiran para lados
 * opuestos: "que toda ficha de los 30 días figure ahí" y "tiempos abarcables
 * por un vendedor". Todo a 30 días eran 257 tarjetas. Eligió ventanas POR TIPO:
 * lo caro se persigue más tiempo, lo común dos semanas.
 *
 * Y lo que hace abarcable la lista no es la ventana sino que se ACHIQUE a
 * medida que trabajan: una persona a la que ya le escribieron se esconde
 * `DIAS_ESCONDIDA_TRAS_ESCRIBIRLE` días y vuelve sola si no compró.
 *
 * El embudo del bot (/admin/leads) es otra cosa y sigue su propio reloj.
 */

/** Recién a los 3 días se considera frío (Ishtar: "está bien que sea a 3 días"). */
export const DIAS_PARA_ENFRIARSE = 3;

/** Ticket alto: ≥ $250.000, multifocal, graduación alta o control de miopía. */
export const DIAS_TICKET_ALTO = 30;

/** Presupuesto común: el resto de los montos. */
export const DIAS_PRESUPUESTO_COMUN = 14;

/** Fichas que nunca recibieron presupuesto (casi todas nacen de un anuncio). */
export const DIAS_SIN_PRESUPUESTO = 30;

/** Carrito abandonado de la tienda web: desde las 24 h hasta acá. */
export const DIAS_CARRITO = 30;

/** Monto a partir del cual un presupuesto o carrito es ticket alto. */
export const MONTO_TICKET_ALTO = 250_000;

/**
 * "Ya le escribí": la tarjeta se va y vuelve sola a los N días si no compró.
 * Cuenta CUALQUIER seguimiento firmado por una persona (Interaction FOLLOWUP
 * con userId) — también los que se mandan desde el embudo o el buzón — así
 * nadie le escribe dos veces en la misma semana desde dos pantallas.
 */
export const DIAS_ESCONDIDA_TRAS_ESCRIBIRLE = 5;

/**
 * Remitentes de WhatsApp que NO son una persona. Un saliente de cualquier otro
 * ("Teléfono" = el celular de la óptica, o el nombre de quien contestó desde el
 * buzón) cuenta como "ya le escribió". Medido el 10/9/2026: el equipo escribe
 * sobre todo desde el celular (2.129 salientes "Teléfono" en 5 días contra 147
 * desde el buzón), y eso SÍ llega al sistema por la coexistencia de la API.
 */
export const REMITENTES_AUTOMATICOS = ['Bot', 'Sistema Atelier', 'Sistema'] as const;

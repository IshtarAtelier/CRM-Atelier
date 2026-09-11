/**
 * Remitentes de WhatsApp que NO son una persona.
 *
 * Una sola lista para toda pregunta del tipo "¿le escribió alguien del
 * equipo?". Antes Cierres excluía Bot/Sistema Atelier/Sistema y el embudo
 * solo Bot/Sistema Atelier, así que para el embudo un recordatorio de turno
 * (que sale como 'Sistema') contaba como que una persona se había ocupado.
 *
 * Todo lo que no está acá cuenta como persona: el nombre de quien contestó
 * desde el buzón, o "Teléfono" — el celular de la óptica, que llega por la
 * coexistencia de la API y es por donde más escribe el equipo (2.129 salientes
 * en 5 días contra 147 desde el buzón, medido el 10/9/2026).
 *
 * OJO al usarla en un `notIn` de Prisma: descarta también los senderName
 * NULL (en SQL `NULL NOT IN (...)` no es TRUE).
 */
export const REMITENTES_AUTOMATICOS = ['Bot', 'Sistema Atelier', 'Sistema'] as const;

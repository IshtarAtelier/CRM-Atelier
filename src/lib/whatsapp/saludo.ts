/**
 * Saludo según la hora ARGENTINA, para las plantillas que llevan "{{2}} =
 * saludo según la hora" (seguimiento_presupuesto, seguimiento_carrito,
 * invitacion_local_v2, ...).
 *
 * Existe una versión para el navegador en `components/whatsapp/format.ts`, que
 * usa la hora local del que está sentado frente al CRM. Esta es la del
 * SERVIDOR: Railway corre en UTC, y `new Date().getHours()` ahí daría "buenas
 * tardes" a las 9 de la mañana de Córdoba.
 */
export function saludoSegunHoraArgentina(now: Date = new Date()): string {
    const horaArt = (now.getUTCHours() + 24 - 3) % 24;
    if (horaArt < 13) return 'buen día';
    if (horaArt < 20) return 'buenas tardes';
    return 'buenas noches';
}

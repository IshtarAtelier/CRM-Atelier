/**
 * Horario comercial de Argentina (UTC-3).
 * Módulo compartido — antes estaba duplicado en 3 archivos.
 */

/**
 * Verifica si la hora actual corresponde a horario comercial.
 * @param {Date} date - Fecha a evaluar (default: now)
 * @returns {boolean}
 */
function isBusinessHours(date = new Date()) {
    const argDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const day = argDate.getDay(); // 0 = Domingo, 6 = Sábado
    const hour = argDate.getHours();
    const minute = argDate.getMinutes();
    const timeDecimal = hour + minute / 60;

    if (day === 0) return false; // Domingo cerrado
    if (day === 6) {
        return timeDecimal >= 9 && timeDecimal < 17; // Sábado 9:00 - 17:00
    }
    // Lunes a Viernes: 8:00 - 20:00 (corrido, sin siesta)
    return timeDecimal >= 8 && timeDecimal < 20;
}

module.exports = { isBusinessHours };

/**
 * Date and Helper Services
 */

// Reexportado del módulo compartido: antes había una copia con los horarios
// duplicados a mano y quedó desactualizada. Una sola fuente de verdad.
const { isBusinessHours } = require('../shared/business-hours');

function getNextBusinessMorning(baseDate = new Date()) {
    const argDate = new Date(baseDate.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    
    let found = false;
    while (!found) {
        argDate.setDate(argDate.getDate() + 1);
        const day = argDate.getDay();
        if (day !== 0) { // Lunes a Sábado
            found = true;
        }
    }
    
    const year = argDate.getFullYear();
    const month = argDate.getMonth();
    const date = argDate.getDate();
    
    const pad = (n) => String(n).padStart(2, '0');
    const isoString = `${year}-${pad(month + 1)}-${pad(date)}T09:00:00-03:00`;
    return new Date(isoString);
}

function getNextWeekdayDate(dayName, baseDate = new Date()) {
    const daysMap = {
        'domingo': 0,
        'lunes': 1,
        'martes': 2,
        'miercoles': 3,
        'jueves': 4,
        'viernes': 5,
        'sabado': 6
    };
    const targetDay = daysMap[dayName.toLowerCase()];
    if (targetDay === undefined) return null;

    // Convertir a representación en Argentina
    const argDate = new Date(baseDate.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const currentDay = argDate.getDay();
    
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd < 0) {
        daysToAdd += 7;
    } else if (daysToAdd === 0) {
        // Si es hoy, y ya pasó el mediodía (12:00), lo movemos a la semana que viene
        if (argDate.getHours() >= 12) {
            daysToAdd += 7;
        }
    }

    argDate.setDate(argDate.getDate() + daysToAdd);
    
    const year = argDate.getFullYear();
    const month = argDate.getMonth();
    const date = argDate.getDate();
    
    // Devolver la fecha a las 9:00 AM de Argentina (UTC-3)
    const pad = (n) => String(n).padStart(2, '0');
    const isoString = `${year}-${pad(month + 1)}-${pad(date)}T09:00:00-03:00`;
    return new Date(isoString);
}

module.exports = {
    isBusinessHours,
    getNextBusinessMorning,
    getNextWeekdayDate
};

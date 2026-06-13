/**
 * Date and Helper Services
 */

function isBusinessHours(date) {
    const argDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const day = argDate.getDay(); // 0 = Domingo, 6 = Sábado
    const hour = argDate.getHours();
    const minute = argDate.getMinutes();
    const timeDecimal = hour + minute / 60; // Ej: 13:30 = 13.5

    if (day === 0) return false; // Domingo cerrado
    if (day === 6) {
        return timeDecimal >= 10 && timeDecimal < 14; // Sábado 10:00 - 14:00
    }
    // Lunes a Viernes: 9:00 - 13:30 y 16:00 - 19:30
    return (timeDecimal >= 9 && timeDecimal < 13.5) || (timeDecimal >= 16 && timeDecimal < 19.5);
}

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

import { addDays, isWeekend, format } from 'date-fns';

// Lista de feriados nacionales en Argentina (formato YYYY-MM-DD)
// Esta lista se puede actualizar anualmente
const ARGENTINA_HOLIDAYS = [
    // 2026
    '2026-01-01', // Año Nuevo
    '2026-02-16', // Carnaval
    '2026-02-17', // Carnaval
    '2026-03-24', // Día Nacional de la Memoria por la Verdad y la Justicia
    '2026-04-02', // Día del Veterano y de los Caídos en la Guerra de Malvinas / Jueves Santo
    '2026-04-03', // Viernes Santo
    '2026-05-01', // Día del Trabajador
    '2026-05-25', // Día de la Revolución de Mayo
    '2026-06-17', // Paso a la Inmortalidad del Gral. Don Martín Miguel de Güemes
    '2026-06-20', // Paso a la Inmortalidad del Gral. Manuel Belgrano
    '2026-07-09', // Día de la Independencia
    '2026-08-17', // Paso a la Inmortalidad del Gral. José de San Martín
    '2026-10-12', // Día del Respeto a la Diversidad Cultural
    '2026-11-23', // Día de la Soberanía Nacional
    '2026-12-08', // Día de la Inmaculada Concepción de María
    '2026-12-25', // Navidad
    // 2027 (Principales)
    '2027-01-01',
    '2027-02-08',
    '2027-02-09',
    '2027-03-24',
    '2027-03-25',
    '2027-03-26',
    '2027-04-02',
    '2027-05-01',
    '2027-05-25',
    '2027-06-17',
    '2027-06-20',
    '2027-07-09',
    '2027-08-16',
    '2027-10-11',
    '2027-11-22',
    '2027-12-08',
    '2027-12-25',
];

/**
 * Verifica si una fecha dada es un feriado en Argentina
 */
export function isHoliday(date: Date): boolean {
    const dateString = format(date, 'yyyy-MM-dd');
    return ARGENTINA_HOLIDAYS.includes(dateString);
}

/**
 * Añade días hábiles a una fecha dada, omitiendo fines de semana y feriados
 * @param startDate Fecha inicial
 * @param businessDays Cantidad de días hábiles a sumar
 * @returns La fecha final resultante
 */
export function addBusinessDays(startDate: Date, businessDays: number): Date {
    let currentDate = startDate;
    let addedDays = 0;

    while (addedDays < businessDays) {
        currentDate = addDays(currentDate, 1);
        
        if (!isWeekend(currentDate) && !isHoliday(currentDate)) {
            addedDays++;
        }
    }

    return currentDate;
}

/**
 * Calcula la cantidad de días hábiles estimados para un pedido en base a sus cristales
 * @param items Items del pedido
 * @returns Cantidad de días hábiles estimados
 */
export function calculateEstimatedDays(items: any[]): number {
    let maxDays = 5; // Default: 5 días hábiles para Lentes de stock (graduación simple)
    
    for (const item of items) {
        const product = item.product;
        if (!product) continue;
        
        const isCristal = product.category === 'Cristal' || product.type?.includes('Cristal');
        if (!isCristal) continue;

        const nameStr = (product.name || '').toUpperCase();
        const modelStr = (product.model || '').toUpperCase();
        const brandStr = (product.brand || '').toUpperCase();
        const typeStr = (product.type || '').toUpperCase();
        const fullStr = `${typeStr} ${nameStr} ${modelStr} ${brandStr}`;

        // 25 días hábiles: Cristales Stellest (proceso especial de importación/fabricación)
        if (fullStr.includes('STELLEST')) {
            return 25;
        }
        
        // 10 a 15 días: Multifocales, ocupacionales y bifocales
        if (typeStr.includes('MULTIFOCAL') || typeStr.includes('OCUPACIONAL') || typeStr.includes('BIFOCAL')) {
            return 15; // Tomamos el máximo del rango (15 días) para estar seguros
        }
        
        // 7 a 10 días: Trabajos de laboratorio (graduaciones altas / monofocales de laboratorio)
        if (typeStr.includes('MONOFOCAL') && product.origin === 'LABORATORIO') {
            if (maxDays < 10) maxDays = 10;
        }
    }
    
    return maxDays;
}

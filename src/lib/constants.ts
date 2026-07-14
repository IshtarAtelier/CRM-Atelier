// WhatsApp phone number (single source of truth for all storefront pages)
export const WHATSAPP_PHONE = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '5493518685644';

// Destinatarios de las alertas internas (nuevas ventas web, stock bajo, etc.).
// Single source of truth: no hardcodear estos correos en cada endpoint.
export const ADMIN_ALERT_EMAILS = process.env.ADMIN_ALERT_EMAILS || 'pisano.ishtar@gmail.com, atelier.optica.cerro@gmail.com';

// "Sin atender" — borrón y cuenta nueva. El backlog viejo de leads sin atender se
// dio por cerrado el 2026-07-06: solo los contactos ingresados a partir de este
// momento cuentan/marcan como "sin atender" (contador del botón, badge del sidebar,
// filtro de la lista y el chip rojo de cada ficha). Para reiniciar de nuevo en el
// futuro, mover esta fecha (el server además admite override por ATTENTION_CUTOFF_DATE).
export const ATTENTION_CUTOFF_ISO = '2026-07-06T18:16:07.000Z';

// Platform commission rates for payment methods
export const PLATFORM_COMMISSIONS: Record<string, number> = {
    // ── Pay Way 6 cuotas (20% plataforma) ──
    'PAY_WAY_6_ISH': 0.20,
    'PAY_WAY_6_YANI': 0.20,
    'CREDIT_6': 0.20,

    // ── Pay Way 3 cuotas (10% plataforma) ──
    'PAY_WAY_3_ISH': 0.10,
    'PAY_WAY_3_YANI': 0.10,
    'CREDIT_3': 0.10,

    // ── Naranja Z / Plan Z (20% plataforma) ──
    'NARANJA_Z_ISH': 0.20,
    'NARANJA_Z_YANI': 0.20,
    'PLAN_Z': 0.20,

    // ── Go Cuotas (20% plataforma) ──
    'GO_CUOTAS': 0.20,
    'GO_CUOTAS_ISH': 0.20,

    // ── Sin comisión ──
    'EFECTIVO': 0,
    'CASH': 0,
    'DEBIT': 0,
    'TRANSFER': 0,
    'TRANSFERENCIA_ISHTAR': 0,
    'TRANSFERENCIA_LUCIA': 0,
    'CREDIT': 0,
};

export function getCommissionRate(method: string): number {
    return PLATFORM_COMMISSIONS[method] || 0;
}

// Doctor commission rate
export const DOCTOR_COMMISSION_RATE = 0.15; // 15%

// Objetivos mensuales por defecto (base de 1 vendedor) cuando no hay
// MonthlyTarget configurado para el mes. Se configuran en DÓLARES y se
// convierten a ARS con el blue del día; se ajustan por mes desde
// /admin/configuracion/objetivos (ej: 2 vendedores = ×2).
export const DEFAULT_MONTHLY_TARGETS_USD = {
    target1: 12000, // Base
    target2: 16000, // Stretch
    target3: 20000, // Elite
};

// Fallback en ARS si no hay cotización disponible (último recurso).
export const DEFAULT_MONTHLY_TARGETS = {
    target1: 18000000, // Base
    target2: 24000000, // Stretch
    target3: 30000000, // Elite
};

// ISH POSNET Threshold Monitoring
export const ISH_POSNET_THRESHOLD = 8500000;
export const ISH_POSNET_METHODS = ['PAY_WAY_6_ISH', 'PAY_WAY_3_ISH', 'NARANJA_Z_ISH'];

// Human-readable labels for payment methods (single source of truth)
export const METHOD_LABELS: Record<string, string> = {
    CASH: 'Efectivo',
    EFECTIVO: 'Efectivo',
    DEBIT: 'Débito',
    CREDIT: 'Crédito (1 pago)',
    CREDIT_3: '3 Cuotas S/I',
    CREDIT_6: '6 Cuotas S/I',
    PLAN_Z: 'Plan Z',
    TRANSFER: 'Transferencia',
    TRANSFERENCIA_ISHTAR: 'Transf. Ishtar',
    TRANSFERENCIA_LUCIA: 'Transf. Lucía',
    PAY_WAY_3_ISH: 'PayWay 3c Ish',
    PAY_WAY_3_YANI: 'PayWay 3c Yani',
    PAY_WAY_6_ISH: 'PayWay 6c Ish',
    PAY_WAY_6_YANI: 'PayWay 6c Yani',
    NARANJA_Z_ISH: 'Naranja Z Ish',
    NARANJA_Z_YANI: 'Naranja Z Yani',
    GO_CUOTAS: 'Go Cuotas',
    GO_CUOTAS_ISH: 'Go Cuotas Ish',
};

// Shared Product Categories
export const PRODUCT_CATEGORIES = [
    { id: 'Cristal', label: '🔬 Cristales', icon: '🔬', noStock: true, subtypes: ['Monofocal', 'Multifocal', 'Bifocal', 'Ocupacional', 'Coquil'] },
    { id: 'Lentes de Sol', label: '🕶️ Sol', icon: '🕶️' },
    { id: 'Armazón de Receta', label: '👓 Armazón', icon: '👓' },
    { id: 'Lentes de Contacto', label: '👁️ Contacto', icon: '👁️' },
    { id: 'Lentes Especiales', label: '✨ Especiales', icon: '✨' },
    { id: 'Tratamiento', label: '💧 Tratamientos', icon: '💧', subtypes: ['Tratamientos', 'Colores de Cristal'] },
];

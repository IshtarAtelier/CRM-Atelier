// WhatsApp phone number (single source of truth for all storefront pages)
export const WHATSAPP_PHONE = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '5493541215971';

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

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

